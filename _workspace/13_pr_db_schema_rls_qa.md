# QA 리포트 — PR③ `feat/db-schema-rls` (독립 검증)

> 검증자: qa-verifier · 정본: `_workspace/05_backend_auth_plan.md`(§2·§3) · 설계: `_workspace/11_pr_db_schema_rls_plan.md`
> 대상: `supabase/migrations/0001_init.sql`, `src/state/mappers.ts`, `src/state/supabase-repository.ts` + 두 테스트
> 방법: 명령 독립 재실행(env 없이) + 경계면 양쪽 동시 읽기 교차 비교 + 정적 분석

## 종합 판정: PASS

차단 이슈 0건. 빌드/타입/테스트 그린, 회귀 경계 무침범, 신규 의존성 0, 시크릿 노출 0.
라이브 RLS 격리(A/B)·default-deny·`handle_new_user` 자동생성은 **라이브 Supabase 필요 → 자동 범위 밖**(아래 수동 체크리스트로 인계, 설계 §11.2 동일 결정). SQL 정적 정합성은 통과.

## 명령 재실행 (출력 인용, env 미설정 상태)

| 명령 | 결과 | exit |
|------|------|------|
| `npx tsc -b` | (출력 없음) | **0** |
| `npm run build` | `tsc -b && vite build` → `✓ 92 modules transformed` · `✓ built in 2.77s` | **0** |
| `npx vitest run --exclude "**/.claude/**"` (단일 트리 실측) | `Test Files 19 passed (19)` · `Tests 158 passed (158)` | **0** |
| `npx vitest run` (기본) | `Test Files 51 passed (51)` · `Tests 400 passed (400)` — `.claude/worktrees` 중복 과대카운트 | 0 |
| baseline 격리(신규 2파일 제외) | `Tests 128 passed (128)` | 0 |

- 158 = baseline **128** + 신규 **30**(mappers 16 + supabase-repository 14). baseline 128을 신규 파일 제외 재실행으로 실측 확인.
- 기본 vitest 400(51 files)은 `.claude/worktrees` 중복 트리 합산 — 환경 이슈. `--exclude "**/.claude/**"` 단일 트리 158이 실측치.

## 경계면 / 정합성 표

| ID | 경계면 | 생산자 ↔ 소비자 | 판정 | 근거 |
|----|--------|----------------|------|------|
| B1-a | RLS enable | SQL ↔ 정본 §3 | PASS | 5개 테이블 모두 `enable row level security` (0001_init.sql:91,100,111,122,133) |
| B1-b | RLS 정책 매트릭스 | SQL ↔ 정본 §3 | PASS | `create policy` 19개. profiles=3(select/insert/update, **delete 없음** — 정본과 일치), grass/journal/drills/collected=각 4(select/insert/update/delete). |
| B1-c | 본인행 술어 | SQL ↔ 정본 §3 | PASS | profiles `(select auth.uid()) = id`(:93,95,97); 나머지 4테이블 `= user_id`. update는 using+with check 동시. 서브쿼리 래핑 일관. |
| B1-d | 신규 유저 트리거 | SQL ↔ 정본 §3 | PASS | `handle_new_user` `language plpgsql security definer set search_path = ''`(:148), `on conflict (id) do nothing`, `after insert on auth.users ... on_auth_user_created`(:155). 오타·누락 없음. |
| 스키마-§2 | 테이블/컬럼/PK/제약/인덱스 | SQL ↔ 정본 §2.2 | PASS | 아래 상세. |
| §2.2 트리거 | touch_updated_at 미사용 | SQL ↔ 정본 §2.2 주의 | PASS | BEFORE UPDATE 트리거 **미작성**(grep 0건, 주석만 잔존 :8). `updated_at`은 클라 명시 set(D5). |
| B3-load | loadAll → PersistedState | supabase-repository ↔ mappers ↔ persist.PersistedState | PASS | 아래 상세. |
| B3-write | per-entity upsert/soft-delete | supabase-repository ↔ SQL 제약 | PASS | onConflict 키가 SQL PK/unique와 1:1. 아래 상세. |
| B3-guard | client=null 가드 | 생성자 ↔ AC-7 | PASS | `if (!client) throw`(supabase-repository.ts:74). mock 2케이스. |
| mappers | 라운드트립/snake↔camel/필터 | mappers ↔ 도메인 types | PASS | 아래 상세. |
| 회귀 | 변경 금지 경계 | git working tree | PASS | `git diff --name-only HEAD` 빈 출력 — 추적 파일 0개 수정. 신규 5파일 전부 untracked(`??`). |
| 보안 | service_role/env/시크릿/deps | 전체 | PASS | 아래 상세. |

### 스키마 ↔ 정본 §2.2 상세 (1:1 대조)
- **profiles**: `id uuid pk references auth.users on delete cascade`, `lang text not null default 'ko' check (lang in ('ko','en'))`, `migrated_at timestamptz`, `created_at/updated_at default now()`. ✓
- **grass**: PK `(user_id, day)` ✓, `count integer not null default 0 check (count >= 0)` ✓, `index grass_user_idx` ✓. (tombstone 없음 — 정본대로 grass는 deleted_at 미보유.)
- **journal_entries**: PK `id uuid`(클라 생성), `entry_date date`, `chords text[] default '{}'`, `minutes check (>=0)`, `deleted_at timestamptz`(tombstone) ✓, 인덱스 `journal_user_idx` + `journal_user_date_idx (user_id, entry_date desc)` ✓.
- **drills**: `target check (between 1 and 40)` ✓, `count check (>=0)` ✓, `seq jsonb`/`sheet_id text`/`time_sig text` 슬롯 ✓, `deleted_at` ✓, `sort_order integer not null default 0` ✓, `index drills_user_idx` ✓.
- **collected_chords**: `frets jsonb not null` ✓, `chord_key text not null` ✓, `unique (user_id, name)` ✓(자연키), `deleted_at` ✓, `index collected_user_idx` ✓.

### B3 supabaseRepository ↔ SQL 제약 정합 (onConflict 키 교차 검증)
| 쓰기 메서드 | onConflict / where | SQL 측 키 | 일치 |
|-------------|--------------------|-----------|------|
| `saveGrass` | upsert `onConflict: 'user_id,day'` | grass PK `(user_id, day)` | ✓ |
| `upsertJournal` | upsert `onConflict: 'id'` | journal PK `id` | ✓ |
| `deleteJournal` | update deleted_at where `eq(id).eq(user_id)` | tombstone + RLS user_id | ✓ |
| `upsertDrill` | upsert `onConflict: 'id'` + sort_order 주입 | drills PK `id` | ✓ |
| `deleteDrill` | update deleted_at where `eq(id).eq(user_id)` | tombstone | ✓ |
| `upsertCollected` | upsert `onConflict: 'user_id,name'`, **id 미생성** | unique `(user_id, name)` | ✓ |
| `deleteCollected` | update deleted_at where `eq(user_id).eq(name)` | 자연키 D4 | ✓ |
| `setLang` | upsert `{id,lang,updated_at}` `onConflict: 'id'` | profiles PK `id` | ✓ |

- `loadAll`: journal/drills/collected에 `.is('deleted_at', null)` 적용, grass·profiles는 미적용(deleted_at 컬럼 없음 — SQL과 일치). drills는 `sort_order` 오름차순 정렬 후 `rowToDrill`. profiles 부재 시 `lang='ko'` 폴백(정본 §7.1 seed 미적용). 전부 `assertOk`로 error 전파.
- **mock 충실성 교차 확인**: 테스트 mock의 `from().upsert()→Promise`, `from().select().is()→thenable`, `from().select().then()`(grass), `from().update().eq().eq()→Promise` 체인이 실제 supabase-js PostgrestBuilder(어느 체인 지점이든 thenable, await 시 실행) 형태와 일치. 생산자(supabase-repository)의 await 지점과 소비자(mock) 종결 지점이 어긋나지 않음. 타입 캐스팅 우회(`as any`/`@ts-ignore`) 0건.

### mappers ↔ 도메인 types 정합
- 라운드트립 동치(grass/journal/drill/collected) 16케이스 green. `date↔entry_date`, `sheetId↔sheet_id`, `timeSig↔time_sig`, `key↔chord_key` 매핑 검증.
- grass `count>0` 필터(`grassRowsToMap`) — count=0 행 제외, 도메인 GrassMap 의미 보존.
- drill null↔undefined: 서버 `seq/sheet_id/time_sig = null` → 도메인 옵셔널 부재(`'seq' in d === false`)로 복원. `DrillRow.seq: DrillSeqItem[] | null`로 정밀화(TS18048 정직 해결, cast 우회 없음).
- 서버 전용 필드(id/user_id/deleted_at/updated_at/entry_date/sort_order/chord_key) 도메인 비누출 — `rowToCollected`는 `['frets','key','name']`만(키 정렬 검증). 경계면 안정.
- CollectedChord `(user_id,name)` 자연키 — `collectedToRow`가 id 미생성(`'id' in partial === false`). 입력 불변성(*ToRow가 도메인 객체 미변형) 3케이스.

### 도메인 정확성 (기타 코드)
- `frets jsonb` ↔ 도메인 `FretArray = (number|'x')[]` length 6. 테스트 픽스처 `['x',3,2,0,1,0]`, `['x',0,2,0,1,0]`, `['x',3,2,0,0,0]` 모두 6현·뮤트 'x'·개방 0·양수 프렛 — 유효. 현 순서(0=6번줄…5=1번줄) 매퍼가 배열을 그대로 보존(좌우 반전 없음 — spread 복제만). 음수 프렛 없음.
- 서버는 frets를 jsonb로 불투명 저장 → 음악적 검증은 도메인(`buildChord`/`computeDiagram`) 책임이며 본 PR 경계 밖. 매퍼는 shape 보존만 — 정합.

### 보안
- `service_role`: src 전체 0참조(grep). 등장처는 CLAUDE.md·`.env.example`·설계 문서뿐(전부 "사용 금지" 안내 텍스트). `.env.example`에 시크릿 값 노출 0.
- `import.meta.env`/`process.env`: 신규 state 파일 0참조. supabase-repository는 client를 **주입**받음(env 직접 접근 안 함) — anon 전제, env 부재 graceful(client=null이면 호출자가 폴백, 생성자 throw).
- 신규 런타임 의존성 **0**: `package.json`/`package-lock.json` 무수정(`git status` 빈 출력). `@supabase/supabase-js ^2.108.2`는 HEAD에 기설치(PR②) — type-only import.

## 회귀 / 격리
- `git diff --name-only HEAD` = 빈 출력. 추적 파일 0개 수정. 신규 파일 5개 전부 untracked.
- 변경 금지 경계 무침범 확인: `src/domain/**`, `src/state/appReducer.ts`, `AppContext.tsx`, `persist.ts`, `repository.ts`, `local-repository.ts`, `capacitor.config.ts`, `*.css`, `package.json`, `main.tsx` — `git status --porcelain` 빈 출력.
- 기존 128 테스트 그린(신규 2파일 제외 재실행 실측). `npm run build` 92 modules(PR② 동일) — SupabaseRepository 고립 모듈(앱 미import, 트리셰이킹 무진입) → 런타임 회귀 0(D2 검증).

## 차단 이슈
없음.

## 비차단 관찰 (정보 — 후속 PR 참고, 본 PR 수정 불요)
1. **profiles INSERT 정책 vs handle_new_user**: profiles에 `insert_own` 정책은 있으나, 행 생성은 `handle_new_user`(security definer, RLS 우회)가 전담한다. 클라가 직접 profiles INSERT를 시도하는 경로는 현재 없음(`setLang`은 upsert이나 정상 흐름은 트리거가 선 생성 → update). 라이브에서 트리거 자동생성이 동작하면 insert 정책은 사실상 미사용 — 설계 의도대로이며 문제 아님. PR④/⑤ 배선 시 "트리거 선행 생성" 전제만 유지하면 됨.
2. **`assertOk`는 PostgREST `{error}`만 검사** — RLS 거부 시 update/delete가 0행 영향이어도 `error`는 null일 수 있음(soft-delete가 조용히 0행). 이는 의도된 동작(호출자=PR⑤ 큐가 멱등 재시도 책임, D-주석). 라이브 RLS 격리 검증(B1 수동)에서 "타인 행 update/delete 영향 0행"으로 별도 확인 필요 — 아래 체크리스트에 포함.
3. **기본 vitest 400카운트**: `.claude/worktrees` 중복 트리 합산. CI/로컬에서 `--exclude "**/.claude/**"` 또는 vitest config의 `test.exclude`에 `**/.claude/**` 고정 권장(반복 혼선 방지). 본 PR 범위 밖.

## 미검증 — 라이브 Supabase 수동 RLS 체크리스트 (B1, AC-6)
> 단위테스트(supabase-js mock)는 "올바른 테이블/필터/onConflict/soft-delete **호출**"만 검증한다. mock은 서버 정책을 모른다. 아래는 `0001_init.sql`을 실 프로젝트에 적용한 뒤 사용자/CI가 수동 수행.

- [ ] **default-deny / enable 확인**: `select relname, relrowsecurity from pg_class where relname in ('profiles','grass','journal_entries','drills','collected_chords');` → 5행 모두 `relrowsecurity = t`.
- [ ] **정책 존재**: `select tablename, policyname, cmd from pg_policies where schemaname='public' order by 1,3;` → 19행(profiles 3 + 나머지 각 4). (enable + 정책 0이면 본인도 차단되므로 정책 존재 필수.)
- [ ] **신규 가입 자동생성**: 새 유저 가입 → `select * from public.profiles where id = <new_uid>;` 1행(lang='ko'). `handle_new_user` 동작 확인.
- [ ] **유저 A 본인 CRUD**: A 세션으로 각 테이블 insert(user_id=A)/select/update/delete(soft) 성공.
- [ ] **유저 B 격리(read)**: B 세션으로 A의 행 `select` → **0건**.
- [ ] **유저 B 격리(write)**: B 세션으로 A의 행 update/delete → **영향 0행**(에러 또는 0 rowcount). A의 user_id로 insert → **거부**(with check 위반).
- [ ] **anon 차단**: 미인증(anon) 세션으로 각 테이블 select → **0건**(`to authenticated` 정책이라 anon 무권한).
- [ ] **soft-delete 가시성**: A가 자기 deleted_at set한 행을 여전히 select 가능(클라가 tombstone 보고 로컬 제거 — 정본 §3 주석).

## 권고
- 본 PR은 **머지 가능**(차단 0). 단, AC-6(라이브 RLS A/B 격리)는 위 체크리스트 수행 전까지 "미검증"으로 잔류 — SQL 적용은 사용자가 Supabase SQL Editor/`db push`로 1회 선행(설계 §9.1).
- git commit/push는 사용자 승인 대기(미수행).
