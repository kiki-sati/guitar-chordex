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

/** LocalRepository 생성자 옵션 (PR⑤ §6). */
export interface LocalRepositoryOptions {
  /**
   * 키 prefix. 지정 시 user별 네임스페이스(`u:{uid}:` + KEYS.*)로 격리한다.
   * 미지정(기본) = prefix 없음 = legacy `cs_*` 키(회귀 0).
   */
  keyPrefix?: string;
  /**
   * 빈/손상 저장소에서 시드를 반환할지 여부.
   * 기본 true(로컬 모드/legacy 호환). false면 빈 상태 반환(인증 유저 — AC⑤-8).
   */
  seedOnEmpty?: boolean;
}

/**
 * localStorage 기반 Repository 구현.
 *
 * 동작 계약 (legacy persist.ts와 동일 — 기본 생성자):
 *   - 키: cs_grass / cs_journal / cs_drills / cs_collected / cs_lang
 *   - 빈/손상 JSON: 시드 폴백 (get/list 메서드 및 loadAll)
 *   - 직렬화/quota 예외: 삼킴 (set/saveAll 메서드)
 *   - lang null/missing: 'ko' 기본
 *
 * PR⑤ 확장(하위호환):
 *   - `keyPrefix`로 user 네임스페이스(§6.2). 기본값(없음)은 `cs_*` 불변.
 *   - `seedOnEmpty:false`로 빈 상태 시작(인증 유저 캐시 — AC⑤-8).
 *
 * React 무의존 — 테스트 1급 모듈.
 */
export class LocalRepository implements Repository {
  private readonly keyPrefix: string;
  private readonly seedOnEmpty: boolean;

  constructor(opts: LocalRepositoryOptions = {}) {
    this.keyPrefix = opts.keyPrefix ?? '';
    this.seedOnEmpty = opts.seedOnEmpty ?? true;
  }

  /** base 키에 prefix를 붙여 최종 localStorage 키를 만든다(§6.2). */
  private key(base: string): string {
    return this.keyPrefix ? `${this.keyPrefix}${base}` : base;
  }

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
        localStorage.setItem(this.key(KEYS.grass), JSON.stringify(patch.grass));
      if (patch.journal !== undefined)
        localStorage.setItem(this.key(KEYS.journal), JSON.stringify(patch.journal));
      if (patch.collected !== undefined)
        localStorage.setItem(this.key(KEYS.collected), JSON.stringify(patch.collected));
      if (patch.drills !== undefined)
        localStorage.setItem(this.key(KEYS.drills), JSON.stringify(patch.drills));
      if (patch.lang !== undefined)
        localStorage.setItem(this.key(KEYS.lang), JSON.stringify(patch.lang));
    } catch {
      /* no-op (quota / private mode) */
    }
  }

  // ── 잔디 ───────────────────────────────────────────────────────────
  getGrass(): GrassMap {
    return this.read<GrassMap>(this.key(KEYS.grass)) ?? (this.seedOnEmpty ? seedGrass() : {});
  }
  setGrass(grass: GrassMap): void {
    this.write(this.key(KEYS.grass), grass);
  }

  // ── 연습 일지 ──────────────────────────────────────────────────────
  listJournal(): JournalEntry[] {
    return this.read<JournalEntry[]>(this.key(KEYS.journal)) ?? (this.seedOnEmpty ? seedJournal() : []);
  }
  setJournal(journal: JournalEntry[]): void {
    this.write(this.key(KEYS.journal), journal);
  }

  // ── 드릴 ───────────────────────────────────────────────────────────
  listDrills(): Drill[] {
    return this.read<Drill[]>(this.key(KEYS.drills)) ?? (this.seedOnEmpty ? seedDrills() : []);
  }
  setDrills(drills: Drill[]): void {
    this.write(this.key(KEYS.drills), drills);
  }

  // ── 담은 코드 ──────────────────────────────────────────────────────
  listCollected(): CollectedChord[] {
    return this.read<CollectedChord[]>(this.key(KEYS.collected)) ?? (this.seedOnEmpty ? seedCollected() : []);
  }
  setCollected(collected: CollectedChord[]): void {
    this.write(this.key(KEYS.collected), collected);
  }

  // ── 언어 ───────────────────────────────────────────────────────────
  getLang(): Lang {
    const v = this.read<Lang>(this.key(KEYS.lang));
    return v === 'ko' || v === 'en' ? v : 'ko';
  }
  setLang(lang: Lang): void {
    this.write(this.key(KEYS.lang), lang);
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
