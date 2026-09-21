-- Public career scoreboard. Writes are scoped to the signed-in user_id.
create table if not exists scoreboard (
  user_id text primary key,
  name text not null default '',
  score int not null default 0,
  battles int not null default 0,
  wins int not null default 0,
  kills int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists scoreboard_score_idx on scoreboard (score desc, updated_at desc);
