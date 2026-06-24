import { dateStr } from './notes';
import type {
  GrassDay,
  GrassLevel,
  GrassMap,
  GrassWeek,
  Stats,
} from './types';

/** 통계: total/days/streak/week. (원본 라인 525-529) */
export function stats(grass: GrassMap, today: Date = new Date()): Stats {
  const g = grass;
  let total = 0;
  let days = 0;
  Object.keys(g).forEach((k) => {
    if (g[k] > 0) {
      total += g[k];
      days++;
    }
  });
  let streak = 0;
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  for (let i = 0; i < 400; i++) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    if (g[dateStr(d)] > 0) streak++;
    else if (i > 0) break;
    else continue; // 오늘(i===0) 미기록이어도 어제부터 streak 인정
  }
  let week = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    week += g[dateStr(d)] || 0;
  }
  return { total, days, streak, week };
}

/** 잔디 레벨. (원본 라인 530) */
export function level(c: number): GrassLevel {
  return c <= 0 ? 0 : c < 2 ? 1 : c < 4 ? 2 : c < 6 ? 3 : 4;
}

/** GitHub식 1년 잔디 (53주×7일). (원본 라인 531-532) */
export function buildGrass(
  grass: GrassMap,
  today: Date = new Date(),
): GrassWeek[] {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const weeks: GrassWeek[] = [];
  const start = new Date(t);
  start.setDate(t.getDate() - (52 * 7 + t.getDay()));
  const cur = new Date(start);
  while (cur <= t) {
    const w: GrassWeek = [];
    for (let d = 0; d < 7; d++) {
      if (cur > t) {
        w.push(null);
      } else {
        const ds = dateStr(cur);
        const c = grass[ds] || 0;
        const day: GrassDay = {
          ds,
          count: c,
          level: level(c),
          date: new Date(cur),
        };
        w.push(day);
      }
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(w);
  }
  return weeks;
}
