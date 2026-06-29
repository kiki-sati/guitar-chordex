import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CollectedChord,
  Drill,
  GrassMap,
  JournalEntry,
} from '../../domain/types';
import { SupabaseRepository } from '../supabase-repository';

const UID = 'user-123';

// ── supabase-js fluent 체이너 mock ───────────────────────────────────
// from(table) → { select, upsert, update } 체이너. 호출/인자 기록.
// select 경로: from().select().is('deleted_at', null)  → thenable({data, error})
// upsert 경로: from().upsert(payload, opts)             → thenable({error})
// update 경로: from().update(patch).eq(...).eq(...)     → thenable({error})

interface TableLog {
  table: string;
  selectArgs?: unknown[];
  isArgs?: unknown[][];
  upsertPayload?: unknown;
  upsertOpts?: unknown;
  updatePatch?: unknown;
  eqArgs: unknown[][];
}

/** 테이블별 select 시 반환할 데이터 행. */
type SelectData = Record<string, unknown[]>;

function makeMockClient(selectData: SelectData = {}) {
  const logs: TableLog[] = [];

  const client = {
    from(table: string) {
      const log: TableLog = { table, eqArgs: [] };
      logs.push(log);

      // select 경로 — .is(...)로 끝나며 thenable.
      const selectResult = {
        is(col: string, val: unknown) {
          log.isArgs = log.isArgs ?? [];
          log.isArgs.push([col, val]);
          return Promise.resolve({
            data: selectData[table] ?? [],
            error: null,
          });
        },
        // grass처럼 .is 없이 바로 await하는 경로(deleted_at 컬럼 없음).
        then(
          onFulfilled: (v: { data: unknown[]; error: null }) => unknown,
        ) {
          return Promise.resolve({
            data: selectData[table] ?? [],
            error: null,
          }).then(onFulfilled);
        },
      };

      // update().eq().eq() 경로 — 마지막 eq가 thenable.
      const updateChain = {
        eq(col: string, val: unknown) {
          log.eqArgs.push([col, val]);
          return {
            eq(col2: string, val2: unknown) {
              log.eqArgs.push([col2, val2]);
              return Promise.resolve({ error: null });
            },
            then(onFulfilled: (v: { error: null }) => unknown) {
              return Promise.resolve({ error: null }).then(onFulfilled);
            },
          };
        },
      };

      return {
        select(...args: unknown[]) {
          log.selectArgs = args;
          return selectResult;
        },
        upsert(payload: unknown, opts: unknown) {
          log.upsertPayload = payload;
          log.upsertOpts = opts;
          return Promise.resolve({ error: null });
        },
        update(patch: unknown) {
          log.updatePatch = patch;
          return updateChain;
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, logs };
}

function logFor(logs: TableLog[], table: string): TableLog {
  const found = [...logs].reverse().find((l) => l.table === table);
  if (!found) throw new Error(`no call recorded for table ${table}`);
  return found;
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('SupabaseRepository — 생성자 가드 (D6/AC-7)', () => {
  it('client=null이면 throw한다', () => {
    expect(() => new SupabaseRepository(null, UID)).toThrow(
      /Supabase client/i,
    );
  });

  it('client≠null이면 정상 인스턴스를 만든다', () => {
    const { client } = makeMockClient();
    expect(() => new SupabaseRepository(client, UID)).not.toThrow();
  });
});

describe('SupabaseRepository.loadAll (AC-8)', () => {
  it('5개 테이블을 select하고 deleted_at 있는 테이블에 is(deleted_at,null) 필터를 적용한다', async () => {
    const { client, logs } = makeMockClient();
    const repo = new SupabaseRepository(client, UID);
    await repo.loadAll();

    const tables = logs.map((l) => l.table);
    expect(tables).toContain('grass');
    expect(tables).toContain('journal_entries');
    expect(tables).toContain('drills');
    expect(tables).toContain('collected_chords');
    expect(tables).toContain('profiles');

    // soft-delete 테이블은 deleted_at is null 필터 필수.
    for (const t of ['journal_entries', 'drills', 'collected_chords']) {
      const l = logFor(logs, t);
      expect(l.isArgs).toEqual([['deleted_at', null]]);
    }
    // grass에는 deleted_at 컬럼이 없으므로 .is 미적용.
    expect(logFor(logs, 'grass').isArgs).toBeUndefined();
  });

  it('빈 테이블 → 빈 컬렉션 + lang=ko(seed 미적용, 정본 §7.1)', async () => {
    const { client } = makeMockClient();
    const repo = new SupabaseRepository(client, UID);
    const state = await repo.loadAll();
    expect(state.grass).toEqual({});
    expect(state.journal).toEqual([]);
    expect(state.drills).toEqual([]);
    expect(state.collected).toEqual([]);
    expect(state.lang).toBe('ko');
  });

  it('mock 행 → mappers 경유로 도메인 객체 복원(journal entry_date→date)', async () => {
    const { client } = makeMockClient({
      journal_entries: [
        {
          id: 'j1',
          user_id: UID,
          entry_date: '2026-06-24',
          title: 't',
          minutes: 10,
          chords: ['C'],
          notes: 'n',
          deleted_at: null,
          updated_at: 'x',
        },
      ],
      grass: [
        { user_id: UID, day: '2026-06-24', count: 3, updated_at: 'x' },
        { user_id: UID, day: '2026-06-25', count: 0, updated_at: 'x' },
      ],
      profiles: [{ id: UID, lang: 'en', migrated_at: null, created_at: 'x', updated_at: 'x' }],
    });
    const repo = new SupabaseRepository(client, UID);
    const state = await repo.loadAll();
    expect(state.journal).toEqual([
      { id: 'j1', date: '2026-06-24', title: 't', minutes: 10, chords: ['C'], notes: 'n' },
    ]);
    // grass count>0 필터.
    expect(state.grass).toEqual({ '2026-06-24': 3 });
    // profiles.lang 반영.
    expect(state.lang).toBe('en');
  });
});

describe('SupabaseRepository — per-entity 쓰기 (AC-9/AC-10)', () => {
  const repoWith = (selectData?: SelectData) => {
    const { client, logs } = makeMockClient(selectData);
    return { repo: new SupabaseRepository(client, UID), logs };
  };

  it('saveGrass: grass upsert(onConflict user_id,day), rows에 user_id/updated_at 포함', async () => {
    const { repo, logs } = repoWith();
    const map: GrassMap = { '2026-06-24': 3, '2026-06-25': 1 };
    await repo.saveGrass(map);
    const l = logFor(logs, 'grass');
    expect(l.upsertOpts).toEqual({ onConflict: 'user_id,day' });
    const rows = l.upsertPayload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.user_id).toBe(UID);
      expect(typeof r.updated_at).toBe('string');
    }
  });

  it('upsertJournal: journal_entries upsert(onConflict id), entry_date 포함', async () => {
    const { repo, logs } = repoWith();
    const entry: JournalEntry = {
      id: 'j1',
      date: '2026-06-24',
      title: 't',
      minutes: 5,
      chords: ['C'],
      notes: 'n',
    };
    await repo.upsertJournal(entry);
    const l = logFor(logs, 'journal_entries');
    expect(l.upsertOpts).toEqual({ onConflict: 'id' });
    const row = l.upsertPayload as Record<string, unknown>;
    expect(row.entry_date).toBe('2026-06-24');
    expect(row.user_id).toBe(UID);
    expect(typeof row.updated_at).toBe('string');
  });

  it('deleteJournal: soft-delete update(deleted_at,updated_at) eq(id).eq(user_id)', async () => {
    const { repo, logs } = repoWith();
    await repo.deleteJournal('j1');
    const l = logFor(logs, 'journal_entries');
    const patch = l.updatePatch as Record<string, unknown>;
    expect(typeof patch.deleted_at).toBe('string');
    expect(typeof patch.updated_at).toBe('string');
    expect(l.eqArgs).toEqual([
      ['id', 'j1'],
      ['user_id', UID],
    ]);
  });

  it('upsertDrill: onConflict id + sort_order 포함', async () => {
    const { repo, logs } = repoWith();
    const drill: Drill = { id: 'd1', title: 't', target: 5, count: 2 };
    await repo.upsertDrill(drill, 3);
    const l = logFor(logs, 'drills');
    expect(l.upsertOpts).toEqual({ onConflict: 'id' });
    const row = l.upsertPayload as Record<string, unknown>;
    expect(row.sort_order).toBe(3);
    expect(row.user_id).toBe(UID);
  });

  it('deleteDrill: soft-delete 경로', async () => {
    const { repo, logs } = repoWith();
    await repo.deleteDrill('d1');
    const l = logFor(logs, 'drills');
    const patch = l.updatePatch as Record<string, unknown>;
    expect(typeof patch.deleted_at).toBe('string');
    expect(l.eqArgs).toEqual([
      ['id', 'd1'],
      ['user_id', UID],
    ]);
  });

  it('upsertCollected: collected_chords upsert(onConflict user_id,name), id 미포함(D4)', async () => {
    const { repo, logs } = repoWith();
    const chord: CollectedChord = {
      name: 'Cmaj7',
      frets: ['x', 3, 2, 0, 0, 0],
      key: 'Cmaj7',
    };
    await repo.upsertCollected(chord);
    const l = logFor(logs, 'collected_chords');
    expect(l.upsertOpts).toEqual({ onConflict: 'user_id,name' });
    const row = l.upsertPayload as Record<string, unknown>;
    expect('id' in row).toBe(false);
    expect(row.chord_key).toBe('Cmaj7');
    expect(row.user_id).toBe(UID);
  });

  it('deleteCollected: soft-delete by (user_id,name) 자연키(D4)', async () => {
    const { repo, logs } = repoWith();
    await repo.deleteCollected('Cmaj7');
    const l = logFor(logs, 'collected_chords');
    const patch = l.updatePatch as Record<string, unknown>;
    expect(typeof patch.deleted_at).toBe('string');
    expect(l.eqArgs).toEqual([
      ['user_id', UID],
      ['name', 'Cmaj7'],
    ]);
  });

  it('setLang: profiles upsert({id,lang,updated_at}, onConflict id)', async () => {
    const { repo, logs } = repoWith();
    await repo.setLang('en');
    const l = logFor(logs, 'profiles');
    expect(l.upsertOpts).toEqual({ onConflict: 'id' });
    const row = l.upsertPayload as Record<string, unknown>;
    expect(row.id).toBe(UID);
    expect(row.lang).toBe('en');
    expect(typeof row.updated_at).toBe('string');
  });
});

describe('SupabaseRepository — 에러 전파 (호출자 재시도 위임)', () => {
  it('upsert가 {error}를 반환하면 reject한다', async () => {
    const errorClient = {
      from() {
        return {
          upsert() {
            return Promise.resolve({ error: { message: 'boom' } });
          },
        };
      },
    } as unknown as SupabaseClient;
    const repo = new SupabaseRepository(errorClient, UID);
    await expect(repo.saveGrass({ '2026-06-24': 1 })).rejects.toThrow();
  });
});
