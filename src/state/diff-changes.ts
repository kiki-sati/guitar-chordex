import type { PersistedState } from './persist';
import type { RepoChange } from './repo-change';
import type {
  CollectedChord,
  Drill,
  JournalEntry,
} from '../domain/types';

/**
 * 이전/이후 persisted 슬라이스를 비교해 RepoChange[] 산출 (계획 17 §5).
 *
 * reducer를 단일 진실로 신뢰하고 슬라이스만 비교한다(action→change 매퍼 대신 diff).
 * 순수·React 무의존 — 테스트 1급 모듈.
 *
 * 규칙:
 *   - grass:     count가 바뀐 day만 { kind:'grass', day, count }.
 *   - journal:   id 기준 신규/수정 upsert, 사라진 id delete.
 *   - drills:    id 기준 신규/수정 upsert(sortOrder=next 배열 인덱스), 사라진 id delete.
 *   - collected: **name 자연키** 기준 신규/수정 upsert, 사라진 name delete
 *                (reducer는 index로 제거하지만 diff는 name 차집합으로 산출 — §5 index 함정).
 *   - lang:      값 변경 시 { kind:'lang', lang }.
 *
 * 산출 순서: grass → journal → drills → collected → lang (드릴 달성 동반 grass가
 * grass 먼저 오도록 — 테스트 안정성).
 */
export function diffChanges(
  prev: PersistedState,
  next: PersistedState,
): RepoChange[] {
  const changes: RepoChange[] = [];

  // ── grass: per-day count 변경 ──
  const days = new Set([
    ...Object.keys(prev.grass),
    ...Object.keys(next.grass),
  ]);
  for (const day of days) {
    const before = prev.grass[day];
    const after = next.grass[day];
    if (after !== undefined && after !== before) {
      changes.push({ kind: 'grass', day, count: after });
    }
    // after === undefined (day 제거)는 grass에서 미지원(잔디는 삭제 없음 — 누적).
  }

  // ── journal: id 기준 upsert/delete ──
  {
    const prevById = new Map(prev.journal.map((e) => [e.id, e]));
    const nextById = new Map(next.journal.map((e) => [e.id, e]));
    for (const entry of next.journal) {
      const before = prevById.get(entry.id);
      if (!before || !journalEqual(before, entry)) {
        changes.push({ kind: 'journal', op: 'upsert', entry });
      }
    }
    for (const entry of prev.journal) {
      if (!nextById.has(entry.id)) {
        changes.push({ kind: 'journal', op: 'delete', id: entry.id });
      }
    }
  }

  // ── drills: id 기준 upsert(sortOrder=index)/delete ──
  {
    const prevById = new Map(prev.drills.map((d) => [d.id, d]));
    const nextById = new Map(next.drills.map((d) => [d.id, d]));
    next.drills.forEach((drill, index) => {
      const before = prevById.get(drill.id);
      if (!before || !drillEqual(before, drill)) {
        changes.push({ kind: 'drill', op: 'upsert', drill, sortOrder: index });
      }
    });
    for (const drill of prev.drills) {
      if (!nextById.has(drill.id)) {
        changes.push({ kind: 'drill', op: 'delete', id: drill.id });
      }
    }
  }

  // ── collected: name 자연키 기준 upsert/delete (index 함정 회피) ──
  {
    const prevByName = new Map(prev.collected.map((c) => [c.name, c]));
    const nextByName = new Map(next.collected.map((c) => [c.name, c]));
    for (const chord of next.collected) {
      const before = prevByName.get(chord.name);
      if (!before || !collectedEqual(before, chord)) {
        changes.push({ kind: 'collected', op: 'upsert', chord });
      }
    }
    for (const chord of prev.collected) {
      if (!nextByName.has(chord.name)) {
        changes.push({ kind: 'collected', op: 'delete', name: chord.name });
      }
    }
  }

  // ── lang ──
  if (prev.lang !== next.lang) {
    changes.push({ kind: 'lang', lang: next.lang });
  }

  return changes;
}

function journalEqual(a: JournalEntry, b: JournalEntry): boolean {
  return (
    a.date === b.date &&
    a.title === b.title &&
    a.minutes === b.minutes &&
    a.notes === b.notes &&
    arrayEqual(a.chords, b.chords)
  );
}

function drillEqual(a: Drill, b: Drill): boolean {
  return (
    a.title === b.title &&
    a.target === b.target &&
    a.count === b.count &&
    a.sheetId === b.sheetId &&
    a.timeSig === b.timeSig &&
    JSON.stringify(a.seq ?? null) === JSON.stringify(b.seq ?? null)
  );
}

function collectedEqual(a: CollectedChord, b: CollectedChord): boolean {
  return a.key === b.key && arrayEqual(a.frets, b.frets);
}

function arrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
