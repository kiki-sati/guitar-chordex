import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
} from '../domain/types';
import type { Lang } from './repository';
import type { PersistedState } from './persist';
import {
  collectedToRow,
  drillToRow,
  grassMapToRows,
  grassRowsToMap,
  journalToRow,
  rowToCollected,
  rowToDrill,
  rowToJournal,
  type CollectedRow,
  type DrillRow,
  type GrassRow,
  type JournalRow,
  type ProfileRow,
} from './mappers';

/**
 * Supabase 백엔드 어댑터 (독립 비동기 클래스).
 *
 * 설계: _workspace/11_pr_db_schema_rls_plan.md §5
 * 정본: _workspace/05_backend_auth_plan.md §5.3
 *
 * 핵심 결정(변경 시 사용자 확인):
 *   - (D1) 기존 동기 `Repository` 인터페이스를 implements/승급하지 않는다.
 *     loadAll()은 Promise<PersistedState>, 쓰기는 Promise<void>.
 *     인터페이스 비동기 승급 + AppContext 배선은 PR④/⑤로 이연(07 §4.3·§5).
 *   - (D2) 본 PR은 어디에서도 import되지 않는 고립 모듈(테스트만 소비) →
 *     트리셰이킹으로 런타임 그래프 무진입 → AppContext/128 테스트 회귀 0.
 *   - (D3) RepoChange/actionToChanges 미도입. 입력은 도메인 객체/배열 per-entity.
 *   - (D4) CollectedChord(id 없음)는 (user_id,name) upsert로 처리. id 미생성.
 *   - (D5) updated_at은 클라가 매 쓰기마다 명시 set(트리거 미사용). LWW 일관.
 *   - (D6) client=null이면 생성자에서 즉시 throw.
 */

const TABLE = {
  profiles: 'profiles',
  grass: 'grass',
  journal: 'journal_entries',
  drills: 'drills',
  collected: 'collected_chords',
} as const;

/** supabase 응답에서 error를 검사하고 있으면 throw(호출자=PR⑤ 큐가 재시도 책임). */
function assertOk(res: { error: unknown }): void {
  if (res.error) {
    const message =
      typeof res.error === 'object' &&
      res.error !== null &&
      'message' in res.error
        ? String((res.error as { message: unknown }).message)
        : 'Supabase request failed';
    throw new Error(message);
  }
}

export class SupabaseRepository {
  private readonly client: SupabaseClient;
  private readonly userId: string;

  /**
   * @param client supabase 클라이언트. null이면 생성자에서 즉시 throw (D6/AC-7).
   * @param userId 인증된 사용자 id. 모든 행 쓰기에 user_id로 주입.
   */
  constructor(client: SupabaseClient | null, userId: string) {
    if (!client) {
      throw new Error(
        'SupabaseRepository requires a configured Supabase client (env missing)',
      );
    }
    this.client = client;
    this.userId = userId;
  }

  /** 매 쓰기 1회 산출하는 ISO 타임스탬프(트리거 미사용 — D5/AC-10). */
  private now(): string {
    return new Date().toISOString();
  }

  // ── 일괄 로드 (PR④/⑤ AuthGate가 await — 본 PR은 테스트만 소비) ──
  /**
   * 5개 테이블 select(+ deleted_at is null) → mappers로 PersistedState 조립.
   * 신규/빈 유저는 빈 컬렉션 + lang='ko'(seed 미적용 — 정본 §7.1).
   */
  async loadAll(): Promise<PersistedState> {
    const [grassRes, journalRes, drillRes, collectedRes, profileRes] =
      await Promise.all([
        // grass: deleted_at 컬럼 없음 → .is 미적용.
        this.client.from(TABLE.grass).select('*'),
        this.client.from(TABLE.journal).select('*').is('deleted_at', null),
        this.client.from(TABLE.drills).select('*').is('deleted_at', null),
        this.client.from(TABLE.collected).select('*').is('deleted_at', null),
        this.client.from(TABLE.profiles).select('*'),
      ]);

    assertOk(grassRes);
    assertOk(journalRes);
    assertOk(drillRes);
    assertOk(collectedRes);
    assertOk(profileRes);

    const grassRows = (grassRes.data ?? []) as GrassRow[];
    const journalRows = (journalRes.data ?? []) as JournalRow[];
    const drillRows = (drillRes.data ?? []) as DrillRow[];
    const collectedRows = (collectedRes.data ?? []) as CollectedRow[];
    const profileRows = (profileRes.data ?? []) as ProfileRow[];

    const sortedDrills = [...drillRows].sort(
      (a, b) => a.sort_order - b.sort_order,
    );

    const lang: Lang =
      profileRows[0]?.lang === 'en' || profileRows[0]?.lang === 'ko'
        ? profileRows[0].lang
        : 'ko';

    return {
      grass: grassRowsToMap(grassRows),
      journal: journalRows.map(rowToJournal),
      collected: collectedRows.map(rowToCollected),
      drills: sortedDrills.map(rowToDrill),
      lang,
    };
  }

  // ── per-entity 쓰기 (멱등 upsert; 입력은 도메인 객체/배열) ──

  /** GrassMap 전체 → grass upsert(onConflict 'user_id,day'). */
  async saveGrass(map: GrassMap): Promise<void> {
    const rows = grassMapToRows(map, this.userId, this.now());
    if (rows.length === 0) return;
    const res = await this.client
      .from(TABLE.grass)
      .upsert(rows, { onConflict: 'user_id,day' });
    assertOk(res);
  }

  /** JournalEntry → journal_entries upsert(onConflict 'id'). */
  async upsertJournal(entry: JournalEntry): Promise<void> {
    const row = journalToRow(entry, this.userId, this.now());
    const res = await this.client
      .from(TABLE.journal)
      .upsert(row, { onConflict: 'id' });
    assertOk(res);
  }

  /** journal soft-delete(deleted_at set) where (id, user_id). */
  async deleteJournal(id: string): Promise<void> {
    const now = this.now();
    const res = await this.client
      .from(TABLE.journal)
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id)
      .eq('user_id', this.userId);
    assertOk(res);
  }

  /** Drill → drills upsert(onConflict 'id'). sortOrder 명시 주입. */
  async upsertDrill(drill: Drill, sortOrder: number): Promise<void> {
    const row = drillToRow(drill, this.userId, this.now(), sortOrder);
    const res = await this.client
      .from(TABLE.drills)
      .upsert(row, { onConflict: 'id' });
    assertOk(res);
  }

  /** drill soft-delete(deleted_at set) where (id, user_id). */
  async deleteDrill(id: string): Promise<void> {
    const now = this.now();
    const res = await this.client
      .from(TABLE.drills)
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id)
      .eq('user_id', this.userId);
    assertOk(res);
  }

  /** CollectedChord → collected_chords upsert(onConflict 'user_id,name'). id 미생성(D4). */
  async upsertCollected(chord: CollectedChord): Promise<void> {
    const row = collectedToRow(chord, this.userId, this.now());
    const res = await this.client
      .from(TABLE.collected)
      .upsert(row, { onConflict: 'user_id,name' });
    assertOk(res);
  }

  /** collected soft-delete(deleted_at set) where (user_id, name) — name 자연키(D4). */
  async deleteCollected(name: string): Promise<void> {
    const now = this.now();
    const res = await this.client
      .from(TABLE.collected)
      .update({ deleted_at: now, updated_at: now })
      .eq('user_id', this.userId)
      .eq('name', name);
    assertOk(res);
  }

  /** lang → profiles upsert(onConflict 'id') {id, lang, updated_at}. */
  async setLang(lang: Lang): Promise<void> {
    const res = await this.client
      .from(TABLE.profiles)
      .upsert(
        { id: this.userId, lang, updated_at: this.now() },
        { onConflict: 'id' },
      );
    assertOk(res);
  }
}
