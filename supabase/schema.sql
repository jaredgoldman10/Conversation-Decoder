-- Conversation Decoder database.
-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- Every row belongs to one signed-in person. Row-level security makes sure
-- each person can only read and change their own rows. Not even other users
-- of the app can see them.

create table if not exists public.docs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null check (collection in ('terms', 'calls', 'meta')),
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

alter table public.docs enable row level security;

drop policy if exists "read own rows"   on public.docs;
drop policy if exists "insert own rows" on public.docs;
drop policy if exists "update own rows" on public.docs;
drop policy if exists "delete own rows" on public.docs;

create policy "read own rows"   on public.docs for select to authenticated using (auth.uid() = user_id);
create policy "insert own rows" on public.docs for insert to authenticated with check (auth.uid() = user_id);
create policy "update own rows" on public.docs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own rows" on public.docs for delete to authenticated using (auth.uid() = user_id);
