import type { QueueItem, RepoChange } from '../state/repo-change';
import { queueKey } from '../state/user-keys';

/**
 * 오프라인 큐 (계획 17 §8.2). localStorage 직접(React 무의존) — 테스트 1급.
 * 키: `${userKeyPrefix(uid)}cs_queue`.
 *
 * 멱등은 서버 upsert가 보장(§8.5)하므로 큐 압축은 정확성이 아니라 효율용이다:
 * 같은 대상(grass day / journal·drill id / collected name / lang)의 기존 항목을
 * enqueue 시 제거하고 최신만 남긴다 → 큐 비대·중복 push 감소.
 */
export interface SyncQueue {
  /** 큐 전체(FIFO 순서). */
  list(): QueueItem[];
  /** append(+ 동일 대상 압축). */
  enqueue(item: QueueItem): void;
  /** flush 성공분 제거. */
  remove(ids: string[]): void;
  /** 로그아웃 정리. */
  clear(): void;
}

/** change의 압축 대상 식별키. 같은 키를 가진 항목은 최신 하나만 유효. */
function targetKey(change: RepoChange): string {
  switch (change.kind) {
    case 'grass':
      return `grass:${change.day}`;
    case 'journal':
      return `journal:${change.op === 'upsert' ? change.entry.id : change.id}`;
    case 'drill':
      return `drill:${change.op === 'upsert' ? change.drill.id : change.id}`;
    case 'collected':
      return `collected:${change.op === 'upsert' ? change.chord.name : change.name}`;
    case 'lang':
      return 'lang';
  }
}

export function createQueue(uid: string): SyncQueue {
  const key = queueKey(uid);

  const read = (): QueueItem[] => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
    } catch {
      return [];
    }
  };

  const write = (items: QueueItem[]): void => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* no-op (quota / private mode) */
    }
  };

  return {
    list: read,
    enqueue(item) {
      const tk = targetKey(item.change);
      const items = read().filter((i) => targetKey(i.change) !== tk);
      items.push(item);
      write(items);
    },
    remove(ids) {
      const idSet = new Set(ids);
      write(read().filter((i) => !idSet.has(i.id)));
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* no-op */
      }
    },
  };
}
