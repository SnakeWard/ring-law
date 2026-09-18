-- Per-user garage (XP, silver, researched hulls, kits). Scoped by user_id.
create table if not exists garages (
  user_id text primary key,
  payload jsonb not null,
  imported_local boolean not null default false,
  updated_at timestamptz not null default now()
);
