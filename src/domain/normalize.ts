/**
 * 코드 텍스트 정규화 (PR-A). `normalizeQuery`(notes.ts)는 무변경 보존하고,
 * 검색·파서가 공유하는 관대한 접기(fold)를 여기서 담당한다.
 *
 * 접는 항목:
 *  - `♭`↔`b`, `♯`↔`#` 유니코드 등가
 *  - `Δ` → `maj7` (유니코드 델타 별칭)
 *  - toLowerCase (검색 관대성 — 케이스 무시)
 *
 * ★ 주의: 이 함수는 **케이스를 없앤다**. maj7(대문자 M) vs minor(소문자 m)를
 * 구분해야 하는 파서 경로는 이 함수를 접미사 전체에 쓰지 않는다(§2.3).
 * 파서는 M/m 판정을 먼저 한 뒤, 그 결과를 정규 접미사로 바꾸고 여기에 태운다.
 */
export function normalizeChordText(s: string): string {
  return s
    .replace(/Δ/g, 'maj7')
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .toLowerCase();
}
