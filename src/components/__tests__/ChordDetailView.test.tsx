import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChordDetailView } from '../ChordDetailView';
import { ko } from '../../i18n/strings';
import { allVoicings } from '../../domain/voicing';
import type { ChordDetail } from '../../domain/types';

const noop = () => {};

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
  it('renders the ALL VOICINGS label with the form count and one card per voicing', () => {
    const detail: ChordDetail = { root: 0, qualKey: 'maj', name: 'C' };
    const n = allVoicings(detail.root, detail.qualKey).length;
    renderView(detail);

    expect(screen.getByText(ko.allVoicings(n))).toBeInTheDocument();
    // each form card carries the tones-variant diagram; count via form labels
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
