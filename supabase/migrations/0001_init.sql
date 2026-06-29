-- ════════════════════════════════════════════════════════════════════════
-- 0001_init.sql — Chordex 백엔드 초기 스키마 + RLS + 신규 유저 트리거
--
-- 정본: _workspace/05_backend_auth_plan.md §2(테이블+인덱스+제약) · §3(RLS+트리거)
-- 설계: _workspace/11_pr_db_schema_rls_plan.md §3
--
-- 설계 불변(변경 시 사용자 확인):
--   - updated_at 자동갱신(BEFORE UPDATE) 트리거는 두지 않는다(정본 §2.2 주의).
--     동기화 LWW는 클라이언트가 명시 set한 updated_at을 기준으로 비교한다.
--     컬럼 default now()만 두고, 갱신은 클라이언트 책임.
--   - RLS 정책은 to authenticated + (select auth.uid()) 서브쿼리 래핑(플래너 캐싱, 정본 §3).
--   - 날짜/문자열은 타임존 변환 없이 그대로 저장(day date / entry_date date = 'YYYY-MM-DD' 키 안정성).
--   - PK id는 클라 생성 uuid(journal/drill/collected). grass는 자연키 (user_id, day).
-- ════════════════════════════════════════════════════════════════════════

-- ───────────────────────────── profiles ─────────────────────────────
-- auth.users 1:1. 언어 설정 등 계정 단위 환경설정 보관.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  lang        text not null default 'ko' check (lang in ('ko','en')),
  -- 마이그레이션 1회 제안 플래그(이미 제안/처리했는지)
  migrated_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ───────────────────────────── grass ────────────────────────────────
-- GrassMap(객체 date→count)을 행 기반으로 정규화. (user_id, day) 유일.
create table public.grass (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,             -- 'YYYY-MM-DD' (로컬 날짜 키 그대로)
  count      integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index grass_user_idx on public.grass (user_id);

-- ───────────────────────── journal_entries ──────────────────────────
create table public.journal_entries (
  id         uuid primary key,          -- 클라이언트 생성
  user_id    uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,             -- 'YYYY-MM-DD'
  title      text not null,
  minutes    integer not null default 0 check (minutes >= 0),
  chords     text[] not null default '{}',   -- 코드명 문자열 배열
  notes      text not null default '',
  deleted_at timestamptz,               -- tombstone
  updated_at timestamptz not null default now()
);
create index journal_user_idx on public.journal_entries (user_id);
create index journal_user_date_idx on public.journal_entries (user_id, entry_date desc);

-- ──────────────────────────── drills ────────────────────────────────
create table public.drills (
  id         uuid primary key,          -- 클라이언트 생성
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  target     integer not null default 5 check (target between 1 and 40),
  count      integer not null default 0 check (count >= 0),
  -- 후속(악보 연동) 슬롯: seq/sheet_id/time_sig — 지금은 jsonb로 자리 예약
  seq        jsonb,                     -- DrillSeqItem[] | null
  sheet_id   text,
  time_sig   text,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  sort_order integer not null default 0 -- 드릴 목록 순서 보존(현재 배열 push 순서)
);
create index drills_user_idx on public.drills (user_id);

-- ──────────────────────── collected_chords ──────────────────────────
-- 담은 코드. 'name'이 사용자 컬렉션 내 자연키(현재 중복 방지 키).
create table public.collected_chords (
  id         uuid primary key,          -- 클라이언트 생성
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,             -- 코드명 (예: 'Cmaj7')
  frets      jsonb not null,            -- FretArray: (number | 'x')[] length 6
  chord_key  text not null,             -- 현재 CollectedChord.key (= name)
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, name)                -- 사용자별 코드명 유일 (현 중복 방지 규칙)
);
create index collected_user_idx on public.collected_chords (user_id);

-- ════════════════════════════════════════════════════════════════════
-- RLS — 모든 테이블에 활성화. 읽기/쓰기 모두 "본인 행만".
-- (select auth.uid()) 서브쿼리 래핑(플래너 캐싱, 정본 §3).
-- soft-delete 행도 본인은 read/write 가능(클라가 tombstone을 보고 로컬에서 제거).
-- ════════════════════════════════════════════════════════════════════

-- ─── profiles (user_id가 아니라 id가 본인 식별자) ───
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select
  to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert
  to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update
  to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ─── grass ───
alter table public.grass enable row level security;
create policy "grass_select_own" on public.grass for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "grass_insert_own" on public.grass for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "grass_update_own" on public.grass for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "grass_delete_own" on public.grass for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ─── journal_entries ───
alter table public.journal_entries enable row level security;
create policy "journal_select_own" on public.journal_entries for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "journal_insert_own" on public.journal_entries for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "journal_update_own" on public.journal_entries for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "journal_delete_own" on public.journal_entries for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ─── drills ───
alter table public.drills enable row level security;
create policy "drills_select_own" on public.drills for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "drills_insert_own" on public.drills for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "drills_update_own" on public.drills for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "drills_delete_own" on public.drills for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ─── collected_chords ───
alter table public.collected_chords enable row level security;
create policy "collected_select_own" on public.collected_chords for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "collected_insert_own" on public.collected_chords for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "collected_update_own" on public.collected_chords for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "collected_delete_own" on public.collected_chords for delete
  to authenticated using ((select auth.uid()) = user_id);

-- ════════════════════════════════════════════════════════════════════
-- 신규 가입 시 profiles 행 자동 생성 (정본 §3)
-- security definer + set search_path = '' (RLS 우회 + search_path 주입 방어).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, lang) values (new.id, 'ko')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
