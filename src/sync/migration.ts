import { LocalRepository } from '../state/local-repository';
import type { PersistedState } from '../state/persist';
import type { RepoChange } from '../state/repo-change';

/**
 * 로컬→클라우드 마이그레이션 판정/로드/변환 (계획 17 §9.1).
 * 순수 로직 + legacy localStorage 읽기. React·supabase 무의존.
 *
 * 함정(§9.1): `new LocalRepository()`(기본)는 빈 저장소에 seed를 반환하므로,
 * 마이그레이션 판정/로드는 반드시 `seedOnEmpty:false`로 읽어 "진짜 사용자
 * 데이터"만 본다. 안 그러면 신규 유저에게도 seed가 legacy로 오인된다(AC⑤-6).
 */

/** legacy(prefix 없는) cs_* 키에 유의미 데이터가 있는가. */
export function hasLegacyData(): boolean {
  const p = loadLegacy();
  return (
    Object.keys(p.grass).length > 0 ||
    p.journal.length > 0 ||
    p.drills.length > 0 ||
    p.collected.length > 0
  );
}

/** legacy localStorage → PersistedState(seed 미적용 — 진짜 데이터만). */
export function loadLegacy(): PersistedState {
  return new LocalRepository({ seedOnEmpty: false }).loadAll();
}

/** PersistedState 전체 → RepoChange[] (마이그레이션 push용, §9.1). */
export function legacyToChanges(p: PersistedState): RepoChange[] {
  const changes: RepoChange[] = [];
  for (const [day, count] of Object.entries(p.grass)) {
    changes.push({ kind: 'grass', day, count });
  }
  for (const entry of p.journal) {
    changes.push({ kind: 'journal', op: 'upsert', entry });
  }
  p.drills.forEach((drill, index) => {
    changes.push({ kind: 'drill', op: 'upsert', drill, sortOrder: index });
  });
  for (const chord of p.collected) {
    changes.push({ kind: 'collected', op: 'upsert', chord });
  }
  changes.push({ kind: 'lang', lang: p.lang });
  return changes;
}
