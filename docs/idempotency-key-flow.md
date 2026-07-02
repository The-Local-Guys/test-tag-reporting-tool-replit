# Idempotency Key Flow

This document describes the current idempotency-key implementation for create requests, what is required for it to work, and how to use it safely from clients and new backend routes.

## Purpose

Idempotency keys protect create endpoints from duplicate records when a client retries the same request because of a timeout, network drop, double tap, or app retry.

The client sends a stable `Idempotency-Key` header with a create request. The server records the first request and either:

- creates the resource once and stores the response,
- replays the original response for an identical retry, or
- rejects reuse of the same key with a different request body.

## Current Coverage

The shared idempotency helper is `runIdempotentCreate` in `server/idempotency.ts`.

It is currently wired into these authenticated create endpoints:

- `POST /api/sessions`
- `POST /api/sessions/:sessionId/results`
- `POST /api/environments`
- `POST /api/certificates`

If a request does not include `Idempotency-Key`, these routes continue through their existing non-idempotent create path.

## Required Database Setup

The migration `migrations/add_idempotency_keys.sql` must be applied.

It creates:

- `idempotency_keys`
- unique constraint on `(user_id, method, endpoint, key)`
- `expires_at` index
- `updated_at` trigger
- `pgcrypto` extension for UUID generation

The table stores:

- authenticated user id
- HTTP method
- logical endpoint name
- idempotency key
- request hash
- status: `in_progress`, `completed`, or `failed`
- response status/body when small enough
- resource type/id for reconstructing large responses
- creation/update/expiry timestamps

Current retention is 90 days, controlled by `IDEMPOTENCY_TTL_DAYS` in `server/idempotency.ts`.

## Client Requirements

The client must send exactly one `Idempotency-Key` header on create requests that should be retry-safe.

Example:

```ts
await fetch("/api/sessions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  credentials: "include",
  body: JSON.stringify(sessionPayload),
});
```

Important client rules:

- Generate one key per intended create operation.
- Reuse the same key only when retrying the exact same operation.
- Do not reuse a key after changing the body, path parameters, or target endpoint.
- Keep the key non-empty and 200 characters or fewer.
- Do not send duplicate `Idempotency-Key` headers.
- Persist the key while a request is pending if the app may retry after a timeout or refresh.

The current `client/src/lib/queryClient.ts` `apiRequest` helper does not accept custom headers, so the frontend does not automatically send idempotency keys yet. To make this work from the app, either extend `apiRequest` to accept headers/options or create a dedicated create-request helper that adds `Idempotency-Key`.

## Server Flow

`runIdempotentCreate(req, options)` follows this process:

1. Parse `Idempotency-Key`.
2. If the key is missing, return `null`; the route runs its existing create logic.
3. If the key is invalid, return `400`.
4. Require an authenticated `req.session.userId`; otherwise return `401`.
5. Build a request hash from:
   - HTTP method
   - configured logical endpoint
   - configured path params
   - request body
6. Start a database transaction.
7. Try to insert an `idempotency_keys` row with status `in_progress`.
8. If insert succeeds:
   - run the route's create callback inside the same transaction,
   - store the response status/body when the body is no larger than 256 KB,
   - store `resource_type` and `resource_id`,
   - mark the idempotency row `completed`,
   - commit and return the created response.
9. If insert conflicts:
   - load the existing row for the same user/method/endpoint/key,
   - compare request hashes,
   - replay the response if the existing row is `completed`,
   - reject if the existing row is still `in_progress`.

The request hash is canonicalized before hashing, so object keys are sorted and `undefined` values are ignored. Array order still matters.

## Response Behavior

Missing key:

- The helper returns `null`.
- The route behaves exactly like it did before idempotency support.

Invalid key:

- `400`
- `{ "error": "Idempotency-Key must not be blank" }`
- Other invalid cases include duplicate headers, comma-joined values, and keys longer than 200 characters.

Same key, same request, first successful create:

- Returns the actual create response.
- `created: true` internally.

Same key, same request, already completed:

- Replays the original response status and body.
- If the body was too large to store, the server reconstructs the response from the saved `resource_type` and `resource_id`.

Same key, different request:

- `409`
- `{ "error": "Idempotency-Key was already used with a different request" }`

Same key while first request is still running:

- `409`
- `{ "error": "A request with this Idempotency-Key is already in progress" }`

Unauthenticated request with key:

- `401`
- `{ "message": "Authentication required" }`

## Resource Reconstruction

Responses larger than `MAX_STORED_RESPONSE_BYTES` are not stored in `response_body`.

For replay, the helper can reconstruct responses for these resource types:

- `test_session`
- `test_result`
- `environment`
- `certificate`

If a new idempotent endpoint uses a new `resourceType`, add reconstruction logic in `reconstructResponseBody`.

## Adding Idempotency To Another Create Endpoint

Use `runIdempotentCreate` after validating input and before the normal create fallback.

```ts
const idempotentResult = await runIdempotentCreate(req, {
  endpoint: "/api/example",
  pathParams: { parentId },
  create: async (client) => {
    const created = await storage.createExample(data, client);
    return {
      status: 201,
      body: created,
      resourceType: "example",
      resourceId: created.id,
    };
  },
});

if (idempotentResult) {
  return res.status(idempotentResult.status).json(idempotentResult.body);
}

const created = await storage.createExample(data);
return res.status(201).json(created);
```

Backend requirements for a new endpoint:

- The route must be authenticated before calling `runIdempotentCreate`.
- Use a stable logical `endpoint` string, not a fully expanded URL.
- Include meaningful path params in `pathParams` when the route has path identity, such as `{ sessionId }`.
- The storage create method must accept an optional `TransactionClient` and use it for every DB write in that create operation.
- The create callback must return `status`, `body`, `resourceType`, and `resourceId`.
- Add `resourceType` support in `reconstructResponseBody` if the response may exceed 256 KB.
- Keep side effects inside the create callback only if they are safe to run once and are part of the transaction behavior. For analytics or logging, follow the current pattern and run them only when `idempotentResult.created` is true.

## Operational Notes

- Expired rows are indexed by `expires_at`, but there is no cleanup job in the current code. Add scheduled cleanup if table growth becomes a concern.
- The `failed` status exists in the schema but the current helper rolls back on errors, so failed rows are not currently persisted by the normal error path.
- The helper uses a database transaction around the idempotency row and the resource create. This requires the create function to use the provided transaction client; otherwise the resource write can happen outside the protection boundary.
- The unique scope includes `user_id`, so two different users may use the same idempotency key without conflict.
- Replayed responses do not rerun tracking side effects in the current route integrations.

## Minimal Checklist To Make It Work

1. Apply `migrations/add_idempotency_keys.sql`.
2. Make sure the endpoint is protected by `requireAuth`.
3. Wrap the create logic with `runIdempotentCreate`.
4. Ensure the storage create method uses the optional transaction client.
5. Add response reconstruction for any new `resourceType`.
6. Update the client request code to send one stable `Idempotency-Key` per create attempt.
7. Retry failed network/time-out requests with the same key and unchanged request payload.
