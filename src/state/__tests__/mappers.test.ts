import { describe, it, expect } from 'vitest';
import type {
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
} from '../../domain/types';
import {
  grassMapToRows,
  grassRowsToMap,
  journalToRow,
  rowToJournal,
  drillToRow,
  rowToDrill,
  collectedToRow,
  rowToCollected,
  type CollectedRow,
  type DrillRow,
  type JournalRow,
} from '../mappers';

const UID = 'user-123';
const ISO = '2026-06-29T00:00:00.000Z';

describe('mappers — grass (객체 ↔ 행, 정본 §2.4)', () => {
  it('grassMapToRows → grassRowsToMap 라운드트립 동치(여러 day)', () => {
    const map: GrassMap = {
      '2026-06-24': 3,
      '2026-06-25': 1,
      '2026-06-28': 7,
    };
    const rows = grassMapToRows(map, UID, ISO);
    expect(grassRowsToMap(rows)).toEqual(map);
  });

  it('grassRowsToMap이 count===0 행을 제외한다(필터)', () => {
    const rows = grassMapToRows({ '2026-06-24': 0, '2026-06-25': 2 }, UID, ISO);
    const map = grassRowsToMap(rows);
    expect(map).toEqual({ '2026-06-25': 2 });
    expect('2026-06-24' in map).toBe(false);
  });

  it('grassMapToRows가 모든 행에 동일 user_id·updated_at을 부여한다', () => {
    const rows = grassMapToRows({ '2026-06-24': 3, '2026-06-25': 1 }, UID, ISO);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.user_id).toBe(UID);
      expect(r.updated_at).toBe(ISO);
    }
  });
});

describe('mappers — journal (snake ↔ camel)', () => {
  const entry: JournalEntry = {
    id: 'j1',
    date: '2026-06-24',
    title: '연습',
    minutes: 30,
    chords: ['Cmaj7', 'Am7'],
    notes: '바레 연습',
  };

  it('journalToRow → rowToJournal 라운드트립: date↔entry_date, chords 보존', () => {
    const partial = journalToRow(entry, UID, ISO);
    const row: JournalRow = { ...partial, deleted_at: null };
    expect(row.entry_date).toBe('2026-06-24');
    expect(row.chords).toEqual(['Cmaj7', 'Am7']);
    expect(rowToJournal(row)).toEqual(entry);
  });

  it('rowToJournal은 user_id/deleted_at/updated_at을 도메인으로 누출하지 않는다', () => {
    const partial = journalToRow(entry, UID, ISO);
    const row: JournalRow = { ...partial, deleted_at: null };
    const restored = rowToJournal(row);
    expect(restored).not.toHaveProperty('user_id');
    expect(restored).not.toHaveProperty('deleted_at');
    expect(restored).not.toHaveProperty('updated_at');
    expect(restored).not.toHaveProperty('entry_date');
  });

  it('journalToRow가 user_id/updated_at을 주입한다', () => {
    const row = journalToRow(entry, UID, ISO);
    expect(row.user_id).toBe(UID);
    expect(row.updated_at).toBe(ISO);
    expect(row.id).toBe('j1');
  });
});

describe('mappers — drill (snake ↔ camel, null ↔ undefined)', () => {
  const fullDrill: Drill = {
    id: 'd1',
    title: '드릴',
    target: 10,
    count: 4,
    seq: [{ name: 'C', frets: ['x', 3, 2, 0, 1, 0] }],
    sheetId: 'sheet-9',
    timeSig: '4/4',
  };
  const minimalDrill: Drill = {
    id: 'd2',
    title: '미니멀',
    target: 5,
    count: 0,
  };

  it('drillToRow → rowToDrill 라운드트립(full): sheetId↔sheet_id, timeSig↔time_sig, seq 보존', () => {
    const partial = drillToRow(fullDrill, UID, ISO, 0);
    const row: DrillRow = { ...partial, deleted_at: null };
    expect(row.sheet_id).toBe('sheet-9');
    expect(row.time_sig).toBe('4/4');
    expect(row.seq).toEqual(fullDrill.seq);
    expect(rowToDrill(row)).toEqual(fullDrill);
  });

  it('rowToDrill: sheet_id=null → sheetId undefined, seq=null → undefined, time_sig=null → undefined', () => {
    const partial = drillToRow(minimalDrill, UID, ISO, 3);
    const row: DrillRow = { ...partial, deleted_at: null };
    expect(row.sheet_id).toBeNull();
    expect(row.seq).toBeNull();
    expect(row.time_sig).toBeNull();
    const restored = rowToDrill(row);
    expect(restored).toEqual(minimalDrill);
    expect('sheetId' in restored).toBe(false);
    expect('seq' in restored).toBe(false);
    expect('timeSig' in restored).toBe(false);
  });

  it('drillToRow가 sort_order/user_id/updated_at을 주입한다', () => {
    const row = drillToRow(minimalDrill, UID, ISO, 7);
    expect(row.sort_order).toBe(7);
    expect(row.user_id).toBe(UID);
    expect(row.updated_at).toBe(ISO);
  });

  it('rowToDrill은 user_id/sort_order/deleted_at을 도메인으로 누출하지 않는다', () => {
    const partial = drillToRow(fullDrill, UID, ISO, 0);
    const row: DrillRow = { ...partial, deleted_at: null };
    const restored = rowToDrill(row);
    expect(restored).not.toHaveProperty('user_id');
    expect(restored).not.toHaveProperty('sort_order');
    expect(restored).not.toHaveProperty('deleted_at');
    expect(restored).not.toHaveProperty('updated_at');
  });
});

describe('mappers — collected (id 없음 — name 자연키, D4)', () => {
  const chord: CollectedChord = {
    name: 'Cmaj7',
    frets: ['x', 3, 2, 0, 0, 0],
    key: 'Cmaj7',
  };

  it('collectedToRow → rowToCollected 라운드트립: key↔chord_key, frets 보존, id 미생성', () => {
    const partial = collectedToRow(chord, UID, ISO);
    // partial은 id/deleted_at을 만들지 않는다(서버가 (user_id,name)로 관리).
    expect('id' in partial).toBe(false);
    expect('deleted_at' in partial).toBe(false);
    expect(partial.chord_key).toBe('Cmaj7');
    expect(partial.name).toBe('Cmaj7');
    expect(partial.frets).toEqual(['x', 3, 2, 0, 0, 0]);
    // rowToCollected는 서버에서 온 전체 행(id/deleted_at 포함)을 도메인으로 복원.
    const row: CollectedRow = {
      ...partial,
      id: 'server-uuid',
      deleted_at: null,
    };
    expect(rowToCollected(row)).toEqual(chord);
  });

  it('rowToCollected는 name/frets/key만 복원하고 id/user_id/chord_key/deleted_at을 누출하지 않는다', () => {
    const row: CollectedRow = {
      id: 'server-uuid',
      user_id: UID,
      name: 'Am7',
      frets: ['x', 0, 2, 0, 1, 0],
      chord_key: 'Am7',
      deleted_at: null,
      updated_at: ISO,
    };
    const restored = rowToCollected(row);
    expect(Object.keys(restored).sort()).toEqual(['frets', 'key', 'name']);
    expect(restored.name).toBe('Am7');
    expect(restored.key).toBe('Am7');
  });

  it('collectedToRow가 user_id/updated_at을 주입한다', () => {
    const row = collectedToRow(chord, UID, ISO);
    expect(row.user_id).toBe(UID);
    expect(row.updated_at).toBe(ISO);
  });
});

describe('mappers — 입력 불변성(*ToRow가 도메인 객체를 변형하지 않음)', () => {
  it('journalToRow는 입력 entry를 변형하지 않는다', () => {
    const entry: JournalEntry = {
      id: 'j1',
      date: '2026-06-24',
      title: 't',
      minutes: 5,
      chords: ['C'],
      notes: 'n',
    };
    const snapshot = JSON.stringify(entry);
    journalToRow(entry, UID, ISO);
    expect(JSON.stringify(entry)).toBe(snapshot);
  });

  it('drillToRow는 입력 drill을 변형하지 않는다', () => {
    const drill: Drill = { id: 'd1', title: 't', target: 5, count: 1 };
    const snapshot = JSON.stringify(drill);
    drillToRow(drill, UID, ISO, 0);
    expect(JSON.stringify(drill)).toBe(snapshot);
  });

  it('grassMapToRows는 입력 map을 변형하지 않는다', () => {
    const map: GrassMap = { '2026-06-24': 3 };
    const snapshot = JSON.stringify(map);
    grassMapToRows(map, UID, ISO);
    expect(JSON.stringify(map)).toBe(snapshot);
  });
});
