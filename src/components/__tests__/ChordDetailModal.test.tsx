import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChordDetailModal } from '../ChordDetailModal';
import { ko } from '../../i18n/strings';
import type { ChordDetail } from '../../domain/types';

const noop = () => {};

function renderModal(detail: ChordDetail) {
  return render(
    <ChordDetailModal detail={detail} onClose={noop} onCollect={noop} />,
  );
}

describe('ChordDetailModal — tone chip omission', () => {
  it('C major: no formula note omitted -> all chips normal, no caption', () => {
    // C = {C,E,G}; open/barre voicings sound all three.
    renderModal({ root: 0, qualKey: 'maj', name: 'C' });

    const chips = screen.getAllByTestId('tone-chip');
    expect(chips.length).toBeGreaterThan(0);
    // every chip is NOT flagged as omitted
    for (const chip of chips) {
      expect(chip).toHaveAttribute('data-omitted', 'false');
    }
    // caption absent
    expect(screen.queryByText(ko.tonesOmittedCaption)).toBeNull();
  });

  it('C9: 5th (G) omitted in all forms -> G chip flagged + caption shown', () => {
    // C9 = {C,E,G,Bb,D}; requiredPCs drops the 5th, so no voicing sounds G.
    renderModal({ root: 0, qualKey: '9', name: 'C9' });

    const chips = screen.getAllByTestId('tone-chip');
    const gChip = chips.find(
      (c) => c.getAttribute('data-tone-name') === 'G',
    );
    const cChip = chips.find(
      (c) => c.getAttribute('data-tone-name') === 'C',
    );
    expect(gChip).toBeDefined();
    expect(cChip).toBeDefined();

    // the G chip is flagged omitted with the tooltip
    expect(gChip).toHaveAttribute('data-omitted', 'true');
    expect(gChip).toHaveAttribute('title', ko.toneOmittedTitle);

    // root C is always sounded -> not omitted
    expect(cChip).toHaveAttribute('data-omitted', 'false');

    // caption present exactly once
    expect(screen.getByText(ko.tonesOmittedCaption)).toBeInTheDocument();
  });
});
