import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from '../supabase-repository';

const UID = 'user-123';

/**
 * getMigratedAt/setMigratedAt (PR⑤ §9.3) 전용 mock.
 * select 경로: from('profiles').select('migrated_at').eq('id', uid).maybeSingle()
 * upsert 경로: from('profiles').upsert(payload, opts)
 */
interface Log {
  table: string;
  selectArg?: string;
  eqArgs: unknown[][];
  maybeSingleCalled?: boolean;
  upsertPayload?: unknown;
  upsertOpts?: unknown;
}

function makeClient(selectRow: Record<string, unknown> | null) {
  const logs: Log[] = [];
  const client = {
    from(table: string) {
      const log: Log = { table, eqArgs: [] };
      logs.push(log);
      return {
        select(arg: string) {
          log.selectArg = arg;
          return {
            eq(col: string, val: unknown) {
              log.eqArgs.push([col, val]);
              return {
                maybeSingle() {
                  log.maybeSingleCalled = true;
                  return Promise.resolve({ data: selectRow, error: null });
                },
              };
            },
          };
        },
        upsert(payload: unknown, opts: unknown) {
          log.upsertPayload = payload;
          log.upsertOpts = opts;
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, logs };
}

describe('SupabaseRepository.getMigratedAt', () => {
  it('selects migrated_at from profiles where id=uid; returns value', async () => {
    const { client, logs } = makeClient({ migrated_at: '2026-07-01T00:00:00.000Z' });
    const repo = new SupabaseRepository(client, UID);
    const result = await repo.getMigratedAt();
    expect(result).toBe('2026-07-01T00:00:00.000Z');
    const log = logs.find((l) => l.table === 'profiles')!;
    expect(log.selectArg).toBe('migrated_at');
    expect(log.eqArgs).toEqual([['id', UID]]);
    expect(log.maybeSingleCalled).toBe(true);
  });

  it('returns null when profile row missing', async () => {
    const { client } = makeClient(null);
    const repo = new SupabaseRepository(client, UID);
    expect(await repo.getMigratedAt()).toBeNull();
  });

  it('returns null when migrated_at is null', async () => {
    const { client } = makeClient({ migrated_at: null });
    const repo = new SupabaseRepository(client, UID);
    expect(await repo.getMigratedAt()).toBeNull();
  });
});

describe('SupabaseRepository.setMigratedAt', () => {
  it('upserts profiles {id, migrated_at, updated_at} onConflict id', async () => {
    const { client, logs } = makeClient(null);
    const repo = new SupabaseRepository(client, UID);
    await repo.setMigratedAt('2026-07-02T00:00:00.000Z');
    const log = logs.find((l) => l.table === 'profiles')!;
    expect(log.upsertOpts).toEqual({ onConflict: 'id' });
    const row = log.upsertPayload as Record<string, unknown>;
    expect(row.id).toBe(UID);
    expect(row.migrated_at).toBe('2026-07-02T00:00:00.000Z');
    expect(typeof row.updated_at).toBe('string');
  });
});
