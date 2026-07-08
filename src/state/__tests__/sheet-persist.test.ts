import { describe, it, expect, beforeEach } from 'vitest';
import {
  SHEETS_KEY,
  loadSheets,
  saveSheets,
} from '../sheet-persist';
import type { Sheet } from '../../domain/types';

const sampleSheet: Sheet = {
  id: 'sh1',
  title: '테스트 악보',
  seq: [
    { name: 'C', frets: ['x', 3, 2, 0, 1, 0] },
    null,
    { name: 'G', frets: [3, 2, 0, 0, 0, 3] },
    null,
  ],
  timeSig: '4/4',
  date: '2026-07-08',
};

/**
 * sheet-persist는 악보 빌더 전용 localStorage 유틸(cs_sheets).
 * PR-1은 로컬 전용 — 동기화 계층(PersistedState/Repository/diff-changes)과 완전 분리.
 * 계획 §6.3: 동기화 코드가 sheets를 건드리지 않도록 별도 키/유틸로 격리.
 */
describe('sheet-persist', () => {
  beforeEach(() => localStorage.clear());

  it('SHEETS_KEY is cs_sheets (localStorage 키 규약)', () => {
    expect(SHEETS_KEY).toBe('cs_sheets');
  });

  it('loadSheets returns [] when empty (시드 없음 — 빈 배열 초기값)', () => {
    expect(loadSheets()).toEqual([]);
  });

  it('loadSheets returns [] on corrupted JSON (관용)', () => {
    localStorage.setItem('cs_sheets', '{broken');
    expect(loadSheets()).toEqual([]);
  });

  it('saveSheets then loadSheets round-trips (sparse null 보존)', () => {
    saveSheets([sampleSheet]);
    const loaded = loadSheets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(sampleSheet);
    // sparse null 보존 확인
    expect(loaded[0].seq[1]).toBeNull();
    expect(loaded[0].seq[3]).toBeNull();
  });

  it('saveSheets writes to cs_sheets key as JSON', () => {
    saveSheets([sampleSheet]);
    const raw = localStorage.getItem('cs_sheets');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual([sampleSheet]);
  });

  it('saveSheets swallows quota/serialization errors (관용)', () => {
    // 정상 케이스에서 예외를 던지지 않음을 확인(스모크)
    expect(() => saveSheets([])).not.toThrow();
  });
});
