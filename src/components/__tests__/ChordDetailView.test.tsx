import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChordDetailView } from '../ChordDetailView';
import { ko } from '../../i18n/strings';
import { voicingsByPosition } from '../../domain/voicing';
import { allSlashVoicings } from '../../domain/slash';
import { computeDiagram } from '../../domain/diagram';
import type { ChordDetail } from '../../domain/types';

const noop = () => {};

// 총 폼 수 = 포지션별 폼 수 합계 (평면 리스트 길이와 동일해야 함).
function totalForms(detail: ChordDetail): number {
  return voicingsByPosition(detail.root, detail.qualKey).reduce(
    (a, p) => a + p.forms.length,
    0,
  );
}

// 포지션 헤더 라벨은 그룹 키(pos = 최저 프렛)로 도출(컴포넌트와 동일 규칙).
// computeDiagram.showNut을 쓰면 저포지션이 전부 'OPEN'으로 뭉개지므로 pos를 쓴다.
function headerLabels(detail: ChordDetail): string[] {
  return voicingsByPosition(detail.root, detail.qualKey).map((p) =>
    p.pos <= 0 ? ko.formOpen : p.pos + 'fr',
  );
}

function renderView(
  detail: ChordDetail,
  props: Partial<{
    onBack: () => void;
    onCollect: (c: import('../../domain/types').CollectedChord) => void;
  }> = {},
) {
  return render(
    <ChordDetailView
      detail={detail}
      onBack={props.onBack ?? noop}
      onCollect={props.onCollect ?? noop}
    />,
  );
}

describe('ChordDetailView — screen (not modal)', () => {
  it('renders the ALL VOICINGS label with the form count and one card per form', () => {
    const detail: ChordDetail = { root: 0, qualKey: 'maj', name: 'C' };
    const n = totalForms(detail);
    renderView(detail);

    expect(screen.getByText(ko.allVoicings(n))).toBeInTheDocument();
    // 총 폼 수 == 렌더된 form-card 수 (포지션 그룹으로 나뉘어도 총계 동일)
    expect(screen.getAllByTestId('form-card')).toHaveLength(n);
  });

  it('is NOT a modal: no dialog role / aria-modal scrim in the DOM', () => {
    renderView({ root: 0, qualKey: 'maj', name: 'C' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  });

  it('back button (aria-label 뒤로가기) calls onBack', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderView({ root: 0, qualKey: 'maj', name: 'C' }, { onBack });
    await user.click(screen.getByRole('button', { name: ko.detailBack }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('collect (♥) on a form calls onCollect with a CollectedChord shape', async () => {
    const user = userEvent.setup();
    const onCollect = vi.fn();
    renderView({ root: 0, qualKey: 'maj', name: 'C' }, { onCollect });
    const collectButtons = screen.getAllByRole('button', {
      name: ko.actCollect,
    });
    await user.click(collectButtons[0]);
    expect(onCollect).toHaveBeenCalledTimes(1);
    const arg = onCollect.mock.calls[0][0];
    expect(arg).toHaveProperty('name');
    expect(arg).toHaveProperty('frets');
    expect(arg).toHaveProperty('key');
    expect(arg.frets).toHaveLength(6);
  });
});

describe('ChordDetailView — position grouping (voicing forms UI)', () => {
  it('groups forms under position headers (B4): at least one position-header renders', () => {
    renderView({ root: 0, qualKey: 'maj7', name: 'Cmaj7' });
    const headers = screen.getAllByTestId('position-header');
    expect(headers.length).toBeGreaterThan(0);
    // 포지션 섹션 수 == 포지션 헤더 수
    expect(screen.getAllByTestId('position-section')).toHaveLength(
      headers.length,
    );
  });

  it('position headers use the pos fret (unique per section, not collapsed to OPEN)', () => {
    const detail: ChordDetail = { root: 0, qualKey: 'maj7', name: 'Cmaj7' };
    const expected = headerLabels(detail);
    renderView(detail);
    const rendered = screen
      .getAllByTestId('position-header')
      .map((el) => el.textContent);
    expect(rendered).toEqual(expected);
    // 회귀 가드: 헤더는 포지션마다 유일해야 한다(예전 버그: showNut이 저포지션을
    // 전부 'OPEN'으로 뭉개 3개가 중복됨). pos 기반이면 모두 구분된다.
    expect(new Set(rendered).size).toBe(rendered.length);
    // A쉐입 바레(x-3-5-4-5-3)는 pos=3 → '3fr' 헤더로 나타나야 한다(사용자 지목 폼).
    expect(rendered).toContain('3fr');
  });

  it('Cmaj7: shows the E-shape full-barre position (8fr) header among multiple positions', () => {
    const detail: ChordDetail = { root: 0, qualKey: 'maj7', name: 'Cmaj7' };
    // 기대 라벨을 API 결과에서 도출(하드코딩 금지). E쉐입 풀바레는 8fr 라벨로 나타남.
    const expected = headerLabels(detail);
    expect(expected).toContain('8fr'); // API 계약 전제 실측
    renderView(detail);
    const rendered = screen
      .getAllByTestId('position-header')
      .map((el) => el.textContent);
    expect(rendered).toContain('8fr');
    // 여러 포지션이 관측된다(단일 포지션이 아님)
    expect(new Set(rendered).size).toBeGreaterThan(1);
  });

  it('Cmaj7: the A-shape barre form (x-3-5-4-5-3, pos=3) is present via its shape badge (A1 golden)', () => {
    const detail: ChordDetail = { root: 0, qualKey: 'maj7', name: 'Cmaj7' };
    // API가 A쉐입 template 폼을 낸다는 전제를 실측으로 확인.
    const positions = voicingsByPosition(detail.root, detail.qualKey);
    const aShape = positions
      .flatMap((p) => p.forms)
      .find((f) => f.source === 'template' && f.shape === 'A');
    expect(aShape).toBeDefined();
    expect(aShape?.frets).toEqual(['x', 3, 5, 4, 5, 3]);

    renderView(detail);
    // 화면에 A쉐입 배지가 존재 → 사용자가 그 폼을 볼 수 있다.
    const badges = screen
      .getAllByTestId('shape-badge')
      .map((el) => el.textContent);
    expect(badges).toContain(ko.shapeBadge('A'));
  });
});

describe('ChordDetailView — slash chords (PR-B)', () => {
  // G/B: root G(7), maj, bass B(11). 전위. detail.bass 지정.
  const gOverB: ChordDetail = { root: 7, qualKey: 'maj', name: 'G/B', bass: 11 };

  it('renders slash voicing form cards (count == allSlashVoicings length)', () => {
    const n = allSlashVoicings(gOverB.root, gOverB.qualKey, gOverB.bass!).length;
    expect(n).toBeGreaterThan(0); // API 전제 실측
    renderView(gOverB);
    expect(screen.getAllByTestId('form-card')).toHaveLength(n);
    expect(screen.getByText(ko.allVoicings(n))).toBeInTheDocument();
  });

  it('shows a bass chip labeled with the bass note (B)', () => {
    renderView(gOverB);
    const bassChip = screen.getByTestId('bass-chip');
    expect(bassChip).toHaveTextContent(ko.slashBassChip('B'));
  });

  it('slash forms carry no shape badge (source enum only)', () => {
    renderView(gOverB);
    expect(screen.queryAllByTestId('shape-badge')).toHaveLength(0);
  });

  it('appbar title is the slash name', () => {
    renderView(gOverB);
    expect(screen.getByText('G/B')).toBeInTheDocument();
  });

  it('slash form positions group by computeDiagram start', () => {
    const forms = allSlashVoicings(gOverB.root, gOverB.qualKey, gOverB.bass!);
    const expectedPositions = new Set(
      forms.map((fr) => computeDiagram(fr).start),
    );
    renderView(gOverB);
    expect(screen.getAllByTestId('position-section')).toHaveLength(
      expectedPositions.size,
    );
  });

  it('non-slash regression: no bass chip when detail.bass is undefined', () => {
    renderView({ root: 0, qualKey: 'maj', name: 'C' });
    expect(screen.queryByTestId('bass-chip')).toBeNull();
  });
});

describe('ChordDetailView — per-form omission badge (carried over from modal)', () => {
  it('C major: every form sounds all formula notes -> no badge, no caption', () => {
    renderView({ root: 0, qualKey: 'maj', name: 'C' });
    expect(screen.getAllByTestId('tone-chip').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('omit-badge')).toHaveLength(0);
    expect(screen.queryByText(ko.tonesOmittedCaption)).toBeNull();
  });

  it('C9: at least one form omits the 5th (G) -> "G 생략" badge + caption', () => {
    renderView({ root: 0, qualKey: '9', name: 'C9' });
    expect(screen.getAllByText(ko.omitBadge('G')).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('omit-badge').length).toBeGreaterThan(0);
    expect(screen.getByText(ko.tonesOmittedCaption)).toBeInTheDocument();
  });
});
