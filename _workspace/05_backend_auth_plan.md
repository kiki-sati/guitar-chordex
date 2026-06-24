# 설계: 연습 데이터 영속화 + 인증 + 동기화 백엔드 도입 (Supabase)

> 산출물: `_workspace/05_backend_auth_plan.md`
> 대상: implementer (PR① 즉시 착수 가능 수준), qa-verifier (검증 경계면)
> 전제: 기존 MVP(`_workspace/01_architect_plan.md`)는 완성·검증됨(108 테스트 통과). 본 문서는 그 위에 백엔드를 **점진 도입**하는 증분 설계다.
> **확정 결정**: 백엔드=Supabase, 인증=로그인 필수(Apple+Google+이메일), Git=GitHub PR(작업단위 분기), 플랫폼=웹+iOS+Android(Capacitor 8), 개발환경=Windows(iOS 빌드는 Mac 필요).

조사 반영(2026-06, context7 Supabase/Capacitor 최신):
- 모바일은 **`signInWithIdToken`(네이티브 sign-in)** 우선 — 웹뷰 OAuth 왕복 없이 네이티브 시트로 ID 토큰 획득 후 교환. (웹뷰 OAuth는 Google이 비권장 + UX 저하.)
- 웹뷰 OAuth가 필요한 경우(이메일 매직링크 콜백, 일부 provider): **`signInWithOAuth({ skipBrowserRedirect: true })` → `@capacitor/browser`로 외부 브라우저 오픈 → 딥링크(`appUrlOpen`)로 토큰 회수 → `setSession`**.
- 클라이언트는 **`flowType: 'pkce'`** + 커스텀 `storage` 어댑터(모바일=Preferences, 웹=localStorage).
- RLS 정책은 **`(select auth.uid()) = user_id`** 패턴(서브쿼리 래핑이 플래너 캐싱으로 성능 유리).

---

## 1. 목표 / 수용 기준

### 1.1 목표
1. **영속성 신뢰**: 앱 재설치·기기 변경·캐시 삭제 후에도 로그인하면 연습 데이터(잔디/일지/드릴/담은코드/언어)가 그대로 복원된다.
2. **기기 간 동기화**: 같은 계정으로 기기 A에서 기록한 연습이 기기 B에 반영된다(온라인 시).
3. **로그인 필수 첫 진입**: 미인증 사용자는 앱 본 화면(홈/사전/스케일/연습)에 접근할 수 없고 로그인 게이트만 본다.
4. **오프라인 우선**: 오프라인에서도 앱은 완전히 동작하고(로컬 캐시), 온라인 복귀 시 자동 동기화된다.
5. **기존 동작 보존**: 백엔드 도입 후에도 기존 도메인 로직·UI·테스트(108개)는 회귀 없이 동작한다.

### 1.2 수용 기준 (AC) — `[QA]` = qa-verifier 검증 대상
- [ ] **AC-1** 미로그인 상태로 앱 진입 시 로그인 게이트(`AuthGate`)만 렌더되고 `<AppProvider>` 하위 본 화면은 마운트되지 않는다. [QA: 라우팅 게이트]
- [ ] **AC-2** Google/Apple/이메일 중 하나로 로그인하면 게이트가 사라지고 본 화면이 뜬다. 새로고침해도 세션이 유지된다(로그인 화면 재노출 없음). [QA: 세션 영속]
- [ ] **AC-3** 로그인 후 잔디+1/일지작성/드릴체크/담기 등 모든 변경이 (a) 로컬 캐시에 즉시 반영되고 (b) 온라인이면 Supabase에 반영된다. [QA: 동기화 푸시]
- [ ] **AC-4** 기기 A에서 기록 → 기기 B에서 같은 계정 로그인 → A의 데이터가 B에 나타난다. [QA: 동기화 풀]
- [ ] **AC-5** 오프라인에서 변경 → 변경이 로컬 큐에 쌓임 → 온라인 복귀 시 자동 푸시되어 서버에 반영된다(데이터 유실 없음). [QA: 오프라인 큐]
- [ ] **AC-6** 다른 사용자(B)는 사용자(A)의 행을 read/write할 수 없다(RLS). [QA: RLS]
- [ ] **AC-7** 기존 기기에 localStorage 데이터가 있는 사용자가 첫 로그인하면 "이 기기의 기존 기록을 계정으로 가져올까요?" 1회 제안을 받고, 수락 시 머지된다. [QA: 마이그레이션]
- [ ] **AC-8** Repository 인터페이스 단위테스트(인메모리 mock)와 기존 108 테스트가 모두 통과한다(`npm test`). [QA: 회귀]
- [ ] **AC-9** iOS에서 "Apple로 로그인"이 동작한다(App Store 규정 준수). Android에서 Google 네이티브 로그인이 동작한다. [QA: 네이티브 인증 — 디바이스 수동]
- [ ] **AC-10** 잔디 같은 누적 카운트가 양쪽 기기에서 동시 증가해도 충돌 머지 후 더 큰(또는 합리적) 값으로 보존된다(§6 머지 전략). [QA: 충돌 시나리오]
- [ ] **AC-11** `SUPABASE_URL`/`ANON_KEY` 미설정 시 빌드/테스트는 실패하지 않고, 앱은 명확한 설정 안내 또는 로컬 전용 모드로 동작한다(개발 편의). [QA: env 부재 graceful]

---

## 2. 데이터 모델 (Postgres 스키마)

### 2.1 설계 원칙
- 모든 사용자 데이터 테이블은 `user_id uuid not null references auth.users(id) on delete cascade`를 가진다.
- **레코드별 `updated_at timestamptz not null default now()`** — 동기화 LWW(last-write-wins) 비교 기준.
- **소프트 삭제 컬럼 `deleted_at timestamptz`** — 일지/드릴/담은코드처럼 "삭제"가 있는 엔티티는 tombstone으로 처리해야 기기 간 삭제 전파가 가능(하드 delete만 쓰면 오프라인 기기가 삭제된 행을 다시 push해 부활시킴).
- 클라이언트가 행 id를 생성(현재 코드가 `'j'+Date.now()`, `'d'+Date.now()` 사용) → **PK를 `text` 또는 client-generated `uuid`로**. **권장: PK를 `id uuid`로 통일하고, 클라이언트는 `crypto.randomUUID()`로 생성**(드릴/일지). 기존 시드 id(`s1`,`d1`)와 충돌 없게 마이그레이션 시 재발급.
- 타임스탬프/원본 날짜 문자열(`YYYY-MM-DD`)은 서버에서도 **문자열 그대로** 저장(타임존 변환 금지 — 잔디 날짜 키 안정성).

### 2.2 테이블 정의

```sql
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
```

#### `updated_at` 자동 갱신 트리거(선택, 권장)
서버가 직접 쓰는 일은 없지만 안전망으로:
```sql
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_touch_grass        before update on public.grass            for each row execute function public.touch_updated_at();
create trigger trg_touch_journal      before update on public.journal_entries  for each row execute function public.touch_updated_at();
create trigger trg_touch_drills       before update on public.drills           for each row execute function public.touch_updated_at();
create trigger trg_touch_collected    before update on public.collected_chords for each row execute function public.touch_updated_at();
create trigger trg_touch_profiles     before update on public.profiles         for each row execute function public.touch_updated_at();
```
> **주의(동기화 충돌 비교용 updated_at)**: 트리거가 항상 `now()`로 덮으면 클라이언트가 보낸 `updated_at`(충돌 비교 기준)이 손실된다. → **동기화에 쓰는 `updated_at`은 클라이언트가 명시 set하고, 위 트리거는 `grass.count`처럼 서버 시각이 더 적절한 경우에만 쓰거나, 트리거 대신 클라이언트 set을 신뢰**한다. **권장: 트리거를 두지 말고 클라이언트가 `updated_at`을 명시적으로 보낸다**(§6 LWW가 클라 타임스탬프 기준이어야 일관). 본 설계는 **트리거 미사용** 채택.

### 2.3 기존 TS 타입 ↔ Postgres 행 매핑

| 도메인 타입 (`src/domain/types.ts`) | 표현 | Postgres |
|---|---|---|
| `GrassMap = Record<string,number>` | 객체 `{ '2026-06-24': 3 }` | `grass` 행들 `{day, count}` (객체 ↔ 행 변환 필요) |
| `JournalEntry {id,date,title,minutes,chords[],notes}` | 배열 요소 | `journal_entries` (date→entry_date) |
| `Drill {id,title,target,count,seq?,sheetId?,timeSig?}` | 배열 요소 | `drills` (sheetId→sheet_id, timeSig→time_sig) |
| `CollectedChord {name,frets,key}` | 배열 요소 (id 없음!) | `collected_chords` (key→chord_key, **id 신규 부여**) |
| `lang: 'ko'\|'en'` | 스칼라 | `profiles.lang` |

> **CollectedChord에 id가 없는 문제**: 현재 타입은 `name`을 자연키로 쓴다. 서버는 `(user_id,name)` unique로 받지만 동기화/tombstone을 위해 행 PK `id`가 필요하다. → **로컬→서버 매핑 시 `name` 기준 upsert**(`on conflict (user_id,name)`)로 처리하면 클라가 id를 몰라도 됨. tombstone(삭제 전파)은 name 기준으로 처리. (도메인 타입 `CollectedChord`는 **변경하지 않음** — 경계면 안정.)

### 2.4 GrassMap(객체) ↔ 행 기반 변환 전략 (핵심)

**문제**: 클라이언트 상태/도메인은 `GrassMap`(객체, 날짜→횟수). 서버는 `grass` 행(`day,count`). 변환 계층이 명확해야 한다.

```typescript
// src/sync/mappers.ts (신규)
import type { GrassMap } from '../domain/types';

export interface GrassRow { day: string; count: number; updated_at: string; }

/** GrassMap 객체 → 행 배열 (push 시). updatedAt은 호출자가 일괄 부여. */
export function grassMapToRows(map: GrassMap, updatedAt: string): GrassRow[] {
  return Object.entries(map).map(([day, count]) => ({ day, count, updated_at: updatedAt }));
}

/** 행 배열 → GrassMap 객체 (pull 시). count>0만(현 seed 규칙과 일관). */
export function grassRowsToMap(rows: GrassRow[]): GrassMap {
  const map: GrassMap = {};
  for (const r of rows) if (r.count > 0) map[r.day] = r.count;
  return map;
}
```

> **변경 추적**: 매 push마다 전체 GrassMap을 행으로 보내면 비효율 + LWW 충돌 위험. → **dirty day 집합만 추적**(§5 RepoChange). 잔디는 보통 "오늘 하루"만 바뀌므로 `bumpToday` 결과의 today day 하나만 upsert하면 충분(§6에서 per-day 머지 논의).

---

## 3. RLS 정책

모든 테이블에 RLS 활성화. 정책은 **읽기/쓰기 모두 "본인 행만"**. `(select auth.uid())` 서브쿼리 래핑(플래너 캐싱). soft delete 행도 본인은 read/write 가능(클라가 tombstone을 보고 로컬에서 제거).

```sql
-- ─── profiles ───
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select
  to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert
  to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update
  to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ─── 공통 매크로 패턴: grass / journal_entries / drills / collected_chords ───
-- (아래는 grass 예시. 나머지 3개는 테이블명만 교체해 동일 적용.)
alter table public.grass enable row level security;
create policy "grass_select_own" on public.grass for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "grass_insert_own" on public.grass for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "grass_update_own" on public.grass for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "grass_delete_own" on public.grass for delete
  to authenticated using ((select auth.uid()) = user_id);

-- journal_entries
alter table public.journal_entries enable row level security;
create policy "journal_select_own" on public.journal_entries for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "journal_insert_own" on public.journal_entries for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "journal_update_own" on public.journal_entries for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "journal_delete_own" on public.journal_entries for delete
  to authenticated using ((select auth.uid()) = user_id);

-- drills
alter table public.drills enable row level security;
create policy "drills_select_own" on public.drills for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "drills_insert_own" on public.drills for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "drills_update_own" on public.drills for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "drills_delete_own" on public.drills for delete
  to authenticated using ((select auth.uid()) = user_id);

-- collected_chords
alter table public.collected_chords enable row level security;
create policy "collected_select_own" on public.collected_chords for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "collected_insert_own" on public.collected_chords for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "collected_update_own" on public.collected_chords for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "collected_delete_own" on public.collected_chords for delete
  to authenticated using ((select auth.uid()) = user_id);
```

#### profiles 자동 생성(신규 가입 시)
신규 유저 가입 시 profiles 행을 자동 생성:
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, lang) values (new.id, 'ko')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
```

[QA 경계면 B1 — RLS]: 두 테스트 유저 A/B로 각 테이블에 대해 (a) A는 자기 행 CRUD 가능, (b) B는 A의 행 select 0건·update/delete 영향 0행·insert(user_id=A) 거부. SQL 또는 supabase-js 통합 테스트로 검증.

---

## 4. 인증 설계

### 4.1 제공자/방식 매트릭스

| 플랫폼 | Google | Apple | 이메일 |
|---|---|---|---|
| 웹 | `signInWithOAuth({provider:'google'})` (리다이렉트) | `signInWithOAuth({provider:'apple'})` | 매직링크 또는 비번 (`signInWithOtp`/`signInWithPassword`) |
| iOS | 네이티브 `signInWithIdToken` (Google Sign-In SDK) 권장, OAuth 폴백 | **네이티브 Sign in with Apple (필수)** `signInWithIdToken` | OTP 매직링크(딥링크 콜백) 또는 비번 |
| Android | 네이티브 `signInWithIdToken` (Credential Manager) 권장, OAuth 폴백 | OAuth(웹) — Android엔 Apple 네이티브 없음 | OTP/비번 |

> **결정**: MVP 백엔드 단계에서 **웹 = 표준 OAuth 리다이렉트 + 이메일**을 먼저 (PR④), **네이티브 = signInWithIdToken/딥링크 OAuth**를 나중(PR⑥). iOS의 "Apple로 로그인" 네이티브는 PR⑥에서 필수 처리.

### 4.2 Supabase 클라이언트 구성 (플랫폼별 storage + PKCE)

```typescript
// src/lib/supabase.ts (신규)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// 모바일: @capacitor/preferences 어댑터(웹뷰 localStorage는 OS가 비울 수 있음)
const nativeStorage = {
  getItem: async (k: string) => (await Preferences.get({ key: k })).value,
  setItem: async (k: string, v: string) => { await Preferences.set({ key: k, value: v }); },
  removeItem: async (k: string) => { await Preferences.remove({ key: k }); },
};

export const isSupabaseConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anon!, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: !Capacitor.isNativePlatform(), // 웹만 URL 자동 감지
        storage: Capacitor.isNativePlatform() ? (nativeStorage as never) : undefined, // 웹=기본 localStorage
      },
    })
  : null;
```
> `isSupabaseConfigured`가 false면(env 미설정) 앱은 **로컬 전용 모드**로 동작(AC-11) — `LocalRepo`만 사용, AuthGate는 "백엔드 미설정" 안내 또는 게스트 진입(개발 편의). 프로덕션 빌드는 env 필수.

### 4.3 웹 OAuth 흐름 (PR④)
1. AuthGate에서 "Google로 계속"/"Apple로 계속" 클릭 → `supabase.auth.signInWithOAuth({ provider, options:{ redirectTo: window.location.origin } })`.
2. provider 동의 → Supabase 콜백 → 앱으로 리다이렉트(`detectSessionInUrl`이 토큰 처리).
3. `supabase.auth.onAuthStateChange`가 `SIGNED_IN` 발화 → AuthGate가 세션을 감지하고 본 화면 렌더.

이메일(매직링크): `signInWithOtp({ email, options:{ emailRedirectTo: origin } })` → 메일 링크 클릭 → 콜백. (비번 방식 택1 가능; 매직링크가 비번 관리 부담 적어 권장.)

### 4.4 Capacitor(iOS/Android) OAuth의 까다로운 부분 (PR⑥)

**왜 어려운가**: 네이티브 웹뷰는 `window.location` 리다이렉트로 토큰을 못 받는다. provider는 등록된 redirect로만 돌아오고, 앱은 그걸 **커스텀 URL 스킴 딥링크**로 받아야 한다. PKCE라 code↔verifier 교환도 필요.

#### (A) 권장: 네이티브 sign-in (`signInWithIdToken`) — 웹뷰 OAuth 회피
- **Apple (iOS 필수)**: `@capacitor-community/apple-sign-in` 플러그인으로 네이티브 Apple 시트 → identityToken(+nonce) 획득 → `supabase.auth.signInWithIdToken({ provider:'apple', token: identityToken, nonce })`.
- **Google (iOS/Android)**: `@codetrix-studio/capacitor-google-auth` 또는 `@capgo/capacitor-social-login` 으로 네이티브 시트 → idToken 획득 → `signInWithIdToken({ provider:'google', token: idToken })`.
- 장점: 시스템 계정 시트(웹뷰 없음), UX 우수, Google 정책 준수. **iOS Apple은 이 방식이 사실상 필수.**

#### (B) 폴백: 웹 OAuth + @capacitor/browser + 딥링크
네이티브 SDK가 없는 provider/케이스(이메일 매직링크 콜백 포함):
```typescript
// 1) skipBrowserRedirect로 URL만 받기
const { data } = await supabase.auth.signInWithOAuth({
  provider, options: { redirectTo: 'com.chordsalon.app://auth-callback', skipBrowserRedirect: true },
});
// 2) 외부 브라우저로 오픈 (@capacitor/browser)
await Browser.open({ url: data.url });
// 3) 딥링크 콜백 수신 (@capacitor/app — 이미 의존성에 있음)
App.addListener('appUrlOpen', async ({ url }) => {
  await Browser.close();
  // PKCE code 추출 → 세션 교환
  const code = new URL(url).searchParams.get('code');
  if (code) await supabase.auth.exchangeCodeForSession(code);
  // (구형 implicit 토큰 해시 케이스는 access_token/refresh_token 파싱 → setSession)
});
```

#### (C) 딥링크/스킴 설정 (네이티브 빌드 필수 — Mac에서 iOS)
- **iOS** `Info.plist`: `CFBundleURLTypes`에 스킴 `com.chordsalon.app` 등록.
- **Android** `strings.xml`: `<string name="custom_url_scheme">com.chordsalon.app</string>` + Manifest `intent-filter`(BROWSABLE, `android:scheme="@string/custom_url_scheme"`).
- Supabase Dashboard → Auth → URL Configuration → **Redirect URLs**에 `com.chordsalon.app://auth-callback` 추가(웹 origin도 함께).
- provider 콘솔(Apple/Google)에도 동일 redirect/번들ID 등록(§9).

### 4.5 로그인 게이트 UI 위치 (첫 진입)

```
main.tsx
  └─ <AuthProvider>            (신규: 세션 상태·로그인 메서드 제공)
       └─ <AuthGate>           (신규: 세션 없으면 로그인 화면, 있으면 children)
            └─ <AppProvider>   (기존: 세션이 있어야만 마운트 → user 종속 데이터 로드)
                 └─ <App/>     (기존)
```
- **핵심**: `<AppProvider>`는 `<AuthGate>` 통과(=세션 존재) 후에만 마운트된다. 따라서 AppProvider의 초기화(`load()`)가 "현재 user의 데이터"를 로드하도록 자연스럽게 보장된다(§5).
- AuthGate 상태: `loading`(세션 확인 중 스플래시) / `unauthenticated`(로그인 폼) / `authenticated`(children). 초기 `getSession()` + `onAuthStateChange` 구독.

### 4.6 세션 영속/갱신
- 웹: 기본 localStorage. 모바일: Preferences 어댑터(4.2). `autoRefreshToken: true`로 만료 토큰 자동 갱신.
- 모바일 포그라운드 복귀 시 토큰 갱신 보장: `App.addListener('appStateChange', ({isActive}) => { if (isActive) supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh(); })`.
- 로그아웃: `supabase.auth.signOut()` → onAuthStateChange `SIGNED_OUT` → AuthGate가 로컬 캐시 정리(현 user 키) 후 로그인 화면.

[QA 경계면 B2 — 세션 영속]: 로그인 후 재마운트(새로고침/앱 재시작)에 세션 복원되어 로그인 화면 미노출. signOut 후 세션 제거·로컬 캐시 정리.

---

## 5. 영속화 추상화 설계 (Repository)

### 5.1 동기
현재 `persist.ts`가 localStorage를 직접 만진다(`load`/`save`). 백엔드를 끼우려면 이 경계를 **인터페이스 뒤로** 숨겨 `LocalRepo`/`SupabaseRepo`/`SyncRepo`를 교체 가능하게 한다. AppContext/reducer는 인터페이스만 알면 된다.

### 5.2 핵심 인터페이스 (데이터 계약)

```typescript
// src/state/repo/types.ts (신규)
import type { PersistedState } from '../persist';
//   PersistedState = { grass: GrassMap; journal: JournalEntry[];
//                      collected: CollectedChord[]; drills: Drill[]; lang: 'ko'|'en' }

/** 변경 단위(엔티티별). reducer 결과 diff를 큐/푸시로 보낼 때 사용. */
export type RepoChange =
  | { kind: 'grass';     day: string; count: number }
  | { kind: 'journal';   op: 'upsert' | 'delete'; entry: JournalEntry }   // delete는 id만 유효
  | { kind: 'drill';     op: 'upsert' | 'delete'; drill: Drill }
  | { kind: 'collected'; op: 'upsert' | 'delete'; chord: CollectedChord } // delete는 name 기준
  | { kind: 'lang';      lang: 'ko' | 'en' };

export interface Repository {
  /** 전체 영속 상태 로드(앱 시작/로그인 직후). 없으면 빈 상태 또는 seed 정책에 따름. */
  load(): Promise<PersistedState>;
  /** 변경 묶음 반영. Local=즉시 캐시 기록, Supabase=upsert, Sync=캐시+큐. */
  apply(changes: RepoChange[]): Promise<void>;
  /** (Sync 전용, 선택) 강제 동기화 트리거. Local/Supabase는 no-op 가능. */
  flush?(): Promise<void>;
}
```

> **계약 포인트**: AppContext는 `save(partial)`(현행) 대신 **`repo.apply(changes)`** 를 호출한다. reducer는 순수 유지(변경 없음). "어떤 changes가 발생했는가"는 **dispatch 래퍼/미들웨어**가 액션→RepoChange로 매핑하거나(권장), 또는 Provider가 이전 state와 비교(diff)해 산출. **권장: 액션→change 매퍼**(명시적, 테스트 용이).

```typescript
// src/state/repo/actionToChanges.ts (신규) — 예시 매핑
// (액션, 이전상태, 이후상태) → RepoChange[]
// 예) LOG_PRACTICE → [{kind:'grass', day:today, count:next.grass[today]}]
//     ADD_JOURNAL  → [{kind:'journal',op:'upsert',entry:newEntry},{kind:'grass',...}]
//     SET_DRILL_COUNT(달성) → [{kind:'drill',op:'upsert',drill},{kind:'grass',...}]
//     REMOVE_DRILL → [{kind:'drill',op:'delete',drill:{id}}]
//     REMOVE_COLLECTED → [{kind:'collected',op:'delete',chord:{name}}]
//     SET_LANG → [{kind:'lang',lang}]
```

### 5.3 구현체

```
src/state/repo/
  types.ts            # Repository, RepoChange (위)
  localRepo.ts        # 현 persist.ts 로직을 인터페이스로 래핑 (user-scoped 키)
  supabaseRepo.ts     # supabase-js CRUD (mappers.ts 사용)
  syncRepo.ts         # LocalRepo(캐시) + 큐 + SupabaseRepo(원격) 조합 = 오프라인 우선
  memoryRepo.ts       # 테스트용 인메모리 mock
```

- **LocalRepo**: 현 `persist.ts`의 load/save를 그대로 이식하되 **키를 user별로 네임스페이스**: `cs_grass` → `cs:{userId}:grass`. (로그아웃/멀티계정 충돌 방지. 비로그인 로컬 모드는 `cs:local:*` 또는 기존 키 유지.) `apply(changes)`는 changes를 PersistedState에 머지 후 저장.
- **SupabaseRepo**: `load()` = 5개 테이블 select(+ deleted_at is null 필터) → mappers로 PersistedState 조립. `apply()` = change별 upsert/soft-delete(`update set deleted_at=now()`).
- **SyncRepo**(오프라인 우선, §6): `load()` = 로컬 캐시 즉시 반환 후 백그라운드 풀; `apply()` = 로컬 캐시 즉시 기록 + 큐 적재 + (온라인 시) 푸시.

### 5.4 AppContext 경계면 변경

```typescript
// AppContext: useEffect(save) 제거 → repo 주입 + apply 호출
// 1) repo는 AuthGate에서 결정(세션 있으면 SyncRepo(user), 없으면 LocalRepo(local))
//    → <AppProvider repo={repo} initial={loaded}>
// 2) 초기 state: repo.load() 결과로 lazy init (현 load() 대체).
//    load는 비동기이므로 AuthGate에서 await 후 initial로 주입(또는 Provider 내 useEffect 로딩 상태).
// 3) dispatch 래퍼: wrappedDispatch(action) = { const next = dispatch(action);
//      const changes = actionToChanges(action, prev, next); void repo.apply(changes); }
//    (실제로는 reducer 결과를 알아야 changes 산출 → Provider에서 prev/next 비교 또는 매퍼에 next 전달)
```

> **비동기 load 처리**: 현재 `useReducer(reducer, undefined, () => initState(load()))`는 동기. SupabaseRepo.load는 비동기 → **AuthGate가 세션 확정 후 `repo.load()`를 await하여 `initialState`를 AppProvider에 prop으로 주입**. 로딩 중 스플래시. (또는 Provider가 `null` 초기 후 effect로 채우고 로딩 가드 — prop 주입이 더 단순.)

[QA 경계면 B3 — Repository 계약]: `memoryRepo`로 load→apply(changes)→load 라운드트립이 PersistedState 동치. `actionToChanges`가 각 액션에 대해 기대 change 배열 산출(특히 잔디+1 동반 액션, soft delete).

[QA 경계면 B4 — AppContext 통합]: dispatch → repo.apply 호출됨(mock spy). 기존 reducer 동작/토스트/잔디 로직 회귀 없음.

---

## 6. 동기화 엔진 설계 (SyncRepo)

### 6.1 구성요소
```
src/sync/
  queue.ts        # 오프라인 변경 큐 (로컬 캐시 키 cs:{uid}:queue)
  syncEngine.ts   # pull/push/머지 오케스트레이션
  mappers.ts      # grassMapToRows 등 (§2.4)
  net.ts          # 온라인 감지 (navigator.onLine + @capacitor/network 후속)
```

### 6.2 변경 큐 (오프라인)
- `apply(changes)`가 호출되면: (1) 로컬 캐시에 즉시 머지(낙관적), (2) 각 change에 `queuedAt`(클라 타임스탬프) 부여해 큐에 append.
- 큐 항목 형태: `{ change: RepoChange, updatedAt: string /* ISO, LWW 기준 */, id: string }`.
- 온라인이면 즉시 flush 시도; 실패(네트워크)면 큐 잔류. 온라인 복귀(`window 'online'` 이벤트 / appStateChange) 시 flush 재시도.
- **멱등성**: 같은 change 재전송 안전해야 함 → 모두 upsert(`on conflict do update`) 기반. grass는 `(user_id,day)` upsert, journal/drill `id` upsert, collected `(user_id,name)` upsert.

### 6.3 로그인 직후 초기 동기화 (pull → push)
1. **Pull**: `SupabaseRepo.load()`로 서버 상태 가져옴.
2. **Merge**: 로컬 캐시 + 큐(미전송 변경) + 서버 상태를 머지(아래 6.4).
3. **Push**: 큐의 미전송 변경 + 머지로 갱신된 행을 서버에 upsert.
4. 머지 결과를 로컬 캐시 + AppState에 반영(AuthGate가 initial로 주입).

### 6.4 충돌 해소 (레코드별)

기본 원칙: **레코드별 `updated_at` LWW(last-write-wins)**. 단, **누적 카운트(grass/drill.count)는 LWW가 데이터 손실을 일으키므로 특수 머지**.

| 엔티티 | 머지 규칙 | 근거 |
|---|---|---|
| `journal_entries` | `updated_at` LWW (행 단위). `deleted_at` 있으면 삭제 우선(또는 LWW로 삭제 vs 수정 비교). | 일지는 독립 레코드, 동시 편집 드묾 |
| `drills` (title/target) | `updated_at` LWW | 메타데이터 |
| `drills.count` / `grass.count` | **per-record max + 재기준선 전략** (아래) | 누적 카운트 — 손실 방지 |
| `collected_chords` | name 기준 존재여부 합집합; `deleted_at` LWW로 삭제 반영 | 컬렉션은 집합 의미 |
| `lang` (profiles) | `updated_at` LWW | 단일 설정 |

#### 누적 카운트 머지 — grass(잔디) 주의
단순 LWW면 위험: 기기 A가 오프라인에서 오늘 +3(로컬 3), 기기 B가 온라인에서 +2(서버 2). A가 나중에 동기화하면 LWW로 서버 2를 3으로 덮음 → B의 +2 중 일부 손실.

**채택안(권장): per-day `max(local, server)` + "오늘만 합산 가능"**.
- 일반 규칙: `merged.count = max(local.count, server.count)` (per day). 과거 날짜는 변하지 않으므로 max로 충분(재설치 후 로컬 0 vs 서버 N → N 보존).
- **단점**: 같은 날 두 기기에서 진짜로 각각 +N 한 경우 합산이 아니라 큰 쪽만 — 소폭 과소 집계 가능. 잔디는 "그날 연습했나" 시각화가 본질이라 **max로 충분히 수용 가능**(레벨 0~4 버킷이라 정확 합산 불필요).
- **대안(정밀):** 잔디를 카운트가 아니라 **이벤트 로그 테이블**(`practice_events(user_id, occurred_at)`)로 두고 서버에서 day별 집계 → 합산 정확·충돌 없음. **트레이드오프**: 스키마/마이그레이션 복잡, 현 GrassMap 모델과 거리. → **본 설계는 max 채택, 이벤트 로그는 후속 옵션으로 명기**.

drill.count도 동일하게 `max`(목표 달성 후 0 리셋은 `RESET_DRILLS` → updated_at 갱신된 명시적 0이므로, count 머지는 "updated_at이 더 최신이면 그 값, 동률이면 max" 규칙으로 리셋 의도 보존).

### 6.5 푸시 최소화
- 잔디는 변경된 day만 upsert(전체 GrassMap push 금지).
- 디바운스: 연속 변경(드릴 연타) 시 200~500ms 디바운스 후 batch upsert(선택, 성능). MVP는 change별 즉시 + 실패 재큐로 충분.

[QA 경계면 B5 — 동기화]: (a) 오프라인 apply → 큐 적재 → online 이벤트 → 서버 upsert 호출(mock). (b) pull+로컬 머지: grass per-day max, journal LWW, collected 합집합, soft-delete 반영. (c) 멱등: 같은 change 2회 apply → 서버 상태 1회와 동일.

---

## 7. 로그인 필수 전환의 영향 (seed / 마이그레이션)

### 7.1 seed 정책 변경
- 현재 `seed.ts`는 **비로그인 데모 데이터**(첫 방문 시 localStorage 채움). 로그인 필수가 되면 이 데모는 부적절(실제 유저 데이터와 섞임).
- **결정**: **신규 가입 유저는 빈 상태로 시작**(서버 데이터 0건 → 빈 GrassMap/journal/drills/collected, lang='ko'). seed 데모는 제거하거나 "둘러보기(게스트/로컬 모드)"에서만 사용.
- **근거**: 실제 사용자에게 가짜 연습 기록을 주는 것은 데이터 신뢰성을 해친다. 빈 상태 + 온보딩 안내(예: "첫 드릴을 추가해보세요")가 적절.
- `seedGrass/seedJournal/seedDrills/seedCollected`는 **삭제하지 않고** 게스트/로컬 모드 또는 스토리북/테스트 픽스처로 보존(기존 persist 테스트 호환). LocalRepo(local 모드)에서만 seed 적용.

### 7.2 기존 기기 localStorage 마이그레이션 (1회 제안)
- **시나리오**: MVP를 로컬로 써온 사용자가 백엔드 버전으로 업데이트 → 첫 로그인. 기존 `cs_grass` 등 localStorage에 데이터 존재.
- **결정(권장)**: 첫 로그인 시 `cs_grass`/`cs_journal`/`cs_drills`/`cs_collected`(기존 키, user prefix 없는) 존재 + `profiles.migrated_at` null 이면 **1회 모달**: "이 기기에 저장된 기존 연습 기록을 계정으로 가져올까요?" [가져오기 / 새로 시작].
  - 가져오기: 기존 localStorage 데이터를 RepoChange로 변환 → SyncRepo.apply(서버 머지 §6.4) → `profiles.migrated_at = now()` set → 기존 키 정리(또는 백업 후 삭제).
  - 새로 시작: `migrated_at` set만(재제안 방지). 기존 키는 보존(롤백 대비) 또는 정리.
- 시드 데이터(`s1/s2/s3`,`d1~d4`)와 실제 데이터 구분: 마이그레이션 시 시드 id 그대로 가져오되 서버에선 신규 uuid 재발급(2.1).

[QA 경계면 B6 — 마이그레이션]: 기존 키 존재 + migrated_at null → 제안 트리거. 가져오기 → 서버에 기존 데이터 반영 + migrated_at set + 재제안 안 됨. 새 가입(기존 키 없음) → 제안 안 뜸·빈 상태.

---

## 8. 작업단위 PR 분해

> 각 PR은 **독립 빌드/테스트 가능**(`npm run build` + `npm test` 그린). 브랜치 `feat/*` → PR → 머지. 순서는 의존성 기준.

### PR① `feat/repo-abstraction` — 영속화 추상화 (동작 동일 유지)
- **범위**: `src/state/repo/{types.ts,localRepo.ts,memoryRepo.ts}`, `actionToChanges.ts` 신규. AppContext가 `persist.save` 대신 `LocalRepo.apply` 사용하도록 리팩터. **외부 동작/UI/저장 키는 동일**(키는 기존 `cs_*` 유지 — 이 PR에선 user prefix 미도입).
- **수용기준**: 기존 108 테스트 전부 통과. 새 `memoryRepo`/`actionToChanges`/`localRepo` 단위테스트 추가. 앱 동작 무변화(localStorage 영속 그대로).
- **검증경계면**: B3(Repository 계약), B4(AppContext 통합).
- **의존성**: 없음 (첫 PR).
- **리스크**: 비동기 load 도입으로 초기화 흐름 변경 → 이 PR에선 LocalRepo.load를 동기 호환(Promise.resolve 래핑)으로 두고 AuthGate 도입(PR④)에서 비동기 처리.

### PR② `feat/supabase-client` — Supabase 프로젝트 + 클라이언트 + env
- **범위**: `@supabase/supabase-js` 설치, `src/lib/supabase.ts`(§4.2), `.env.example`(VITE_SUPABASE_URL/ANON_KEY), `.gitignore`에 `.env*` 확인, `vite-env.d.ts`에 env 타입. `isSupabaseConfigured` 가드.
- **수용기준**: env 없어도 build/test 통과(AC-11). `isSupabaseConfigured` 분기 단위테스트. 클라이언트 import 시 크래시 없음.
- **검증경계면**: env 부재 graceful.
- **의존성**: 없음(PR①과 병렬 가능, 단 머지 순서는 ① 먼저 권장).
- **사전 준비물**: 사용자가 Supabase 프로젝트 생성 + URL/anon key 발급(§9).

### PR③ `feat/db-schema-rls` — 스키마 + RLS (SQL 마이그레이션)
- **범위**: `supabase/migrations/0001_init.sql`(§2 테이블 + §3 RLS + handle_new_user 트리거). `supabaseRepo.ts`(load/apply CRUD) + `mappers.ts`(§2.4). `supabaseRepo` 단위테스트(mock supabase client) + (가능 시) RLS 통합테스트.
- **수용기준**: SQL이 Supabase에 적용됨(사용자/CI). `supabaseRepo.load`/`apply`가 mappers로 PersistedState ↔ 행 변환. RLS: A/B 유저 격리(B6 일부).
- **검증경계면**: B1(RLS), B3(Repository 계약 — supabaseRepo).
- **의존성**: PR② (클라이언트), PR① (Repository 인터페이스).

### PR④ `feat/web-auth-gate` — 웹 인증 + 로그인 게이트
- **범위**: `src/auth/{AuthProvider.tsx,AuthGate.tsx,LoginScreen.tsx}`. `signInWithOAuth`(Google/Apple) + 이메일(OTP). `onAuthStateChange`/`getSession`. main.tsx 트리 재구성(§4.5). AppProvider가 세션 후 마운트 + `repo.load()` await 후 initial 주입(비동기 초기화 확정). 로그아웃 버튼(헤더/사이드바).
- **수용기준**: AC-1, AC-2(웹). 미로그인→게이트, 로그인→본화면, 새로고침 세션 유지. RTL로 게이트 분기 테스트(세션 mock).
- **검증경계면**: B2(세션 영속), 라우팅 게이트.
- **의존성**: PR②③.
- **사전 준비물**: Google Cloud OAuth 클라이언트, Apple Sign in 설정, Supabase Auth provider 활성화(§9).

### PR⑤ `feat/sync-engine` — 동기화 엔진 + 마이그레이션
- **범위**: `src/sync/{queue.ts,syncEngine.ts,net.ts}`, `syncRepo.ts`(오프라인 우선). AuthGate가 세션 시 SyncRepo(user) 주입(LocalRepo 캐시는 user-prefix 키로 전환). 초기 pull→merge→push(§6.3). 충돌 머지(§6.4). 마이그레이션 모달(§7.2). seed 정책 전환(§7.1: 신규 유저 빈 상태).
- **수용기준**: AC-3,4,5,7,10. 오프라인 큐·재전송·per-day max 머지 단위테스트. 마이그레이션 제안/처리 테스트.
- **검증경계면**: B5(동기화), B6(마이그레이션).
- **의존성**: PR③④.

### PR⑥ `feat/native-auth` — Capacitor 네이티브 인증 (딥링크)
- **범위**: Apple 네이티브(`@capacitor-community/apple-sign-in`) + Google 네이티브(plugin) → `signInWithIdToken`. 폴백 OAuth + `@capacitor/browser` + `appUrlOpen` 딥링크(§4.4). iOS Info.plist/Android strings.xml/Manifest 스킴. appStateChange 토큰 갱신(§4.6). 모바일 storage 어댑터(Preferences — §4.2, 이미 supabase.ts에 포함).
- **수용기준**: AC-9. iOS "Apple로 로그인" 동작(디바이스 수동), Android Google 동작. 딥링크 콜백 세션 교환. (자동화 테스트는 어댑터/URL 파싱 단위테스트 한정 — 실기기 검증은 수동.)
- **검증경계면**: B2(네이티브 세션), 딥링크 URL 파싱.
- **의존성**: PR④⑤.
- **사전 준비물(가장 무거움)**: Apple Developer Program($99/년), iOS 빌드용 Mac, Sign in with Apple/Google iOS·Android 클라이언트, 번들ID·스킴·redirect 등록(§9).

```
의존성 그래프:
①repo ──┬─→ ③schema ──┬─→ ④web-auth ──┬─→ ⑤sync ──→ ⑥native
②client ┘             ┘               ┘
(① ② 병렬 가능 → ③ → ④ → ⑤ → ⑥)
```

---

## 9. 사용자(본인) 사전 준비물 — Claude가 대신 못 하는 것

> Claude는 코드/SQL/설정 파일을 작성할 수 있으나, **외부 콘솔 가입·결제·OAuth 클라이언트 발급·시크릿 값 입력·iOS 빌드(Mac)** 는 사용자가 직접 해야 한다.

### 9.1 Supabase (PR②③ 전)
- [ ] supabase.com 가입 → New Project 생성(리전: 한국 가까운 곳, 예 Tokyo). 무료 티어.
- [ ] Project Settings → API에서 **Project URL**과 **anon public key** 복사.
- [ ] 로컬 `.env` 작성: `VITE_SUPABASE_URL=...` / `VITE_SUPABASE_ANON_KEY=...` (깃 제외 확인). 배포 플랫폼(예 Vercel/Netlify) 환경변수에도 동일 입력.
- [ ] PR③의 `0001_init.sql`을 Supabase SQL Editor에 붙여 실행(또는 supabase CLI `db push`).

### 9.2 Google OAuth (PR④ 웹, PR⑥ 네이티브)
- [ ] Google Cloud Console → 프로젝트 → OAuth 동의 화면 구성.
- [ ] **웹용** OAuth 클라이언트 ID 생성. Authorized redirect URI에 Supabase 콜백 `https://<project>.supabase.co/auth/v1/callback` 추가.
- [ ] **iOS/Android용** OAuth 클라이언트 ID(네이티브 sign-in용) 별도 생성(번들ID/SHA-1 등록).
- [ ] Supabase Dashboard → Auth → Providers → Google 활성화 + 클라이언트ID/시크릿 입력.

### 9.3 Apple Sign in (PR④ 웹 일부, PR⑥ iOS 필수)
- [ ] **Apple Developer Program 가입($99/년)** — iOS 배포·Sign in with Apple 필수.
- [ ] Identifiers → App ID 생성(번들ID `com.chordsalon.app`) + "Sign in with Apple" capability.
- [ ] Services ID 생성(웹 OAuth용) + Return URL에 Supabase 콜백 등록.
- [ ] Key 생성(Sign in with Apple) → Key ID/Team ID/.p8 → Supabase Apple provider에 입력.
- [ ] Supabase Dashboard → Auth → Providers → Apple 활성화.

### 9.4 Supabase Auth URL 설정 (PR④⑥)
- [ ] Auth → URL Configuration → Site URL(웹 배포 URL) + **Redirect URLs**: 웹 origin, `com.chordsalon.app://auth-callback`.
- [ ] 이메일: Auth → Email 템플릿/매직링크 활성화(무료 티어 메일 발송 한도 확인).

### 9.5 네이티브 빌드 (PR⑥)
- [ ] **Mac 필요**(iOS 빌드/Xcode). Windows에서는 Android만 빌드 가능.
- [ ] iOS `Info.plist` 스킴, Android `strings.xml`/`AndroidManifest.xml` intent-filter (Claude가 파일은 작성하나 Xcode 서명/프로비저닝은 사용자).
- [ ] 네이티브 sign-in 플러그인 설치 후 `npx cap sync`.

---

## 10. 리스크 / 보안

| ID | 리스크 | 영향 | 완화 |
|---|---|---|---|
| S1 | anon key 클라 노출 | anon key는 공개 전제 | **RLS가 유일 방어선** — 모든 테이블 RLS 필수(§3), 테이블 default deny 확인. service_role key는 절대 클라/깃에 두지 않음 |
| S2 | `.env` 커밋 사고 | 시크릿 유출 | `.gitignore`에 `.env*`(키는 anon이라 치명 아님이나 위생). `.env.example`만 커밋 |
| S3 | 딥링크 하이재킹 | 다른 앱이 스킴 가로채 토큰 탈취 | PKCE(code↔verifier) 사용으로 code 단독 무용. 가능 시 Universal/App Links(도메인 검증)로 전환(후속). custom scheme은 차선 |
| S4 | 토큰 저장 위치 | 웹뷰 localStorage는 OS가 정리/취약 | 모바일=`@capacitor/preferences`(§4.2). 더 강한 보안 필요 시 후속 `secure-storage` 플러그인(Keychain/Keystore) |
| S5 | 무료 티어 한도 | DB 용량/대역/메일 발송/MAU 초과 | 데이터 작음(텍스트 위주). 매직링크 메일 한도 주의 → OAuth 우선. 모니터링. 초과 시 유료 전환 |
| S6 | 레이트리밋/남용 | 동기화 폭주 | change별 즉시 push 대신 디바운스/배치(§6.5). 큐 재시도 백오프 |
| S7 | 데이터 손실(머지) | 잔디/드릴 카운트 손실 | per-day/per-record max 머지(§6.4), 단순 LWW 금지(카운트). soft-delete로 삭제 전파 |
| S8 | 비동기 초기화 레이스 | 로딩 중 빈 상태 깜빡임/이중 로드 | AuthGate 로딩 가드(§4.5), repo.load await 후 AppProvider 마운트 |
| S9 | 멀티계정 캐시 혼선 | 로그아웃 후 이전 유저 데이터 노출 | 로컬 캐시 user-prefix 키(§5.3), signOut 시 현 user 키 정리 |

---

## 11. 테스트 전략

### 11.1 신규 단위테스트
- **memoryRepo**: load→apply→load 라운드트립 동치(B3). 모든 RepoChange 종류 반영.
- **actionToChanges**: 각 액션→기대 change[] (LOG_PRACTICE/ADD_JOURNAL/SET_DRILL_COUNT 달성·미달성/REMOVE_*/SET_LANG). 잔디 동반 케이스 명시.
- **mappers**: `grassMapToRows`/`grassRowsToMap` 라운드트립(count>0 필터), journal/drill/collected 행↔객체 매핑(snake/camel 변환).
- **localRepo**: user-prefix 키로 저장/로드, 비로그인 local 모드.
- **supabaseRepo**: mock supabase client로 load(select 호출·필터 deleted_at)/apply(upsert·soft-delete 호출) 검증.
- **syncEngine/queue**: 오프라인 apply→큐 적재, online 이벤트→flush 호출(mock), 멱등(2회 동일), 충돌 머지(grass per-day max / journal LWW / collected 합집합 / soft-delete).
- **supabase.ts 가드**: isSupabaseConfigured 분기.
- **deep link 파서**(PR⑥): 콜백 URL에서 code/token 추출 단위테스트.

### 11.2 RLS 정책 테스트 (B1)
- supabase-js 통합테스트(테스트 프로젝트 또는 로컬 supabase): 유저 A/B 세션으로 각 테이블 (a)본인 CRUD 성공, (b)타인 행 select 0·update/delete 0행·insert(user_id=타인) 거부. CI에서 로컬 supabase 띄우거나 수동 SQL 검증 체크리스트.

### 11.3 통합/회귀
- **기존 108 테스트**: PR①에서 회귀 0 필수(persist→repo 리팩터가 동작 보존). 특히 `persist.test.ts`/`appReducer.test.ts`/뷰 테스트가 영향 — LocalRepo가 기존 키·라운드트립 유지하도록.
- **AppContext 통합**(B4): dispatch→repo.apply spy 호출, 기존 잔디/토스트/드릴 로직 무회귀.
- **AuthGate**(B2): 세션 mock으로 게이트 분기, 새로고침 세션 복원.

### 11.4 기존 108 테스트 회귀 영향 분석
- **직접 영향**: `src/state/__tests__/persist.test.ts`(load/save 직접 호출 — PR①에서 LocalRepo 경유로 바뀌면 이 테스트는 LocalRepo 기준으로 업데이트하거나 persist.ts를 LocalRepo 내부로 유지). `AppContext.tsx`(useEffect save 제거 → apply). `appReducer.test.ts`(reducer 순수 유지 → **영향 없음**, 변경 금지).
- **간접 영향**: 뷰 테스트들은 `test-utils.tsx`(렌더 헬퍼)가 AppProvider를 감싸므로, AuthGate 도입 시 **테스트는 세션 mock 또는 AppProvider 직접 렌더**(AuthGate 우회)로 유지. → test-utils에 `renderWithRepo(memoryRepo)` 옵션 추가 권장(PR① 또는 ④).
- **결론**: reducer/도메인 테스트(대다수)는 무영향. persist/AppContext/뷰 일부만 갱신. PR①에서 회귀 0 검증이 게이트.

---

## 부록 A — 신규/변경 파일 맵
```
신규:
  src/lib/supabase.ts
  src/state/repo/{types.ts, localRepo.ts, supabaseRepo.ts, syncRepo.ts, memoryRepo.ts, actionToChanges.ts}
  src/sync/{queue.ts, syncEngine.ts, mappers.ts, net.ts}
  src/auth/{AuthProvider.tsx, AuthGate.tsx, LoginScreen.tsx}
  supabase/migrations/0001_init.sql
  .env.example
변경:
  src/state/AppContext.tsx   (save useEffect → repo.apply, repo/initial prop)
  src/state/persist.ts       (LocalRepo로 흡수 또는 LocalRepo가 내부 사용; 키 user-prefix는 PR⑤)
  src/state/seed.ts          (로컬/게스트 모드 한정; 신규 유저 빈 상태 — §7.1)
  src/main.tsx               (AuthProvider→AuthGate→AppProvider 트리)
  src/native.ts              (appStateChange 토큰 갱신 — PR⑥)
  capacitor.config.ts        (필요 시 server/scheme 관련 — PR⑥)
  package.json               (@supabase/supabase-js, @capacitor/browser, @capacitor/preferences, native sign-in 플러그인)
  src/test-utils.tsx         (renderWithRepo 옵션)
  vite-env.d.ts              (env 타입)
유지(변경 금지):
  src/domain/**              (도메인 타입/로직 — CollectedChord 등 경계 안정)
  src/state/appReducer.ts    (reducer 순수 — 변경 없음)
```

## 부록 B — 검증 경계면 요약 (qa-verifier 체크리스트)
| ID | 생산자 | 소비자 | 계약/규칙 | PR |
|---|---|---|---|---|
| B1 RLS | Postgres 정책 | supabase-js (유저 A/B) | 본인 행만 CRUD, 타인 격리 | ③ |
| B2 세션 | AuthProvider/supabase | AuthGate | getSession/onAuthStateChange, 재마운트 복원, signOut 정리 | ④⑥ |
| B3 Repository | Repository 구현체 | AppContext | load→apply→load 동치, RepoChange 정확 | ①③⑤ |
| B4 AppContext | dispatch 래퍼 | repo.apply | 액션→apply 호출, reducer 무회귀 | ① |
| B5 동기화 | syncEngine/queue | Supabase/캐시 | 오프라인 큐·재전송·멱등·머지(per-day max/LWW/합집합/soft-delete) | ⑤ |
| B6 마이그레이션 | LocalRepo(기존키) | SyncRepo+profiles | 1회 제안, 가져오기 머지, migrated_at, 신규 유저 빈 상태 | ⑤ |
| 라우팅 게이트 | AuthGate | AppProvider | 세션 없으면 본화면 미마운트 | ④ |
| env graceful | supabase.ts | build/test | env 부재 시 무크래시·로컬 모드 | ② |
```
```
