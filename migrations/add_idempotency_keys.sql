create extension if not exists pgcrypto;

create table if not exists idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references users(id),
  method text not null,
  endpoint text not null,
  key text not null check (length(key) <= 200),
  request_hash text not null,
  status text not null check (status in ('in_progress', 'completed', 'failed')),
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (user_id, method, endpoint, key)
);

create index if not exists idempotency_keys_expires_at_idx
  on idempotency_keys (expires_at);

create or replace function set_idempotency_keys_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists idempotency_keys_updated_at on idempotency_keys;

create trigger idempotency_keys_updated_at
before update on idempotency_keys
for each row
execute function set_idempotency_keys_updated_at();
