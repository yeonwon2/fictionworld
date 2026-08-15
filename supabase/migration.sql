-- FictionWorld — Supabase schema (thay thế backend Base44)
-- Dán toàn bộ file này vào Supabase Dashboard → SQL Editor → Run.
-- An toàn để chạy lại nhiều lần (dùng IF NOT EXISTS / OR REPLACE ở mọi nơi có thể).

-- =========================================================================
-- 0. Tiện ích chung
-- =========================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- 1. Bảng profiles (hồ sơ người dùng — role mặc định admin, mô hình 1 admin)
-- =========================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Tự tạo profile (role=admin) mỗi khi có người đăng ký mới.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 2. Bảng nội dung (khớp field name với base44/entities/*.jsonc)
-- =========================================================================

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  genre text,
  cover_url text,
  direction jsonb not null default '{}'::jsonb,
  form_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  title text not null,
  content text,
  chapter_number numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chapters_story_id_idx on public.chapters (story_id);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  name text not null,
  aliases text,
  avatar_url text,
  role text,
  age numeric,
  description text,
  appearance text,
  personality text,
  speech_style text,
  goals text,
  secret text,
  inner_conflict text,
  power_level text,
  skills text,
  items text,
  first_appeared_chapter numeric,
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists characters_story_id_idx on public.characters (story_id);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  name text not null,
  type text default 'Khác',
  map_url text,
  description text,
  parent_location_id uuid references public.locations (id) on delete set null,
  hierarchy_path text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists locations_story_id_idx on public.locations (story_id);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  title text not null,
  timeline_order numeric default 0,
  description text,
  related_character_ids uuid[] not null default '{}',
  related_location_ids uuid[] not null default '{}',
  participant_states jsonb not null default '{}'::jsonb,
  foreshadow_note text,
  foreshadow_resolved boolean not null default false,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_story_id_idx on public.events (story_id);

create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  source_character_id uuid references public.characters (id) on delete cascade,
  target_character_id uuid references public.characters (id) on delete cascade,
  relation_type text not null,
  description text,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists relationships_story_id_idx on public.relationships (story_id);
create index if not exists relationships_source_idx on public.relationships (source_character_id);
create index if not exists relationships_target_idx on public.relationships (target_character_id);

create table if not exists public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  term text not null,
  category text default 'Khác',
  definition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists glossary_terms_story_id_idx on public.glossary_terms (story_id);

-- Xưởng Game: game nhập vai phân nhánh do AI sinh (thư viện nhiều game, không gắn chặt vào 1 truyện)
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete set null,
  title text not null default 'Tựa Game Mới',
  meta jsonb not null default '{}'::jsonb,
  nodes jsonb not null default '{}'::jsonb,
  node_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_story_id_idx on public.games (story_id);
create index if not exists games_updated_at_idx on public.games (updated_at desc);

-- updated_at tự cập nhật ở mọi bảng nội dung
do $$
declare t text;
begin
  foreach t in array array['stories','chapters','characters','locations','events','relationships','glossary_terms','games']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- =========================================================================
-- 3. RLS — mô hình 1 admin: bất kỳ ai đã đăng nhập đều có toàn quyền.
-- =========================================================================

do $$
declare t text;
begin
  foreach t in array array['stories','chapters','characters','locations','events','relationships','glossary_terms','games']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%I_authenticated_all" on public.%I', t, t);
    execute format(
      'create policy "%I_authenticated_all" on public.%I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t, t
    );
  end loop;
end $$;

-- =========================================================================
-- 4. Storage — bucket ảnh (avatar nhân vật / bìa truyện / bản đồ)
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('fictionworld-media', 'fictionworld-media', true)
on conflict (id) do nothing;

drop policy if exists "fictionworld_media_public_read" on storage.objects;
create policy "fictionworld_media_public_read" on storage.objects
  for select using (bucket_id = 'fictionworld-media');

drop policy if exists "fictionworld_media_auth_write" on storage.objects;
create policy "fictionworld_media_auth_write" on storage.objects
  for insert with check (bucket_id = 'fictionworld-media' and auth.role() = 'authenticated');

drop policy if exists "fictionworld_media_auth_update" on storage.objects;
create policy "fictionworld_media_auth_update" on storage.objects
  for update using (bucket_id = 'fictionworld-media' and auth.role() = 'authenticated');

drop policy if exists "fictionworld_media_auth_delete" on storage.objects;
create policy "fictionworld_media_auth_delete" on storage.objects
  for delete using (bucket_id = 'fictionworld-media' and auth.role() = 'authenticated');
