import { describe, it, expect, beforeEach } from 'vitest';
import { LocalRepository } from '../local-repository';
import { KEYS } from '../persist';
import type {
  CollectedChord,
  Drill,
  JournalEntry,
} from '../../domain/types';

/**
 * LocalRepository는 Repository 인터페이스의 localStorage 구현체.
 *
 * 본 테스트는 PR③ 영속화 추상화의 회귀 안전망:
 *   - 기존 persist.ts와 동일한 키(`cs_*`)에 같은 JSON shape로 영속
 *   - 첫 로드 시 시드 폴백
 *   - 손상 JSON 시 시드 폴백 (관용)
 *   - 각 엔티티별 fine-grained API: get/set, list/add/upsert/remove
 *   - 언어 설정 get/set
 *
 * AppContext는 이 LocalRepository만 사용하고 persist.ts(load/save)를 직접
 * 호출하지 않는다. persist.ts는 외부 테스트 호환을 위한 KEYS/PersistedState
 * export만 유지 + load/save는 LocalRepository에 위임(deprecated).
 */
describe('LocalRepository', () => {
  beforeEach(() => localStorage.clear());

  describe('getAll / loadAll', () => {
    it('seeds when localStorage is empty (matches legacy load())', () => {
      const repo = new LocalRepository();
      const state = repo.loadAll();
      expect(Object.keys(state.grass).length).toBeGreaterThan(0);
      expect(state.journal.length).toBeGreaterThan(0);
      expect(state.drills.length).toBeGreaterThan(0);
      expect(state.collected.length).toBe(4);
      expect(state.lang).toBe('ko');
    });

    it('returns persisted values when present', () => {
      localStorage.setItem(KEYS.grass, JSON.stringify({ '2026-06-24': 7 }));
      localStorage.setItem(KEYS.lang, JSON.stringify('en'));
      const repo = new LocalRepository();
      const state = repo.loadAll();
      expect(state.grass).toEqual({ '2026-06-24': 7 });
      expect(state.lang).toBe('en');
    });

    it('falls back to seed when stored JSON is corrupted', () => {
      localStorage.setItem(KEYS.grass, '{not json');
      localStorage.setItem(KEYS.journal, 'broken');
      const repo = new LocalRepository();
      const state = repo.loadAll();
      // grass/journal seed로 복구
      expect(Object.keys(state.grass).length).toBeGreaterThan(0);
      expect(state.journal.length).toBeGreaterThan(0);
    });

    it('defaults lang to "ko" when missing or null', () => {
      const repo = new LocalRepository();
      expect(repo.getLang()).toBe('ko');
      localStorage.setItem(KEYS.lang, 'null');
      expect(repo.getLang()).toBe('ko');
    });
  });

  describe('grass', () => {
    it('round-trips via setGrass/getGrass', () => {
      const repo = new LocalRepository();
      repo.setGrass({ '2026-06-24': 3, '2026-06-23': 1 });
      expect(repo.getGrass()).toEqual({ '2026-06-24': 3, '2026-06-23': 1 });
    });

    it('writes to the legacy localStorage key cs_grass', () => {
      const repo = new LocalRepository();
      repo.setGrass({ '2026-06-24': 2 });
      const raw = localStorage.getItem(KEYS.grass);
      expect(raw).toBe('{"2026-06-24":2}');
    });
  });

  describe('journal', () => {
    it('lists empty after seed (no — seeds 3 entries) and supports replace', () => {
      const repo = new LocalRepository();
      const seeded = repo.listJournal();
      expect(seeded.length).toBeGreaterThan(0);

      const newJournal: JournalEntry[] = [
        {
          id: 'j-new',
          date: '2026-06-24',
          title: 'X',
          minutes: 5,
          chords: ['C'],
          notes: '',
        },
      ];
      repo.setJournal(newJournal);
      expect(repo.listJournal()).toEqual(newJournal);
      const raw = localStorage.getItem(KEYS.journal);
      expect(raw).toBe(JSON.stringify(newJournal));
    });
  });

  describe('drills', () => {
    it('round-trips via setDrills/listDrills', () => {
      const repo = new LocalRepository();
      const drills: Drill[] = [
        { id: 'd1', title: 'a', target: 5, count: 0 },
        { id: 'd2', title: 'b', target: 8, count: 4 },
      ];
      repo.setDrills(drills);
      expect(repo.listDrills()).toEqual(drills);
    });
  });

  describe('collected', () => {
    it('round-trips via setCollected/listCollected', () => {
      const repo = new LocalRepository();
      const collected: CollectedChord[] = [
        {
          name: 'C',
          frets: ['x', 3, 2, 0, 1, 0],
          key: 'C',
        },
      ];
      repo.setCollected(collected);
      expect(repo.listCollected()).toEqual(collected);
    });
  });

  describe('lang', () => {
    it('round-trips via setLang/getLang', () => {
      const repo = new LocalRepository();
      repo.setLang('en');
      expect(repo.getLang()).toBe('en');
      repo.setLang('ko');
      expect(repo.getLang()).toBe('ko');
    });
  });

  describe('saveAll (batch)', () => {
    it('writes all provided slices, mirroring legacy save(Partial)', () => {
      const repo = new LocalRepository();
      repo.saveAll({
        grass: { '2026-06-24': 1 },
        journal: [
          {
            id: 'j1',
            date: '2026-06-24',
            title: 't',
            minutes: 10,
            chords: ['C'],
            notes: 'n',
          },
        ],
        drills: [{ id: 'd1', title: 'x', target: 5, count: 2 }],
        collected: [
          { name: 'C', frets: ['x', 3, 2, 0, 1, 0], key: 'C' },
        ],
        lang: 'en',
      });
      expect(localStorage.getItem(KEYS.grass)).toBe('{"2026-06-24":1}');
      expect(repo.getLang()).toBe('en');
      expect(repo.listDrills()).toHaveLength(1);
    });

    it('saveAll with empty/partial input is a no-op for missing keys', () => {
      const repo = new LocalRepository();
      // seed initial state
      repo.setGrass({ '2026-06-24': 9 });
      // partial save without grass should NOT clear it
      repo.saveAll({ lang: 'en' });
      expect(repo.getGrass()).toEqual({ '2026-06-24': 9 });
      expect(repo.getLang()).toBe('en');
    });

    it('saveAll swallows storage errors (quota / private mode safety)', () => {
      const repo = new LocalRepository();
      const original = Storage.prototype.setItem;
      // Force throws to mimic quota exceeded
      Storage.prototype.setItem = () => {
        throw new Error('QuotaExceededError');
      };
      try {
        // Should not throw
        expect(() =>
          repo.saveAll({ grass: { '2026-06-24': 1 } }),
        ).not.toThrow();
      } finally {
        Storage.prototype.setItem = original;
      }
    });
  });
});
