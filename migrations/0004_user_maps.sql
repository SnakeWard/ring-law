-- Per-user editor map library. Many maps per account, scoped by user_id.
create table if not exists user_maps (
  user_id text not null,
  map_id text not null,
  name text not null default '',
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, map_id)
);
create index if not exists user_maps_user_updated_idx on user_maps (user_id, updated_at desc);
