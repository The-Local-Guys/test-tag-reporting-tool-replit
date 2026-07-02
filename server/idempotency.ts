import { createHash } from "crypto";
import type { Request } from "express";
import { pool } from "./db";

export type TransactionClient = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

type IdempotencyCreateResult = {
  status: number;
  body: unknown;
  resourceType: string;
  resourceId: number;
};

type IdempotencyRunOptions = {
  endpoint: string;
  pathParams?: Record<string, unknown>;
  create: (client: TransactionClient) => Promise<IdempotencyCreateResult>;
};

export type IdempotencyRunResult = {
  handled: true;
  replayed: boolean;
  created: boolean;
  status: number;
  body: unknown;
} | null;

const IDEMPOTENCY_TTL_DAYS = 90;
const MAX_STORED_RESPONSE_BYTES = 256 * 1024;

function isMissingIdempotencyTableError(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42P01" && candidate.message?.includes("idempotency_keys");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    return Object.keys(input)
      .filter((key) => input[key] !== undefined)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(input[key]);
        return acc;
      }, {});
  }

  return value;
}

function hashRequest(input: {
  method: string;
  endpoint: string;
  pathParams?: Record<string, unknown>;
  body: unknown;
}) {
  const canonical = JSON.stringify(canonicalize(input));
  return createHash("sha256").update(canonical).digest("hex");
}

function parseIdempotencyKey(req: Request):
  | { kind: "missing" }
  | { kind: "invalid"; message: string }
  | { kind: "present"; key: string } {
  const rawValue = req.headers["idempotency-key"];

  if (rawValue === undefined) {
    return { kind: "missing" };
  }

  const rawHeaderCount = req.rawHeaders.filter(
    (_value, index) =>
      index % 2 === 0 && req.rawHeaders[index].toLowerCase() === "idempotency-key",
  ).length;

  if (Array.isArray(rawValue) || rawHeaderCount > 1) {
    return { kind: "invalid", message: "Duplicate Idempotency-Key headers are not allowed" };
  }

  if (rawValue.includes(",")) {
    return { kind: "invalid", message: "Comma-joined Idempotency-Key headers are not allowed" };
  }

  const key = rawValue.trim();
  if (!key) {
    return { kind: "invalid", message: "Idempotency-Key must not be blank" };
  }

  if (key.length > 200) {
    return { kind: "invalid", message: "Idempotency-Key must be 200 characters or fewer" };
  }

  return { kind: "present", key };
}

function responseBodyToStore(body: unknown) {
  const serialized = JSON.stringify(body ?? null);
  if (Buffer.byteLength(serialized, "utf8") > MAX_STORED_RESPONSE_BYTES) {
    return null;
  }
  return body;
}

async function reconstructResponseBody(
  client: TransactionClient,
  resourceType: string | null,
  resourceId: number | null,
) {
  if (!resourceType || !resourceId) {
    return null;
  }

  if (resourceType === "test_session") {
    const result = await client.query(
      `
        select
          id,
          service_type as "serviceType",
          test_date as "testDate",
          technician_name as "technicianName",
          client_name as "clientName",
          site_contact as "siteContact",
          address,
          country,
          user_id as "userId",
          starting_asset_number as "startingAssetNumber",
          technician_licensed as "technicianLicensed",
          compliance_standard as "complianceStandard",
          status,
          custom_starting_numbers as "customStartingNumbers",
          last_activity_at as "lastActivityAt",
          created_at as "createdAt",
          deleted_at as "deletedAt",
          deleted_by as "deletedBy"
        from test_sessions
        where id = $1
      `,
      [resourceId],
    );
    return result.rows[0] ?? null;
  }

  if (resourceType === "test_result") {
    const result = await client.query("select * from test_results where id = $1", [resourceId]);
    return result.rows[0] ?? null;
  }

  if (resourceType === "environment") {
    const result = await client.query(
      `
        select
          id,
          user_id as "userId",
          name,
          service_type as "serviceType",
          items,
          created_at as "createdAt"
        from environments
        where id = $1
      `,
      [resourceId],
    );
    return result.rows[0] ?? null;
  }

  if (resourceType === "certificate") {
    const result = await client.query(
      `
        select
          id,
          client_name as "clientName",
          address,
          services,
          validity_dates as "validityDates",
          certification_date as "certificationDate",
          technician_name as "technicianName",
          technician_license as "technicianLicense",
          user_id as "userId",
          created_at as "createdAt"
        from certificates
        where id = $1
      `,
      [resourceId],
    );
    return result.rows[0] ?? null;
  }

  return null;
}

export async function runIdempotentCreate(
  req: Request,
  options: IdempotencyRunOptions,
): Promise<IdempotencyRunResult> {
  const parsedKey = parseIdempotencyKey(req);

  if (parsedKey.kind === "missing") {
    return null;
  }

  if (parsedKey.kind === "invalid") {
    return {
      handled: true,
      replayed: false,
      created: false,
      status: 400,
      body: { error: parsedKey.message },
    };
  }

  const userId = req.session.userId;
  if (!userId) {
    return {
      handled: true,
      replayed: false,
      created: false,
      status: 401,
      body: { message: "Authentication required" },
    };
  }

  const method = req.method.toUpperCase();
  const requestHash = hashRequest({
    method,
    endpoint: options.endpoint,
    pathParams: options.pathParams,
    body: req.body,
  });
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000);
  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    const inserted = await client.query(
      `
        insert into idempotency_keys (
          user_id,
          method,
          endpoint,
          key,
          request_hash,
          status,
          expires_at
        )
        values ($1, $2, $3, $4, $5, 'in_progress', $6)
        on conflict (user_id, method, endpoint, key) do nothing
        returning *
      `,
      [userId, method, options.endpoint, parsedKey.key, requestHash, expiresAt],
    );

    if (inserted.rows.length === 0) {
      const existing = await client.query(
        `
          select *
          from idempotency_keys
          where user_id = $1
            and method = $2
            and endpoint = $3
            and key = $4
        `,
        [userId, method, options.endpoint, parsedKey.key],
      );
      const row = existing.rows[0];

      if (!row) {
        throw new Error("Idempotency conflict row could not be loaded");
      }

      if (row.request_hash !== requestHash) {
        await client.query("ROLLBACK");
        inTransaction = false;
        return {
          handled: true,
          replayed: false,
          created: false,
          status: 409,
          body: { error: "Idempotency-Key was already used with a different request" },
        };
      }

      if (row.status === "completed") {
        const body =
          row.response_body ??
          (await reconstructResponseBody(client, row.resource_type, row.resource_id));

        if (!body) {
          throw new Error("Completed idempotency response could not be reconstructed");
        }

        await client.query("COMMIT");
        inTransaction = false;
        return {
          handled: true,
          replayed: true,
          created: false,
          status: row.response_status ?? 200,
          body,
        };
      }

      await client.query("ROLLBACK");
      inTransaction = false;
      return {
        handled: true,
        replayed: false,
        created: false,
        status: 409,
        body: { error: "A request with this Idempotency-Key is already in progress" },
      };
    }

    const createResult = await options.create(client);
    const responseBody = responseBodyToStore(createResult.body);

    await client.query(
      `
        update idempotency_keys
        set
          status = 'completed',
          response_status = $1,
          response_body = $2,
          resource_type = $3,
          resource_id = $4
        where user_id = $5
          and method = $6
          and endpoint = $7
          and key = $8
      `,
      [
        createResult.status,
        responseBody,
        createResult.resourceType,
        createResult.resourceId,
        userId,
        method,
        options.endpoint,
        parsedKey.key,
      ],
    );

    await client.query("COMMIT");
    inTransaction = false;

    return {
      handled: true,
      replayed: false,
      created: true,
      status: createResult.status,
      body: createResult.body,
    };
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK");
    }
    if (isMissingIdempotencyTableError(error)) {
      return {
        handled: true,
        replayed: false,
        created: false,
        status: 500,
        body: {
          error: "Idempotency storage is not configured. Apply migrations/add_idempotency_keys.sql.",
        },
      };
    }
    throw error;
  } finally {
    client.release();
  }
}
