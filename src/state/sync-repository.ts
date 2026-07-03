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
 *   dispose(): online 리스너 해제(멱등).
 *
 * 멱등(AC⑤-5): 모든 push가 upsert, 캐시 적용도 자연키 upsert → change 2회 = 1회.
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
    // 초기 pull → merge → 통지(1회). 실패는 삼키고 캐시로 계속(오프라인 우선).
    void initialSync({ remote: this.remote, local: this.local, queue: this.queue })
      .then(onMerged)
      .catch(() => {});
    // 미전송 큐 flush(온라인일 때).
    if (isOnline()) {
      void flushQueue({ remote: this.remote, local: this.local, queue: this.queue }).catch(
        () => {},
      );
    }
    // online 복귀 시 재flush. dispose 전 중복 등록 방지(멱등).
    if (!this.unsub) {
      this.unsub = onOnline(() => {
        void flushQueue({
          remote: this.remote,
          local: this.local,
          queue: this.queue,
        }).catch(() => {});
      });
    }
  }

  async apply(changes: RepoChange[]): Promise<void> {
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

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
  }

  private enqueue(change: RepoChange): void {
    const item: QueueItem = {
      id: crypto.randomUUID(),
      change,
      updatedAt: new Date().toISOString(),
    };
    this.queue.enqueue(item);
  }
}
