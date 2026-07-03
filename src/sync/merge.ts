import type { PersistedState } from '../state/persist';
import type { RepoChange } from '../state/repo-change';
import type { GrassMap } from '../domain/types';

/**
 * 충돌 머지 (계획 17 §8.4, 정본 05 §6.4). 순수 — 테스트 1급 모듈.
 *
 * 사용자 확정 결정(Q1 = 로컬 우선):
 *   - grass:     per-day `max(local, server)` + 합집합 day. 누적 손실 방지. **LWW 금지.**
 *   - journal:   id 합집합. 동일 id 충돌 시 **로컬 우선**(오프라인 낙관값 최신 전제).
 *   - drills:    id 합집합. 메타 로컬 우선, `count = max(local, server)`(누적/RESET 방어).
 *   - collected: name 합집합. 동일 name 로컬 우선(frets/key).
 *   - lang:      **로컬 우선**.
 *
 * `pending`(선택): 로컬 미전송 delete를 반영한다. mergePersisted는 server+local의
 * 최종 상태만으로는 "로컬이 삭제한 것"과 "다른 기기가 추가한 것"을 구분할 수 없으므로,
 * 큐의 pending delete를 근거로 삭제를 확정한다(§8.3 merge(server,cache,queuePending)).
 * pending 미지정이면 삭제 미적용(합집합만).
 *
 * 도메인 타입(JournalEntry/Drill/CollectedChord)에 updated_at을 실지 않는다
 * (CollectedChord 불변 — §8.4-a). 정밀 updated_at LWW는 후속 PR로 이연.
 */
export function mergePersisted(
  server: PersistedState,
  local: PersistedState,
  pending: RepoChange[] = [],
): PersistedState {
  const deletedJournal = new Set<string>();
  const deletedDrills = new Set<string>();
  const deletedCollected = new Set<string>();
  for (const c of pending) {
    if (c.kind === 'journal' && c.op === 'delete') deletedJournal.add(c.id);
    if (c.kind === 'drill' && c.op === 'delete') deletedDrills.add(c.id);
    if (c.kind === 'collected' && c.op === 'delete') deletedCollected.add(c.name);
  }

  // ── grass: per-day max + 합집합 ──
  const grass: GrassMap = {};
  const grassDays = new Set([
    ...Object.keys(server.grass),
    ...Object.keys(local.grass),
  ]);
  for (const day of grassDays) {
    const s = server.grass[day] ?? 0;
    const l = local.grass[day] ?? 0;
    const v = Math.max(s, l);
    if (v > 0) grass[day] = v;
  }

  // ── journal: id 합집합, 로컬 우선, pending delete 제외 ──
  const journal = (() => {
    const localById = new Map(local.journal.map((e) => [e.id, e]));
    const result = [...local.journal];
    for (const e of server.journal) {
      if (!localById.has(e.id) && !deletedJournal.has(e.id)) result.push(e);
    }
    return result.filter((e) => !deletedJournal.has(e.id));
  })();

  // ── drills: id 합집합, 메타 로컬 우선 + count max, pending delete 제외 ──
  const drills = (() => {
    const serverById = new Map(server.drills.map((d) => [d.id, d]));
    const localById = new Map(local.drills.map((d) => [d.id, d]));
    const result = local.drills.map((d) => {
      const s = serverById.get(d.id);
      return s ? { ...d, count: Math.max(d.count, s.count) } : d;
    });
    for (const d of server.drills) {
      if (!localById.has(d.id) && !deletedDrills.has(d.id)) result.push(d);
    }
    return result.filter((d) => !deletedDrills.has(d.id));
  })();

  // ── collected: name 합집합, 로컬 우선, pending delete 제외 ──
  const collected = (() => {
    const localByName = new Map(local.collected.map((c) => [c.name, c]));
    const result = [...local.collected];
    for (const c of server.collected) {
      if (!localByName.has(c.name) && !deletedCollected.has(c.name)) result.push(c);
    }
    return result.filter((c) => !deletedCollected.has(c.name));
  })();

  // ── lang: 로컬 우선 ──
  return { grass, journal, drills, collected, lang: local.lang };
}
