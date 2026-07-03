import { describe, it, expect, beforeEach } from 'vitest';
import { LocalRepository } from '../local-repository';
import { KEYS } from '../persist';
import { userKeyPrefix } from '../user-keys';

/**
 * PR⑤ 확장: LocalRepository 생성자 { keyPrefix?, seedOnEmpty? } (계획 17 §6).
 * 기본 생성자 동작은 local-repository.test.ts가 별도로 회귀 0 보장한다.
 */
describe('LocalRepository — keyPrefix (user namespace)', () => {
  beforeEach(() => localStorage.clear());

  it('writes to prefixed keys, not the legacy cs_* keys', () => {
    const prefix = userKeyPrefix('abc');
    const repo = new LocalRepository({ keyPrefix: prefix, seedOnEmpty: false });
    repo.setGrass({ '2026-07-01': 3 });
    expect(localStorage.getItem(`${prefix}${KEYS.grass}`)).toBe('{"2026-07-01":3}');
    // legacy key untouched.
    expect(localStorage.getItem(KEYS.grass)).toBeNull();
  });

  it('reads back from prefixed keys (round-trip)', () => {
    const repo = new LocalRepository({
      keyPrefix: userKeyPrefix('abc'),
      seedOnEmpty: false,
    });
    repo.setGrass({ d1: 2 });
    repo.setLang('en');
    expect(repo.getGrass()).toEqual({ d1: 2 });
    expect(repo.getLang()).toBe('en');
  });

  it('isolates two users by prefix', () => {
    const a = new LocalRepository({ keyPrefix: userKeyPrefix('A'), seedOnEmpty: false });
    const b = new LocalRepository({ keyPrefix: userKeyPrefix('B'), seedOnEmpty: false });
    a.setGrass({ d1: 1 });
    expect(a.getGrass()).toEqual({ d1: 1 });
    expect(b.getGrass()).toEqual({});
  });
});

describe('LocalRepository — seedOnEmpty:false (empty state, AC⑤-8)', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty state when storage empty (no seed)', () => {
    const repo = new LocalRepository({ keyPrefix: userKeyPrefix('x'), seedOnEmpty: false });
    const state = repo.loadAll();
    expect(state.grass).toEqual({});
    expect(state.journal).toEqual([]);
    expect(state.drills).toEqual([]);
    expect(state.collected).toEqual([]);
    expect(state.lang).toBe('ko');
  });

  it('per-entity getters also return empty when seedOnEmpty:false', () => {
    const repo = new LocalRepository({ seedOnEmpty: false });
    expect(repo.getGrass()).toEqual({});
    expect(repo.listJournal()).toEqual([]);
    expect(repo.listDrills()).toEqual([]);
    expect(repo.listCollected()).toEqual([]);
  });
});

describe('LocalRepository — default constructor unchanged (regression)', () => {
  beforeEach(() => localStorage.clear());

  it('new LocalRepository() still seeds and uses legacy cs_* keys', () => {
    const repo = new LocalRepository();
    const state = repo.loadAll();
    expect(Object.keys(state.grass).length).toBeGreaterThan(0);
    expect(state.collected.length).toBe(4);
    repo.setGrass({ d1: 9 });
    expect(localStorage.getItem(KEYS.grass)).toBe('{"d1":9}');
  });
});
