import type { PersistedState } from './persist';
import type { RepoChange } from './repo-change';
import type { GrassMap } from '../domain/types';

/**
 * RepoChange[]를 PersistedState에 적용해 새 상태를 반환한다 (순수).
 *
 * SyncRepo.apply의 낙관적 캐시 갱신에 사용한다(§8.5-1). 서버 upsert와 같은
 * 자연키(grass day / journal·drill id / collected name / lang)로 적용해
 * 멱등을 보장한다(AC⑤-5).
 */
export function applyChanges(
  state: PersistedState,
  changes: RepoChange[],
): PersistedState {
  let grass: GrassMap = state.grass;
  let journal = state.journal;
  let drills = state.drills;
  let collected = state.collected;
  let lang = state.lang;

  for (const c of changes) {
    switch (c.kind) {
      case 'grass':
        grass = { ...grass, [c.day]: c.count };
        break;
      case 'journal':
        if (c.op === 'upsert') {
          const exists = journal.some((e) => e.id === c.entry.id);
          journal = exists
            ? journal.map((e) => (e.id === c.entry.id ? c.entry : e))
            : [...journal, c.entry];
        } else {
          journal = journal.filter((e) => e.id !== c.id);
        }
        break;
      case 'drill':
        if (c.op === 'upsert') {
          const exists = drills.some((d) => d.id === c.drill.id);
          drills = exists
            ? drills.map((d) => (d.id === c.drill.id ? c.drill : d))
            : [...drills, c.drill];
        } else {
          drills = drills.filter((d) => d.id !== c.id);
        }
        break;
      case 'collected':
        if (c.op === 'upsert') {
          const exists = collected.some((x) => x.name === c.chord.name);
          collected = exists
            ? collected.map((x) => (x.name === c.chord.name ? c.chord : x))
            : [...collected, c.chord];
        } else {
          collected = collected.filter((x) => x.name !== c.name);
        }
        break;
      case 'lang':
        lang = c.lang;
        break;
    }
  }

  return { grass, journal, drills, collected, lang };
}
