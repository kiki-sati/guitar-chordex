import {
  seedCollected,
  seedDrills,
  seedGrass,
  seedJournal,
} from './seed';
import type {
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
} from '../domain/types';

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

function parse<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') as T | null;
  } catch {
    return null;
  }
}

/**
 * localStorage에서 영속 상태 로드. 없으면 시드. (원본 load 라인 221-237)
 * 첫 방문 시에만 시드(localStorage 비어있을 때).
 */
export function load(): PersistedState {
  const lang = (parse<'ko' | 'en'>(KEYS.lang) as 'ko' | 'en') || 'ko';
  const grass = parse<GrassMap>(KEYS.grass) ?? seedGrass();
  const journal = parse<JournalEntry[]>(KEYS.journal) ?? seedJournal();
  const collected = parse<CollectedChord[]>(KEYS.collected) ?? seedCollected();
  const drills = parse<Drill[]>(KEYS.drills) ?? seedDrills();
  return { grass, journal, collected, drills, lang };
}

/** 영속 키 일부 저장. try/catch(quota·private mode). (원본 save 라인 238) */
export function save(p: Partial<PersistedState>): void {
  try {
    if (p.grass) localStorage.setItem(KEYS.grass, JSON.stringify(p.grass));
    if (p.journal) localStorage.setItem(KEYS.journal, JSON.stringify(p.journal));
    if (p.collected)
      localStorage.setItem(KEYS.collected, JSON.stringify(p.collected));
    if (p.drills) localStorage.setItem(KEYS.drills, JSON.stringify(p.drills));
    if (p.lang) localStorage.setItem(KEYS.lang, JSON.stringify(p.lang));
  } catch {
    /* no-op */
  }
}
