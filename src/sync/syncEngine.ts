import type { SupabaseRepository } from '../state/supabase-repository';
import type { LocalRepository } from '../state/local-repository';
import type { PersistedState } from '../state/persist';
import type { RepoChange } from '../state/repo-change';
import type { SyncQueue } from './queue';
import { mergePersisted } from './merge';

/**
 * 동기화 엔진 (계획 17 §8.3, 정본 05 §6.3). SupabaseRepository·merge·queue 소비.
 * React 무의존 — 테스트 1급 모듈.
 */
export interface SyncEngineDeps {
  /** src/state/supabase-repository.ts 인스턴스(서버 어댑터). */
  remote: SupabaseRepository;
  /** user-prefix 캐시 repo. */
  local: LocalRepository;
  /** 오프라인 큐. */
  queue: SyncQueue;
}

/**
 * 단일 change 즉시 push(온라인). change → remote per-entity 메서드 매핑(§8.3).
 * 실패 시 throw → 호출자(SyncRepo/flushQueue)가 큐 잔류를 책임진다.
 */
export async function pushChange(
  remote: SupabaseRepository,
  change: RepoChange,
): Promise<void> {
  switch (change.kind) {
    case 'grass':
      // grass day 1건만 upsert(전체 GrassMap 아님 — §2.2).
      await remote.saveGrass({ [change.day]: change.count });
      return;
    case 'journal':
      if (change.op === 'upsert') await remote.upsertJournal(change.entry);
      else await remote.deleteJournal(change.id);
      return;
    case 'drill':
      if (change.op === 'upsert') await remote.upsertDrill(change.drill, change.sortOrder);
      else await remote.deleteDrill(change.id);
      return;
    case 'collected':
      if (change.op === 'upsert') await remote.upsertCollected(change.chord);
      else await remote.deleteCollected(change.name);
      return;
    case 'lang':
      await remote.setLang(change.lang);
      return;
  }
}

/**
 * 초기 동기화: 서버 pull → (캐시 + 큐 pending) merge → 캐시 기록 → merged 반환.
 * push는 flushQueue가 담당(큐 미전송분).
 */
export async function initialSync(deps: SyncEngineDeps): Promise<PersistedState> {
  const { remote, local, queue } = deps;
  const server = await remote.loadAll();
  const cache = local.loadAll();
  const pending = queue.list().map((i) => i.change);
  const merged = mergePersisted(server, cache, pending);
  local.saveAll(merged);
  return merged;
}

/**
 * 큐 flush: 각 항목을 remote로 push 시도. 성공분만 remove, 실패분은 잔류(재시도 대비).
 * 한 항목 실패가 다른 항목 push를 막지 않는다(독립 push).
 */
export async function flushQueue(deps: SyncEngineDeps): Promise<void> {
  const { remote, queue } = deps;
  const items = queue.list();
  const succeeded: string[] = [];
  for (const item of items) {
    try {
      await pushChange(remote, item.change);
      succeeded.push(item.id);
    } catch {
      /* 실패 항목은 잔류 → 다음 flush/online에서 재시도(멱등 upsert). */
    }
  }
  if (succeeded.length > 0) queue.remove(succeeded);
}
