import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeasureGrid } from '../MeasureGrid';
import { UsedChordBox } from '../UsedChordBox';
import { ChordPalette } from '../ChordPalette';
import { SavedSheets } from '../SavedSheets';
import type {
  CollectedChord,
  Sheet,
  SheetSequence,
  SheetSlot,
} from '../../../domain/types';

const C: SheetSlot = { name: 'C', frets: ['x', 3, 2, 0, 1, 0] };
const G: SheetSlot = { name: 'G', frets: [3, 2, 0, 0, 0, 3] };

describe('MeasureGrid (B3 경계: sequenceToMeasures → 격자)', () => {
  it('renders beats-per-measure cells and calls onBeatClick with the absolute index', async () => {
    const user = userEvent.setup();
    const onBeatClick = vi.fn();
    const seq: SheetSequence = [C, null, null, null, null, null, null, null];
    render(
      <MeasureGrid
        sequence={seq}
        beats={4}
        armed={false}
        onBeatClick={onBeatClick}
        onRemoveMeasure={vi.fn()}
      />,
    );
    // 8 empty-or-filled cells total. Filled 'C' shown once.
    expect(screen.getByText('C')).toBeInTheDocument();
    // click the 5th cell (measure 2, col 0) → absolute index 4
    const cells = screen.getAllByRole('button');
    // cells include remove buttons; filter to beat cells by title
    const beatCells = screen.getAllByTitle(/클릭해서/);
    await user.click(beatCells[4]);
    expect(onBeatClick).toHaveBeenCalledWith(4);
    expect(cells.length).toBeGreaterThan(0);
  });

  it('shows measure-remove buttons only when more than one measure', () => {
    const { rerender } = render(
      <MeasureGrid
        sequence={[null, null, null, null]}
        beats={4}
        armed={false}
        onBeatClick={vi.fn()}
        onRemoveMeasure={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: '마디 삭제' })).toBeNull();
    rerender(
      <MeasureGrid
        sequence={[null, null, null, null, null, null, null, null]}
        beats={4}
        armed={false}
        onBeatClick={vi.fn()}
        onRemoveMeasure={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button', { name: '마디 삭제' })).toHaveLength(2);
  });
});

describe('UsedChordBox (B4 경계: usedChords → ChordDiagram)', () => {
  it('renders one diagram per unique chord and nothing when empty', () => {
    const { container, rerender } = render(
      <UsedChordBox sequence={[C, G, C, null]} />,
    );
    // 2 unique chords → 2 svgs
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();

    rerender(<UsedChordBox sequence={[null, null]} />);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });
});

describe('ChordPalette (B1 경계: onClick → ARM)', () => {
  const collected: CollectedChord[] = [
    { name: 'C', frets: ['x', 3, 2, 0, 1, 0], key: 'C' },
    { name: 'G', frets: [3, 2, 0, 0, 0, 3], key: 'G' },
  ];

  it('arms on card click passing {name,frets}', async () => {
    const user = userEvent.setup();
    const onArm = vi.fn();
    render(
      <ChordPalette
        collected={collected}
        armed={null}
        onArm={onArm}
        onRemove={vi.fn()}
        onGoToDictionary={vi.fn()}
      />,
    );
    await user.click(screen.getAllByText('고르기')[0].closest('[role="button"]') as HTMLElement);
    expect(onArm).toHaveBeenCalledWith({ name: 'C', frets: ['x', 3, 2, 0, 1, 0] });
  });

  it('marks the armed card with ✓ 선택됨', () => {
    render(
      <ChordPalette
        collected={collected}
        armed={{ name: 'G', frets: [3, 2, 0, 0, 0, 3] }}
        onArm={vi.fn()}
        onRemove={vi.fn()}
        onGoToDictionary={vi.fn()}
      />,
    );
    expect(screen.getByText('✓ 선택됨')).toBeInTheDocument();
    expect(screen.getByText('고르기')).toBeInTheDocument(); // the other card
  });

  it('remove button stops propagation and calls onRemove(index) not onArm', async () => {
    const user = userEvent.setup();
    const onArm = vi.fn();
    const onRemove = vi.fn();
    render(
      <ChordPalette
        collected={collected}
        armed={null}
        onArm={onArm}
        onRemove={onRemove}
        onGoToDictionary={vi.fn()}
      />,
    );
    await user.click(screen.getAllByRole('button', { name: '삭제' })[0]);
    expect(onRemove).toHaveBeenCalledWith(0);
    expect(onArm).not.toHaveBeenCalled();
  });

  it('empty collected shows dictionary link', async () => {
    const user = userEvent.setup();
    const onGoToDictionary = vi.fn();
    render(
      <ChordPalette
        collected={[]}
        armed={null}
        onArm={vi.fn()}
        onRemove={vi.fn()}
        onGoToDictionary={onGoToDictionary}
      />,
    );
    await user.click(screen.getByRole('button', { name: '코드 사전' }));
    expect(onGoToDictionary).toHaveBeenCalledTimes(1);
  });
});

describe('SavedSheets (B5 경계: 목록 → load/delete)', () => {
  const sheets: Sheet[] = [
    { id: 'sh1', title: '캐논', seq: [C, null, G, null], timeSig: '4/4', date: '2026-07-08' },
  ];

  it('renders title + meta (timeSig · N코드 · date) and fires load/delete with id', async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn();
    const onDelete = vi.fn();
    render(<SavedSheets sheets={sheets} onLoad={onLoad} onDelete={onDelete} />);
    expect(screen.getByText('캐논')).toBeInTheDocument();
    expect(screen.getByText('4/4 · 2코드 · 2026-07-08')).toBeInTheDocument();
    // 단일 악보 → 버튼도 각 1개이므로 screen 수준에서 직접 조회
    await user.click(screen.getByRole('button', { name: '불러오기' }));
    expect(onLoad).toHaveBeenCalledWith('sh1');
    await user.click(screen.getByRole('button', { name: '삭제' }));
    expect(onDelete).toHaveBeenCalledWith('sh1');
  });

  it('renders nothing when there are no sheets', () => {
    const { container } = render(
      <SavedSheets sheets={[]} onLoad={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
