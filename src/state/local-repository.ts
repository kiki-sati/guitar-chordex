import {
  seedCollected,
  seedDrills,
  seedGrass,
  seedJournal,
} from './seed';
import { KEYS, type PersistedState } from './persist';
import type {
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
} from '../domain/types';
import type { Lang, Repository } from './repository';

/**
 * localStorage 기반 Repository 구현.
 *
 * 동작 계약 (legacy persist.ts와 동일):
 *   - 키: cs_grass / cs_journal / cs_drills / cs_collected / cs_lang
 *   - 빈/손상 JSON: 시드 폴백 (get/list 메서드 및 loadAll)
 *   - 직렬화/quota 예외: 삼킴 (set/saveAll 메서드)
 *   - lang null/missing: 'ko' 기본
 *
 * React 무의존 — 테스트 1급 모듈.
 */
export class LocalRepository implements Repository {
  // ── 일괄 로드/저장 ─────────────────────────────────────────────────
  loadAll(): PersistedState {
    return {
      grass: this.getGrass(),
      journal: this.listJournal(),
      collected: this.listCollected(),
      drills: this.listDrills(),
      lang: this.getLang(),
    };
  }

  saveAll(patch: Partial<PersistedState>): void {
    try {
      if (patch.grass !== undefined)
        localStorage.setItem(KEYS.grass, JSON.stringify(patch.grass));
      if (patch.journal !== undefined)
        localStorage.setItem(KEYS.journal, JSON.stringify(patch.journal));
      if (patch.collected !== undefined)
        localStorage.setItem(KEYS.collected, JSON.stringify(patch.collected));
      if (patch.drills !== undefined)
        localStorage.setItem(KEYS.drills, JSON.stringify(patch.drills));
      if (patch.lang !== undefined)
        localStorage.setItem(KEYS.lang, JSON.stringify(patch.lang));
    } catch {
      /* no-op (quota / private mode) */
    }
  }

  // ── 잔디 ───────────────────────────────────────────────────────────
  getGrass(): GrassMap {
    return this.read<GrassMap>(KEYS.grass) ?? seedGrass();
  }
  setGrass(grass: GrassMap): void {
    this.write(KEYS.grass, grass);
  }

  // ── 연습 일지 ──────────────────────────────────────────────────────
  listJournal(): JournalEntry[] {
    return this.read<JournalEntry[]>(KEYS.journal) ?? seedJournal();
  }
  setJournal(journal: JournalEntry[]): void {
    this.write(KEYS.journal, journal);
  }

  // ── 드릴 ───────────────────────────────────────────────────────────
  listDrills(): Drill[] {
    return this.read<Drill[]>(KEYS.drills) ?? seedDrills();
  }
  setDrills(drills: Drill[]): void {
    this.write(KEYS.drills, drills);
  }

  // ── 담은 코드 ──────────────────────────────────────────────────────
  listCollected(): CollectedChord[] {
    return this.read<CollectedChord[]>(KEYS.collected) ?? seedCollected();
  }
  setCollected(collected: CollectedChord[]): void {
    this.write(KEYS.collected, collected);
  }

  // ── 언어 ───────────────────────────────────────────────────────────
  getLang(): Lang {
    const v = this.read<Lang>(KEYS.lang);
    return v === 'ko' || v === 'en' ? v : 'ko';
  }
  setLang(lang: Lang): void {
    this.write(KEYS.lang, lang);
  }

  // ── 내부 ───────────────────────────────────────────────────────────
  private read<T>(key: string): T | null {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') as T | null;
    } catch {
      return null;
    }
  }
  private write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* no-op (quota / private mode) */
    }
  }
}
