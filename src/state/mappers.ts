import type {
  CollectedChord,
  Drill,
  DrillSeqItem,
  GrassMap,
  JournalEntry,
} from '../domain/types';
import type { Lang } from './repository';

/**
 * 순수 매퍼 — 서버 행(snake_case) ↔ 도메인 객체(camelCase) 변환.
 *
 * 설계: _workspace/11_pr_db_schema_rls_plan.md §4
 * 정본: _workspace/05_backend_auth_plan.md §2.3·§2.4
 *
 * 불변(변경 시 사용자 확인):
 *   - React/supabase-js 무의존(테스트 1급 모듈).
 *   - 서버 행 타입은 이 모듈 로컬에 선언(도메인 타입 누출 방지, D4).
 *   - *ToRow는 클라가 user_id·updated_at(ISO)을 명시 주입(트리거 미사용, D5/AC-10).
 *   - row→도메인 복원 시 서버 전용 필드(id/user_id/deleted_at/updated_at/*_at)는
 *     도메인으로 누출하지 않는다(경계면 안정).
 */

// ── 서버 행 타입 (이 모듈 로컬 — 도메인에 누출 금지) ──
export interface GrassRow {
  user_id: string;
  day: string;
  count: number;
  updated_at: string;
}

export interface JournalRow {
  id: string;
  user_id: string;
  entry_date: string;
  title: string;
  minutes: number;
  chords: string[];
  notes: string;
  deleted_at: string | null;
  updated_at: string;
}

export interface DrillRow {
  id: string;
  user_id: string;
  title: string;
  target: number;
  count: number;
  seq: DrillSeqItem[] | null;
  sheet_id: string | null;
  time_sig: string | null;
  sort_order: number;
  deleted_at: string | null;
  updated_at: string;
}

export interface CollectedRow {
  id: string;
  user_id: string;
  name: string;
  frets: CollectedChord['frets'];
  chord_key: string;
  deleted_at: string | null;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  lang: Lang;
  migrated_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── grass: 객체 ↔ 행 (정본 §2.4) ─────────────────────────────────────
/** GrassMap 객체 → 행 배열. user_id·updatedAt은 호출자가 일괄 부여. */
export function grassMapToRows(
  map: GrassMap,
  userId: string,
  updatedAt: string,
): GrassRow[] {
  return Object.entries(map).map(([day, count]) => ({
    user_id: userId,
    day,
    count,
    updated_at: updatedAt,
  }));
}

/** 행 배열 → GrassMap 객체. count>0 행만(현 seed 규칙과 일관 — 정본 §2.4). */
export function grassRowsToMap(rows: GrassRow[]): GrassMap {
  const map: GrassMap = {};
  for (const r of rows) if (r.count > 0) map[r.day] = r.count;
  return map;
}

// ── journal (date↔entry_date) ────────────────────────────────────────
/** 도메인 JournalEntry → upsert 페이로드(deleted_at 제외). */
export function journalToRow(
  e: JournalEntry,
  userId: string,
  updatedAt: string,
): Omit<JournalRow, 'deleted_at'> {
  return {
    id: e.id,
    user_id: userId,
    entry_date: e.date,
    title: e.title,
    minutes: e.minutes,
    chords: [...e.chords],
    notes: e.notes,
    updated_at: updatedAt,
  };
}

/** 서버 행 → 도메인 JournalEntry. entry_date→date, 서버 전용 필드 비누출. */
export function rowToJournal(r: JournalRow): JournalEntry {
  return {
    id: r.id,
    date: r.entry_date,
    title: r.title,
    minutes: r.minutes,
    chords: [...r.chords],
    notes: r.notes,
  };
}

// ── drill (sheetId↔sheet_id, timeSig↔time_sig) ───────────────────────
/** 도메인 Drill → upsert 페이로드(deleted_at 제외). sortOrder 명시 주입. */
export function drillToRow(
  d: Drill,
  userId: string,
  updatedAt: string,
  sortOrder: number,
): Omit<DrillRow, 'deleted_at'> {
  return {
    id: d.id,
    user_id: userId,
    title: d.title,
    target: d.target,
    count: d.count,
    // 옵셔널(부재) → null 로 명시 직렬화(서버 컬럼 nullable).
    seq: d.seq !== undefined ? d.seq.map((s) => ({ ...s, frets: [...s.frets] })) : null,
    sheet_id: d.sheetId ?? null,
    time_sig: d.timeSig ?? null,
    sort_order: sortOrder,
    updated_at: updatedAt,
  };
}

/**
 * 서버 행 → 도메인 Drill.
 * null → 부재(undefined): 옵셔널 필드는 null이 아니라 미설정으로 복원(타입 Drill.seq?/sheetId?/timeSig?).
 */
export function rowToDrill(r: DrillRow): Drill {
  const d: Drill = {
    id: r.id,
    title: r.title,
    target: r.target,
    count: r.count,
  };
  if (r.seq !== null) d.seq = r.seq.map((s) => ({ ...s, frets: [...s.frets] }));
  if (r.sheet_id !== null) d.sheetId = r.sheet_id;
  if (r.time_sig !== null) d.timeSig = r.time_sig;
  return d;
}

// ── collected (id 없음 — name 자연키, D4) ────────────────────────────
/**
 * 도메인 CollectedChord → upsert 페이로드(id·deleted_at 제외).
 * id를 만들지 않는다 — 서버 (user_id,name) upsert가 PK를 자체 관리.
 */
export function collectedToRow(
  c: CollectedChord,
  userId: string,
  updatedAt: string,
): Omit<CollectedRow, 'id' | 'deleted_at'> {
  return {
    user_id: userId,
    name: c.name,
    frets: [...c.frets],
    chord_key: c.key,
    updated_at: updatedAt,
  };
}

/** 서버 행 → 도메인 CollectedChord. chord_key→key, id/user_id/deleted_at 비누출. */
export function rowToCollected(r: CollectedRow): CollectedChord {
  return {
    name: r.name,
    frets: [...r.frets],
    key: r.chord_key,
  };
}
