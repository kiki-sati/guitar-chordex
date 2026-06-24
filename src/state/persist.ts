import type {
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
} from '../domain/types';
import { LocalRepository } from './local-repository';

/**
 * 영속 키 (localStorage). 외부(테스트/통합) 호환을 위해 그대로 유지.
 *
 * NOTE: 이 모듈의 load/save 함수는 호환층으로만 보존되며,
 * 실제 영속화는 LocalRepository (src/state/local-repository.ts) 가 담당한다.
 * 신규 코드는 Repository 인터페이스를 사용할 것.
 */
export const KEYS = {
  grass: 'cs_grass',
  journal: 'cs_journal',
  collected: 'cs_collected',
  drills: 'cs_drills',
  lang: 'cs_lang',
} as const;

export interface PersistedState {
  grass: GrassMap;
  journal: JournalEntry[];
  collected: CollectedChord[];
  drills: Drill[];
  lang: 'ko' | 'en';
}

/**
 * @deprecated LocalRepository.loadAll() 을 사용하라.
 * 기존 테스트/외부 코드 호환을 위해 보존된 호환층.
 */
export function load(): PersistedState {
  return new LocalRepository().loadAll();
}

/**
 * @deprecated LocalRepository.saveAll() 을 사용하라.
 * 기존 테스트/외부 코드 호환을 위해 보존된 호환층.
 */
export function save(p: Partial<PersistedState>): void {
  new LocalRepository().saveAll(p);
}
