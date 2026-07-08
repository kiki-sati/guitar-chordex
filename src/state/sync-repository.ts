import type { AsyncRepository } from './repository';
import type { PersistedState } from './persist';
import type { QueueItem, RepoChange } from './repo-change';
import type { SupabaseRepository } from './supabase-repository';
import { LocalRepository } from './local-repository';
import { applyChanges } from './apply-changes';
import { userKeyPrefix } from './user-keys';
import { createQueue, type SyncQueue } from '../sync/queue';
import { initialSync, flushQueue, pushChange } from '../sync/syncEngine';
import { isOnline, onOnline } from '../sync/net';

/**
 * AsyncRepository 구현 (계획 17 §8.5). LocalRepository(user-prefix 캐시) +
 * offline queue + syncEngine(SupabaseRepository 소비) + net 조합.
 *
 *   loadCached(): 캐시 즉시 반환(빈 상태 가능, seed 없음).
 *   start(onMerged): initialSync → onMerged 통지 + 미전송 큐 flush + online 리스너.
 *   apply(changes): 캐시 낙관적 머지 + (온라인) push / (오프라인·실패) enqueue.
 *   dispose(): online 리스너 해제 + in-flight 비동기 쓰기 취소(멱등).
 *
 * 멱등(AC⑤-5): 모든 push가 upsert, 캐시 적용도 자연키 upsert → change 2회 = 1회.
 *
 * dispose 후 부활 방지(AC⑤-9 공유기기 프라이버시): 로그아웃 시 clearUserCache가
 * 캐시·큐를 물리 삭제한 뒤, start()가 띄운 늦게 resolve되는 initialSync/flushQueue와
 * in-flight apply가 localStorage에 다시 쓰지 못하도록 `disposed` 플래그로 가드한다
 * (syncEngine에는 `isCancelled`로 전달 — §8.5).
 */
export interface SyncRepoDeps {
  remote: SupabaseRepository;
  userId: string;
}

export class SyncRepo implements AsyncRepository {
  private readonly remote: SupabaseRepository;
  private readonly local: LocalRepository;
  private readonly queue: SyncQueue;
  private unsub: (() => void) | null = null;
  /** dispose(로그아웃) 여부. in-flight 비동기 쓰기 취소 가드(AC⑤-9). */
  private disposed = false;

  constructor(deps: SyncRepoDeps) {
    this.remote = deps.remote;
    this.local = new LocalRepository({
      keyPrefix: userKeyPrefix(deps.userId),
      seedOnEmpty: false,
    });
    this.queue = createQueue(deps.userId);
  }

  loadCached(): PersistedState {
    return this.local.loadAll();
  }

  start(onMerged: (merged: PersistedState) => void): void {
    const isCancelled = () => this.disposed;
    // 초기 pull → merge → 통지(1회). 실패는 삼키고 캐시로 계속(오프라인 우선).
    // dispose 후 늦게 resolve되면 saveAll/통지를 건너뛴다(부활 방지 — AC⑤-9).
    void initialSync({ remote: this.remote, local: this.local, queue: this.queue, isCancelled })
      .then((merged) => {
        if (!this.disposed) onMerged(merged);
      })
      .catch(() => {});
    // 미전송 큐 flush(온라인일 때).
    if (isOnline()) {
      void flushQueue({
        remote: this.remote,
        local: this.local,
        queue: this.queue,
        isCancelled,
      }).catch(() => {});
    }
    // online 복귀 시 재flush. dispose 전 중복 등록 방지(멱등).
    if (!this.unsub) {
      this.unsub = onOnline(() => {
        void flushQueue({
          remote: this.remote,
          local: this.local,
          queue: this.queue,
          isCancelled,
        }).catch(() => {});
      });
    }
  }

  async apply(changes: RepoChange[]): Promise<void> {
    if (this.disposed) return; // dispose(로그아웃) 후 no-op — 캐시·큐 부활 방지(AC⑤-9).
    if (changes.length === 0) return;

    // 1) 캐시 낙관적 머지.
    const next = applyChanges(this.local.loadAll(), changes);
    this.local.saveAll(next);

    // 2) 각 change: 온라인이면 push 시도(실패=enqueue), 오프라인이면 enqueue.
    const online = isOnline();
    for (const change of changes) {
      if (online) {
        try {
          await pushChange(this.remote, change);
        } catch {
          this.enqueue(change);
        }
      } else {
        this.enqueue(change);
      }
    }
  }

  /**
   * online 리스너 해제 + in-flight 비동기 쓰기 취소(멱등).
   * disposed 플래그를 세워 늦게 resolve되는 initialSync/flushQueue와 in-flight
   * apply의 실패 폴백 enqueue가 로그아웃으로 지워진 localStorage를 부활시키는 것을
   * 막는다(AC⑤-9 공유기기 프라이버시).
   */
  dispose(): void {
    this.disposed = true;
    this.unsub?.();
    this.unsub = null;
  }

  private enqueue(change: RepoChange): void {
    if (this.disposed) return; // in-flight apply가 dispose 후 실패 폴백으로 큐를 부활시키지 못하게(AC⑤-9).
    const item: QueueItem = {
      id: crypto.randomUUID(),
      change,
      updatedAt: new Date().toISOString(),
    };
    this.queue.enqueue(item);
  }
}
