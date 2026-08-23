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
  outline_beats text,
  chapter_number numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chapters_story_id_idx on public.chapters (story_id);
-- Nâng cấp: thêm cột outline_beats cho bảng chapters đã tồn tại từ trước
alter table public.chapters add column if not exists outline_beats text;

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

-- Xưởng Theme: mẫu theme tự tạo (màu/font/hình dạng nút-khung/nền trang trí) —
-- lưu riêng để dùng lại giữa nhiều game, độc lập với bảng games.
create table if not exists public.custom_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Theme mới',
  vars jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_themes_updated_at_idx on public.custom_themes (updated_at desc);

-- Xưởng Viết Truyện: bộ tài liệu sống (bible) của mỗi bộ truyện — quy tắc viết,
-- thế giới quan, nhân vật, quan hệ, đại cương, phục bút, timeline, tóm tắt hiện tại.
-- doc_key là mã cố định; (story_id, doc_key) unique để mỗi truyện chỉ có 1 bản.
create table if not exists public.writer_docs (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  doc_key text not null,
  title text not null default 'Tài liệu',
  content text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (story_id, doc_key)
);
create index if not exists writer_docs_story_id_idx on public.writer_docs (story_id);

-- Snapshot/version lịch sử của từng tài liệu bible — để quay lại khi AI update sai.
create table if not exists public.writer_doc_snapshots (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  doc_key text not null,
  title text not null default 'Snapshot',
  content text not null default '',
  label text,
  created_at timestamptz not null default now()
);
create index if not exists writer_doc_snapshots_story_key_idx on public.writer_doc_snapshots (story_id, doc_key);

-- Snapshot/version lịch sử của từng CHƯƠNG — cùng nguyên lý writer_doc_snapshots,
-- nhưng cho bảng chapters: AI "Viết 2 pass"/"Sửa theo góp ý" ghi đè toàn bộ nội
-- dung chương khi lưu, nếu không có bản trước thì không có đường quay lại.
create table if not exists public.chapter_snapshots (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete cascade,
  title text not null default 'Snapshot',
  content text not null default '',
  chapter_number numeric,
  label text,
  created_at timestamptz not null default now()
);
create index if not exists chapter_snapshots_chapter_idx on public.chapter_snapshots (chapter_id, created_at desc);

-- =========================================================================
-- Xưởng Kịch Bản Game (game_script_*) — viết kịch bản game theo từng loại game
-- Hoạt động theo đúng mô hình xưởng của WritingFactory: mỗi bộ truyện (story)
-- có 1 cấu hình loại game + bộ tài liệu kịch bản sống (bible) + các tuyến kịch
-- bản (branch/route) + phân cảnh theo từng tuyến (scene).
-- =========================================================================

-- Cấu hình xưởng kịch bản: 1 dòng / bộ truyện — loại game + tên + bối cảnh.
create table if not exists public.game_script_config (
  story_id uuid primary key references public.stories (id) on delete cascade,
  game_type text not null default 'adventure',
  game_name text,
  setting text,
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Bộ tài liệu kịch bản game (bible) — doc_key cố định theo loại game;
-- (story_id, doc_key) unique để mỗi bộ truyện chỉ có 1 bản mỗi tài liệu.
create table if not exists public.game_script_docs (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  doc_key text not null,
  title text not null default 'Tài liệu',
  content text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (story_id, doc_key)
);
create index if not exists game_script_docs_story_id_idx on public.game_script_docs (story_id);

-- Tuyến kịch bản (branch/route): mỗi tuyến là 1 storyline — có tên, màu, mô tả,
-- điều kiện mở khoá, kết thúc riêng. (story_id, route_key) unique.
create table if not exists public.game_routes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  route_key text not null,
  name text not null,
  color text,
  description text,
  sort_order numeric not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (story_id, route_key)
);
create index if not exists game_routes_story_id_idx on public.game_routes (story_id);

-- Phân cảnh kịch bản theo tuyến: mỗi scene thuộc 1 route_key, có thứ tự, loại
-- phân cảnh (dialog/hành động/khám phá/trận đấu/cutscene/chọn lựa...), địa điểm,
-- nhân vật, phục bút, lựa chọn (choices cho node rẽ nhánh) và nội dung kịch bản.
create table if not exists public.game_scenes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete cascade,
  route_key text not null,
  scene_order numeric not null default 0,
  title text not null default 'Phân cảnh',
  scene_type text,
  location text,
  characters text,
  foreshadow text,
  choices text,
  content text not null default '',
  status text not null default 'nháp',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists game_scenes_story_route_idx on public.game_scenes (story_id, route_key, scene_order);

-- =========================================================================
-- Xưởng Kịch Bản Game (luồng mới) — wizard: ý tưởng → AI gợi ý bộ khung →
-- duyệt/chỉnh → viết 4 nhánh truyện → chốt → xuất kịch bản chuẩn form
-- theo đúng cú pháp của từng xưởng sản xuất game (Thiết Kế / Hệ Thống / NPC /
-- Cung Đấu / Trọng Sinh Làm Giàu) để dán thẳng vào Xưởng Game chạy được.
-- =========================================================================

-- Dự án kịch bản: 1 dòng / dự án — loại game (workshop), tên, ý tưởng, các
-- thông số (số cảnh, số lựa chọn/cảnh, số nhánh) và trạng thái tiến trình wizard.
create table if not exists public.game_script_projects (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories (id) on delete set null,
  workshop text not null default 'studio',
  title text not null default 'Dự Án Kịch Bản Mới',
  idea text not null default '',
  genre text,
  scene_count integer not null default 50,
  choices_per_scene integer not null default 3,
  branch_count integer not null default 4,
  notes text,
  player_name text,
  player_desc text,
  main_quest text,
  status text not null default 'idea',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Nâng cấp: thêm cột nhân vật nhập vai + nhiệm vụ chính cho bảng đã tồn tại từ trước
alter table public.game_script_projects add column if not exists player_name text;
alter table public.game_script_projects add column if not exists player_desc text;
alter table public.game_script_projects add column if not exists main_quest text;
create index if not exists game_script_projects_story_idx on public.game_script_projects (story_id);
create index if not exists game_script_projects_updated_idx on public.game_script_projects (updated_at desc);

-- Bộ khung (dàn tổng) — các mục AI gợi ý để tác giả duyệt/chỉnh sửa:
-- nhân vật, bối cảnh, các kết thúc dự kiến (jsonb), ghi chú tổng thể.
create table if not exists public.game_plan_meta (
  project_id uuid primary key references public.game_script_projects (id) on delete cascade,
  characters jsonb not null default '[]'::jsonb,
  settings jsonb not null default '[]'::jsonb,
  endings jsonb not null default '[]'::jsonb,
  branches jsonb not null default '[]'::jsonb,
  notes text,
  game_bible jsonb not null default '{}'::jsonb,
  scene_contracts jsonb not null default '[]'::jsonb,
  compiler_report jsonb not null default '{}'::jsonb,
  invariants jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Phase 1 narrative compiler metadata (safe for databases created before it).
alter table public.game_plan_meta add column if not exists game_bible jsonb not null default '{}'::jsonb;
alter table public.game_plan_meta add column if not exists scene_contracts jsonb not null default '[]'::jsonb;
alter table public.game_plan_meta add column if not exists compiler_report jsonb not null default '{}'::jsonb;
alter table public.game_plan_meta add column if not exists invariants jsonb not null default '[]'::jsonb;

-- Dàn cảnh tổng (bộ khung): mỗi cảnh thuộc project, có thứ tự, mô tả sự kiện,
-- địa điểm, nhân vật, phục bút và các lựa chọn (jsonb: [{text, effect, target}])
-- cùng đánh dấu điểm rẽ (là cảnh có lựa chọn quan trọng dẫn 1 trong các nhánh).
create table if not exists public.game_plan_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.game_script_projects (id) on delete cascade,
  scene_order integer not null default 0,
  title text not null default 'Cảnh',
  description text not null default '',
  location text,
  characters text,
  foreshadow text,
  state_contract jsonb not null default '{}'::jsonb,
  chapter_index integer not null default 1,
  is_checkpoint boolean not null default false,
  choices jsonb not null default '[]'::jsonb,
  is_branch_point boolean not null default false,
  branch_index integer,
  status text not null default 'nháp',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists game_plan_scenes_project_idx on public.game_plan_scenes (project_id, scene_order);
alter table public.game_plan_scenes add column if not exists state_contract jsonb not null default '{}'::jsonb;
alter table public.game_plan_scenes add column if not exists chapter_index integer not null default 1;
alter table public.game_plan_scenes add column if not exists is_checkpoint boolean not null default false;

-- 4 nhánh truyện: mỗi nhánh tương ứng 1 đáp án/lựa chọn chính. Lưu danh sách
-- cảnh (mảng scene id hoặc thứ tự) và trạng thái duyệt/viết của nhánh.
create table if not exists public.game_plan_branches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.game_script_projects (id) on delete cascade,
  branch_index integer not null default 0,
  name text not null default 'Nhánh',
  description text not null default '',
  scene_order_ids uuid[] not null default '{}',
  status text not null default 'nháp',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists game_plan_branches_project_idx on public.game_plan_branches (project_id, branch_index);

-- Nội dung kịch bản theo cảnh của từng nhánh: lưu bản thảo văn xuôi (draft)
-- và kịch bản chuẩn form (script) theo đúng cú pháp xưởng game của project.
create table if not exists public.game_plan_scene_content (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.game_script_projects (id) on delete cascade,
  branch_id uuid references public.game_plan_branches (id) on delete cascade,
  scene_id uuid references public.game_plan_scenes (id) on delete cascade,
  scene_order integer not null default 0,
  title text not null default 'Phân cảnh',
  draft text not null default '',
  script text not null default '',
  status text not null default 'nháp',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (branch_id, scene_id)
);
create index if not exists game_plan_scene_content_branch_idx on public.game_plan_scene_content (project_id, branch_id, scene_order);

-- updated_at tự cập nhật ở mọi bảng nội dung
do $$
declare t text;
begin
  foreach t in array array['stories','chapters','characters','locations','events','relationships','glossary_terms','games','custom_themes','writer_docs','writer_doc_snapshots','chapter_snapshots','game_script_config','game_script_docs','game_routes','game_scenes','game_script_projects','game_plan_meta','game_plan_scenes','game_plan_branches','game_plan_scene_content']
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
  foreach t in array array['stories','chapters','characters','locations','events','relationships','glossary_terms','games','custom_themes','writer_docs','writer_doc_snapshots','chapter_snapshots','game_script_config','game_script_docs','game_routes','game_scenes','game_script_projects','game_plan_meta','game_plan_scenes','game_plan_branches','game_plan_scene_content']
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
