import { describe, it, expect, beforeEach } from 'vitest';
import { createQueue } from '../queue';
import type { QueueItem } from '../../state/repo-change';

const UID = 'user-A';

function item(
  id: string,
  change: QueueItem['change'],
  updatedAt = '2026-07-01T00:00:00.000Z',
): QueueItem {
  return { id, change, updatedAt };
}

beforeEach(() => localStorage.clear());

describe('SyncQueue — enqueue / list (FIFO)', () => {
  it('B5-Q1: enqueue then list preserves FIFO order', () => {
    const q = createQueue(UID);
    q.enqueue(item('1', { kind: 'journal', op: 'delete', id: 'j1' }));
    q.enqueue(item('2', { kind: 'journal', op: 'delete', id: 'j2' }));
    q.enqueue(item('3', { kind: 'journal', op: 'delete', id: 'j3' }));
    expect(q.list().map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  it('starts empty', () => {
    expect(createQueue(UID).list()).toEqual([]);
  });
});

describe('SyncQueue — remove', () => {
  it('B5-Q2: remove(ids) leaves only the remaining items', () => {
    const q = createQueue(UID);
    q.enqueue(item('1', { kind: 'journal', op: 'delete', id: 'j1' }));
    q.enqueue(item('2', { kind: 'journal', op: 'delete', id: 'j2' }));
    q.enqueue(item('3', { kind: 'journal', op: 'delete', id: 'j3' }));
    q.remove(['1', '3']);
    expect(q.list().map((i) => i.id)).toEqual(['2']);
  });
});

describe('SyncQueue — clear', () => {
  it('empties the queue', () => {
    const q = createQueue(UID);
    q.enqueue(item('1', { kind: 'lang', lang: 'en' }));
    q.clear();
    expect(q.list()).toEqual([]);
  });
});

describe('SyncQueue — compaction (same target latest only §8.2)', () => {
  it('B5-Q3: enqueuing the same grass day twice keeps only the last', () => {
    const q = createQueue(UID);
    q.enqueue(item('1', { kind: 'grass', day: 'd1', count: 1 }));
    q.enqueue(item('2', { kind: 'grass', day: 'd1', count: 2 }));
    const list = q.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('2');
    expect(list[0].change).toEqual({ kind: 'grass', day: 'd1', count: 2 });
  });

  it('different grass days are both kept', () => {
    const q = createQueue(UID);
    q.enqueue(item('1', { kind: 'grass', day: 'd1', count: 1 }));
    q.enqueue(item('2', { kind: 'grass', day: 'd2', count: 1 }));
    expect(q.list()).toHaveLength(2);
  });

  it('journal upsert then delete of same id compacts to the latest (delete)', () => {
    const q = createQueue(UID);
    q.enqueue(
      item('1', {
        kind: 'journal',
        op: 'upsert',
        entry: { id: 'j1', date: 'd', title: 't', minutes: 1, chords: [], notes: '' },
      }),
    );
    q.enqueue(item('2', { kind: 'journal', op: 'delete', id: 'j1' }));
    const list = q.list();
    expect(list).toHaveLength(1);
    expect(list[0].change).toEqual({ kind: 'journal', op: 'delete', id: 'j1' });
  });

  it('collected upsert/delete compacts by name', () => {
    const q = createQueue(UID);
    q.enqueue(
      item('1', {
        kind: 'collected',
        op: 'upsert',
        chord: { name: 'C', frets: ['x', 3, 2, 0, 1, 0], key: 'C' },
      }),
    );
    q.enqueue(item('2', { kind: 'collected', op: 'delete', name: 'C' }));
    const list = q.list();
    expect(list).toHaveLength(1);
    expect(list[0].change).toEqual({ kind: 'collected', op: 'delete', name: 'C' });
  });

  it('drill compacts by id; lang compacts to single', () => {
    const q = createQueue(UID);
    q.enqueue(item('1', { kind: 'lang', lang: 'ko' }));
    q.enqueue(item('2', { kind: 'lang', lang: 'en' }));
    q.enqueue(item('3', { kind: 'drill', op: 'delete', id: 'd1' }));
    q.enqueue(item('4', { kind: 'drill', op: 'delete', id: 'd1' }));
    const list = q.list();
    expect(list.filter((i) => i.change.kind === 'lang')).toHaveLength(1);
    expect(list.filter((i) => i.change.kind === 'drill')).toHaveLength(1);
  });
});

describe('SyncQueue — user-prefix isolation', () => {
  it('B5-Q4: queues for different uids are isolated', () => {
    const qA = createQueue('user-A');
    const qB = createQueue('user-B');
    qA.enqueue(item('1', { kind: 'lang', lang: 'en' }));
    expect(qA.list()).toHaveLength(1);
    expect(qB.list()).toEqual([]);
  });
});

describe('SyncQueue — corruption safety', () => {
  it('returns [] when stored JSON is corrupted', () => {
    const q = createQueue(UID);
    localStorage.setItem('u:user-A:cs_queue', '{not json');
    expect(q.list()).toEqual([]);
  });
});
