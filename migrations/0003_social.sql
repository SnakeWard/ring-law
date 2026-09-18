-- Presence, friends, invites, and public lobby listings. All rows keyed by user_id.
create table if not exists presence (
  user_id text primary key,
  name text not null default '',
  last_seen timestamptz not null default now()
);

create table if not exists friend_requests (
  from_id text not null,
  to_id text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

create table if not exists friendships (
  user_a text not null,
  user_b text not null,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists lobby_invites (
  id text primary key,
  from_id text not null,
  to_id text not null,
  code text not null,
  created_at timestamptz not null default now()
);

create table if not exists public_lobbies (
  code text primary key,
  host_user_id text not null,
  host_name text not null default '',
  tier int not null default 1,
  format text not null default '1v1',
  map_id text not null default 'range',
  locked boolean not null default false,
  open_join boolean not null default true,
  humans int not null default 1,
  updated_at timestamptz not null default now()
);
