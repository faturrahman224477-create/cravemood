-- CraveMood — relational schema
-- Use with Postgres / Supabase. The JSON store in server/server.js mirrors these columns.
--   psql "$DATABASE_URL" -f db/schema.sql

create extension if not exists "pgcrypto";

-- ---------- accounts ----------
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 40),
  contact      text unique,                 -- email or WhatsApp number (null for guests)
  lang         text not null default 'id' check (lang in ('id','en','zh','hi')),
  pw_hash      text not null default '',    -- scrypt / bcrypt hash, empty for guests
  salt         text not null default '',
  guest        boolean not null default false,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- counters kept denormalised for the admin table
  moods_count  int not null default 0,
  orders_count int not null default 0,
  chats_count  int not null default 0,
  spins_count  int not null default 0
);

create index if not exists users_created_idx on users (created_at desc);
create index if not exists users_contact_idx on users (lower(contact));

-- ---------- daily mood log (one row per user per day) ----------
create table if not exists moods (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  mood       text not null check (mood in ('senang','sedih','marah','bingung','capek','kecewa')),
  mood_date  date not null,
  created_at timestamptz not null default now(),
  unique (user_id, mood_date)
);

create index if not exists moods_user_date_idx on moods (user_id, mood_date desc);

-- ---------- carts / orders ----------
create table if not exists orders (
  id         bigserial primary key,
  user_id    uuid references users(id) on delete set null,
  platform   text,                          -- gofood | grabfood | shopeefood
  items      jsonb not null default '[]',   -- [{id,name,qty,lo,hi}]
  total_lo   int,
  total_hi   int,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_idx on orders (user_id, created_at desc);

-- ---------- chat transcript ----------
create table if not exists chats (
  id         bigserial primary key,
  user_id    uuid references users(id) on delete cascade,
  role       text not null check (role in ('user','cimo')),
  body       text not null,
  mood       text,
  created_at timestamptz not null default now()
);

create index if not exists chats_user_idx on chats (user_id, created_at desc);

-- ---------- spinner history ----------
create table if not exists spins (
  id         bigserial primary key,
  user_id    uuid references users(id) on delete cascade,
  item_id    text not null,
  created_at timestamptz not null default now()
);

-- ---------- admin view: who registered ----------
create or replace view v_registrants as
select
  u.id,
  u.name,
  u.contact,
  u.lang,
  u.guest,
  u.created_at,
  u.last_seen_at,
  u.moods_count,
  u.orders_count,
  u.chats_count,
  u.spins_count,
  (select count(*) from moods m where m.user_id = u.id) as days_logged
from users u
order by u.created_at desc;

-- ---------- Supabase RLS example ----------
-- alter table users  enable row level security;
-- alter table moods  enable row level security;
-- alter table chats  enable row level security;
-- create policy "own rows" on moods for all using (auth.uid() = user_id);
-- create policy "own rows" on chats for all using (auth.uid() = user_id);
-- (the admin panel should read v_registrants through a service-role key)
