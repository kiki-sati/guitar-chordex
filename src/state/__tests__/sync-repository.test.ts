import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncRepo } from '../sync-repository';
import { createQueue } from '../../sync/queue';
import { clearUserCache, userCacheKeys, queueKey } from '../user-keys';
import type { SupabaseRepository } from '../supabase-repository';
import type { PersistedState } from '../persist';
import type { RepoChange } from '../repo-change';

const UID = 'user-1';

function base(over: Partial<PersistedState> = {}): PersistedState {
  return { grass: {}, journal: [], drills: [], collected: [], lang: 'ko', ...over };
}

function makeRemote(loadAllResult: PersistedState = base()) {
  const remote = {
    loadAll: vi.fn().mockResolvedValue(loadAllResult),
    saveGrass: vi.fn().mockResolvedValue(undefined),
    upsertJournal: vi.fn().mockResolvedValue(undefined),
    deleteJournal: vi.fn().mockResolvedValue(undefined),
    upsertDrill: vi.fn().mockResolvedValue(undefined),
    deleteDrill: vi.fn().mockResolvedValue(undefined),
    upsertCollected: vi.fn().mockResolvedValue(undefined),
    deleteCollected: vi.fn().mockResolvedValue(undefined),
    setLang: vi.fn().mockResolvedValue(undefined),
  };
  return remote as unknown as SupabaseRepository & typeof remote;
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
}

const GRASS_CHANGE: RepoChange = { kind: 'grass', day: 'd1', count: 1 };

beforeEach(() => {
  localStorage.clear();
  setOnline(true);
});
afterEach(() => setOnline(true));

describe('SyncRepo — loadCached (B5-S1)', () => {
  it('B5-S1: returns empty state immediately when cache empty (no seed)', () => {
    const repo = new SyncRepo({ remote: makeRemote(), userId: UID });
    expect(repo.loadCached()).toEqual(base());
  });

  it('returns cached data synchronously when present', () => {
    // pre-seed the user cache directly
    const pre = new SyncRepo({ remote: makeRemote(), userId: UID });
    void pre.apply([{ kind: 'lang', lang: 'en' }]);
    const repo = new SyncRepo({ remote: makeRemote(), userId: UID });
    expect(repo.loadCached().lang).toBe('en');
  });
});

describe('SyncRepo — apply online (B5-S2)', () => {
  it('B5-S2: merges cache + pushes change, queue stays empty', async () => {
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    expect(remote.saveGrass).toHaveBeenCalledWith({ d1: 1 });
    expect(repo.loadCached().grass).toEqual({ d1: 1 });
    expect(createQueue(UID).list()).toEqual([]);
  });
});

describe('SyncRepo — apply offline (B5-S3)', () => {
  it('B5-S3: offline → merges cache + enqueues, no remote call', async () => {
    setOnline(false);
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    expect(remote.saveGrass).not.toHaveBeenCalled();
    expect(repo.loadCached().grass).toEqual({ d1: 1 });
    const queued = createQueue(UID).list();
    expect(queued).toHaveLength(1);
    expect(queued[0].change).toEqual(GRASS_CHANGE);
  });

  it('online push failure falls back to enqueue (R9)', async () => {
    const remote = makeRemote();
    (remote.saveGrass as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('net'));
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    expect(createQueue(UID).list()).toHaveLength(1);
  });
});

describe('SyncRepo — online event flush (B5-S4)', () => {
  it('B5-S4: online event flushes queue and empties it', async () => {
    setOnline(false);
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    expect(createQueue(UID).list()).toHaveLength(1);

    // come back online
    repo.start(() => {});
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    // allow the async flush microtasks to settle
    await vi.waitFor(() => expect(createQueue(UID).list()).toEqual([]));
    expect(remote.saveGrass).toHaveBeenCalled();
    repo.dispose();
  });
});

describe('SyncRepo — idempotence (B5-S5)', () => {
  it('B5-S5: applying same change twice → cache identical to once (upsert)', async () => {
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    const once = repo.loadCached();
    await repo.apply([GRASS_CHANGE]);
    const twice = repo.loadCached();
    expect(twice).toEqual(once); // grass count is absolute value → same
  });
});

describe('SyncRepo — start / dispose (B5-S6)', () => {
  it('B5-S6: start runs initialSync and notifies onMerged once', async () => {
    const server = base({ grass: { d1: 5 } });
    const remote = makeRemote(server);
    const repo = new SyncRepo({ remote, userId: UID });
    const onMerged = vi.fn();
    repo.start(onMerged);
    await vi.waitFor(() => expect(onMerged).toHaveBeenCalledTimes(1));
    expect(onMerged.mock.calls[0][0].grass).toEqual({ d1: 5 });
    repo.dispose();
  });

  it('dispose removes the online listener (idempotent)', async () => {
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    repo.start(() => {});
    repo.dispose();
    expect(() => repo.dispose()).not.toThrow();
    // after dispose, an online event must not trigger a flush
    (remote.saveGrass as ReturnType<typeof vi.fn>).mockClear();
    setOnline(false);
    await repo.apply(GRASS_CHANGE ? [GRASS_CHANGE] : []);
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    // give any (unexpected) listener a chance
    await new Promise((r) => setTimeout(r, 20));
    expect(remote.saveGrass).not.toHaveBeenCalled();
  });
});

// ── dispose가 in-flight 비동기 쓰기까지 취소하는지 검증 ────────────────────
// (2026-07-03 교차 이음새 QA · AC⑤-9 공유기기 프라이버시 — 계획 §8.5)
//   로그아웃 시 clearUserCache(uid)가 캐시·큐를 물리 삭제한 뒤,
//   dispose된 SyncRepo가 띄운 늦게 resolve되는 initialSync/flushQueue/apply가
//   localStorage에 다시 쓰지 못해야(부활 금지) 한다.

/** 외부에서 resolve/reject를 제어하는 deferred promise. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** 늦게 resolve/reject된 async 체인(다중 await)이 완전히 settle되도록 대기. */
async function settle(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

/** userCacheKeys(uid) 전부가 localStorage에서 물리 삭제(부재)됐는지 단언. */
function expectUserCacheCleared(uid: string): void {
  for (const key of userCacheKeys(uid)) {
    expect(localStorage.getItem(key)).toBeNull();
  }
}

describe('SyncRepo — dispose cancels in-flight writes (AC⑤-9, 교차 이음새 QA)', () => {
  it('late initialSync must not resurrect user cache after logout clear', async () => {
    const load = deferred<PersistedState>();
    const remote = makeRemote();
    (remote.loadAll as ReturnType<typeof vi.fn>).mockReturnValueOnce(load.promise);
    const repo = new SyncRepo({ remote, userId: UID });
    const onMerged = vi.fn();

    repo.start(onMerged); // initialSync in-flight (loadAll pending)
    repo.dispose();
    clearUserCache(UID); // 로그아웃 물리 삭제

    load.resolve(base({ grass: { d1: 5 } })); // 늦게 resolve
    await settle();

    expectUserCacheCleared(UID); // saveAll(merged) 차단 → 캐시 부활 없음
    expect(onMerged).not.toHaveBeenCalled(); // dispose 후 React 통지 차단
  });

  it('late flushQueue must not resurrect the queue key after logout clear', async () => {
    // 오프라인 apply로 큐 1건 적재
    setOnline(false);
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    await repo.apply([GRASS_CHANGE]);
    expect(createQueue(UID).list()).toHaveLength(1);

    // 온라인 전환 + saveGrass를 deferred로 → flushQueue가 push에서 대기
    setOnline(true);
    const push = deferred<void>();
    (remote.saveGrass as ReturnType<typeof vi.fn>).mockReturnValueOnce(push.promise);

    repo.start(() => {}); // 즉시 flushQueue 시작(await pushChange 중)
    repo.dispose();
    clearUserCache(UID);

    push.resolve(); // 늦게 resolve → queue.remove(succeeded) 시도
    await settle();

    expect(localStorage.getItem(queueKey(UID))).toBeNull(); // 큐 키 부활 없음
  });

  it('in-flight apply push failure must not re-enqueue after logout clear', async () => {
    const remote = makeRemote();
    const push = deferred<void>();
    (remote.saveGrass as ReturnType<typeof vi.fn>).mockReturnValueOnce(push.promise);
    const repo = new SyncRepo({ remote, userId: UID });

    void repo.apply([GRASS_CHANGE]); // apply in-flight(await pushChange 중)
    await settle(); // saveAll·pushChange 진입 보장
    repo.dispose();
    clearUserCache(UID);

    push.reject(new Error('net')); // 늦게 reject → catch → enqueue 시도(차단돼야)
    await settle();

    expect(localStorage.getItem(queueKey(UID))).toBeNull(); // 큐 키 부활 없음
  });

  it('apply after dispose is a no-op (no cache write, no remote call)', async () => {
    const remote = makeRemote();
    const repo = new SyncRepo({ remote, userId: UID });
    repo.dispose();

    await repo.apply([GRASS_CHANGE]);

    expectUserCacheCleared(UID); // 캐시 미기록
    expect(remote.saveGrass).not.toHaveBeenCalled(); // remote 미호출
  });
});
