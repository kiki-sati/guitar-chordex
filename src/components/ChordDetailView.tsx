import { ChordDiagram } from './ChordDiagram';
import { voicingsByPosition } from '../domain/voicing';
import { allSlashVoicings } from '../domain/slash';
import { computeDiagram } from '../domain/diagram';
import { omittedInVoicing } from '../domain/voicing-pcs';
import { noteName } from '../domain/notes';
import { INTERVALS } from '../domain/constants';
import { ko } from '../i18n/strings';
import styles from './ChordDetailView.module.css';
import type {
  ChordDetail,
  CollectedChord,
  FretArray,
  VoicingForm,
  VoicingPosition,
} from '../domain/types';

/**
 * 슬래시 보이싱(FretArray[])을 포지션(computeDiagram(fr).start 기준)으로 그룹핑해
 * 기존 VoicingPosition[] shape로 변환한다(순수·로컬). 각 폼 source='enum'(쉐입 배지 없음).
 * 반환 순서: pos(start) 오름차순 → 입력 순서 유지(allSlashVoicings가 이미 결정론적).
 */
function groupSlashPositions(forms: FretArray[]): VoicingPosition[] {
  const groups = new Map<number, VoicingForm[]>();
  const order: number[] = [];
  for (const fr of forms) {
    const pos = computeDiagram(fr).start;
    let g = groups.get(pos);
    if (!g) {
      g = [];
      groups.set(pos, g);
      order.push(pos);
    }
    g.push({ frets: fr, source: 'enum' });
  }
  return order
    .sort((a, b) => a - b)
    .map((pos) => ({ pos, forms: groups.get(pos)! }));
}

interface ChordDetailViewProps {
  detail: ChordDetail;
  onBack: () => void;
  onCollect: (c: CollectedChord) => void;
}

/**
 * 모든 폼 상세 화면 (구 ChordDetailModal 본문 이관 — 팝업 → 전용 화면).
 * 도메인 계산(voicingsByPosition/computeDiagram/INTERVALS)만 호출, 음악 로직 직접 구현 없음.
 * 폼을 포지션(같은 최저 프렛)으로 그룹핑해 헤더 섹션으로 렌더한다 — 사용자가
 * 각 프렛 자리에서 잡을 수 있는 여러 폼을 한눈에 볼 수 있게(코드 사전 성격).
 */
export function ChordDetailView({
  detail,
  onBack,
  onCollect,
}: ChordDetailViewProps) {
  const isSlash = detail.bass != null;
  // 슬래시면 베이스 제약 보이싱(FretArray[])을 포지션 그룹으로 변환, 아니면 기존 경로.
  const positions = isSlash
    ? groupSlashPositions(
        allSlashVoicings(detail.root, detail.qualKey, detail.bass as number),
      )
    : voicingsByPosition(detail.root, detail.qualKey);
  // 평면 파생: 앱바 담기(대표 폼) · 생략 판정에 사용.
  const allForms = positions.flatMap((p) => p.forms);
  const total = allForms.length;

  // 톤 칩은 코드 공식 그대로(정확). 생략 여부는 폼별로 카드에 표시한다.
  const tones = INTERVALS[detail.qualKey].map((i) =>
    noteName((detail.root + i) % 12),
  );
  // 슬래시 베이스 음이름(칩 1개 추가용). 일반 코드는 null.
  const bassNote = isSlash ? noteName(detail.bass as number) : null;

  // 폼별 생략 공식 음(음이름 라벨). 사용자 혼란은 개별 폼 단위에서 생기므로
  // (예: 오픈 C9 x30330에서 5도 G가 빠짐) 각 폼마다 도메인 헬퍼로 판정한다.
  const omittedLabels = (fr: FretArray): string[] => {
    const pcs = omittedInVoicing(detail.root, detail.qualKey, fr);
    // 공식 인터벌 순서대로 라벨링(안정적 순서), 중복 제거.
    const seen = new Set<number>();
    const labels: string[] = [];
    INTERVALS[detail.qualKey].forEach((i) => {
      const pc = (detail.root + i) % 12;
      if (pcs.has(pc) && !seen.has(pc)) {
        seen.add(pc);
        labels.push(noteName(pc));
      }
    });
    return labels;
  };
  const hasOmission = allForms.some((f) => omittedLabels(f.frets).length > 0);

  return (
    <div className={styles.screen}>
      <div className={styles.appbar}>
        <button
          type="button"
          className={styles.appbarBtn}
          aria-label={ko.detailBack}
          onClick={onBack}
        >
          ←
        </button>
        <span className={styles.appbarTitle}>{detail.name}</span>
        <button
          type="button"
          className={styles.appbarBtn}
          title={ko.actCollect}
          aria-label={ko.actCollect}
          onClick={() =>
            onCollect({
              name: detail.name,
              frets:
                allForms[0]?.frets ??
                (['x', 'x', 'x', 'x', 'x', 'x'] as FretArray),
              key: detail.name,
            })
          }
        >
          ♥
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.eyebrow}>{ko.allVoicings(total)}</div>

        <div className={styles.tones}>
          {tones.map((t, i) => (
            <span key={i} data-testid="tone-chip" className={styles.tone}>
              {t}
            </span>
          ))}
          {bassNote ? (
            <span
              data-testid="bass-chip"
              className={`${styles.tone} ${styles.bassTone}`}
            >
              {ko.slashBassChip(bassNote)}
            </span>
          ) : null}
        </div>
        {hasOmission ? (
          <div className={styles.tonesCaption}>{ko.tonesOmittedCaption}</div>
        ) : null}

        {positions.length ? (
          positions.map((p) => {
            // 포지션 헤더 라벨: 그룹 키(pos = 최저 프렛)를 그대로 쓴다.
            // computeDiagram.showNut은 "최고프렛<=5면 항상 true"라(다이어그램 렌더용)
            // 서로 다른 저포지션(1·2·3fr)을 전부 'OPEN'으로 뭉갠다 → 헤더용 부적합.
            // pos는 그룹 유일값이므로 헤더가 항상 구분된다(예: x35453 A폼 바레 = 3fr).
            const posLabel = p.pos <= 0 ? ko.formOpen : p.pos + 'fr';
            return (
              <section
                key={p.pos}
                className={styles.positionSection}
                data-testid="position-section"
              >
                <div
                  className={styles.positionHeader}
                  data-testid="position-header"
                >
                  {posLabel}
                </div>
                <div className={styles.grid}>
                  {p.forms.map((form: VoicingForm, i) => {
                    const g = computeDiagram(form.frets);
                    const omitted = omittedLabels(form.frets);
                    // 표준 폼 쉐입 배지 — 'open'은 제외(무버블 바레만 표시).
                    const showShapeBadge =
                      form.source === 'template' &&
                      form.shape !== undefined &&
                      form.shape !== 'open';
                    const fc: CollectedChord = {
                      name:
                        detail.name +
                        ' (' +
                        (g.showNut ? 'open' : g.start + 'fr') +
                        ')',
                      frets: form.frets,
                      key: detail.name + '-' + p.pos + '-' + i,
                    };
                    return (
                      <div
                        key={p.pos + '-' + i}
                        className={styles.formCard}
                        data-testid="form-card"
                      >
                        <div className={styles.formLabelRow}>
                          <span className={styles.formLabel}>
                            {String(i + 1)}
                          </span>
                          {showShapeBadge ? (
                            <span
                              className={styles.shapeBadge}
                              data-testid="shape-badge"
                            >
                              {ko.shapeBadge(form.shape as string)}
                            </span>
                          ) : null}
                        </div>
                        <ChordDiagram
                          frets={form.frets}
                          width={112}
                          variant="tones"
                        />
                        {omitted.length ? (
                          <div
                            className={styles.omitBadge}
                            data-testid="omit-badge"
                          >
                            {ko.omitBadge(omitted.join(', '))}
                          </div>
                        ) : null}
                        <div className={styles.formActions}>
                          <button
                            type="button"
                            className={styles.circBtn}
                            title={ko.comingSoon}
                            aria-label={ko.actPlay}
                            disabled
                          >
                            ▶
                          </button>
                          <button
                            type="button"
                            className={styles.circBtn}
                            title={ko.actCollect}
                            aria-label={ko.actCollect}
                            onClick={() => onCollect(fc)}
                          >
                            ♥
                          </button>
                          <button
                            type="button"
                            className={styles.circBtn}
                            title={ko.comingSoon}
                            aria-label={ko.actCopy}
                            disabled
                          >
                            ⧉
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        ) : (
          <div className={styles.empty}>{ko.modalEmpty}</div>
        )}
      </div>
    </div>
  );
}
