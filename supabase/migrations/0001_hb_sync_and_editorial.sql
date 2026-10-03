-- THE HOLY BIBLE (hb_ namespace) — applied to Supabase project aegis-ops (agdzdhjkkkvjpwhzitlj).
-- Optional reader sync + editorial review ledger. Scripture is never stored here.

create table if not exists public.hb_reader_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.hb_reader_state enable row level security;
create policy "hb reader reads own state" on public.hb_reader_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "hb reader inserts own state" on public.hb_reader_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "hb reader updates own state" on public.hb_reader_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "hb reader deletes own state" on public.hb_reader_state for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.hb_editors (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'reviewer' check (role in ('reviewer', 'publisher')),
  added_at timestamptz not null default now()
);
alter table public.hb_editors enable row level security;

create or replace function public.hb_is_editor() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.hb_editors e where e.user_id = (select auth.uid()));
$$;
revoke all on function public.hb_is_editor() from public, anon;
grant execute on function public.hb_is_editor() to authenticated;
create policy "hb editors see the editor list" on public.hb_editors for select to authenticated using (public.hb_is_editor());

create table if not exists public.hb_editorial_reviews (
  id bigint generated always as identity primary key,
  object_type text not null check (object_type in ('connection','place','person','journey','timeline','thread','genealogy','scale','insert','phrase')),
  object_id text not null,
  status text not null check (status in ('draft','researched','reviewed','approved','published','rejected')),
  reviewer uuid not null references auth.users (id) default auth.uid(),
  reviewer_name text not null,
  note text,
  checked_against_text boolean not null,
  created_at timestamptz not null default now(),
  constraint hb_review_checked check (checked_against_text) -- AI never publishes: a named human confirms checking the text
);
create index if not exists hb_editorial_reviews_object_idx on public.hb_editorial_reviews (object_type, object_id, created_at desc);
create index if not exists hb_editorial_reviews_reviewer_idx on public.hb_editorial_reviews (reviewer);
alter table public.hb_editorial_reviews enable row level security;
create policy "hb editors read reviews" on public.hb_editorial_reviews for select to authenticated using (public.hb_is_editor());
create policy "hb editors record their own reviews" on public.hb_editorial_reviews for insert to authenticated with check (public.hb_is_editor() and reviewer = (select auth.uid()));
-- no update/delete policies: the ledger is append-only

create or replace view public.hb_latest_reviews with (security_invoker = true) as
select distinct on (object_type, object_id) object_type, object_id, status, reviewer_name, note, checked_against_text, created_at
from public.hb_editorial_reviews order by object_type, object_id, created_at desc;

create or replace function public.hb_touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger hb_reader_state_touch before update on public.hb_reader_state for each row execute function public.hb_touch_updated_at();

-- Owner as publisher (run once, with the owner's auth user id):
-- insert into public.hb_editors (user_id, display_name, role) values ('<auth user id>', 'Thuto', 'publisher');
