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

describe('ChordDetailModal — per-form omission badge', () => {
  it('C major: every form sounds all formula notes -> no badge, no caption', () => {
    renderModal({ root: 0, qualKey: 'maj', name: 'C' });

    // tone chips render the formula as-is
    expect(screen.getAllByTestId('tone-chip').length).toBeGreaterThan(0);
    // no form omits a formula note
    expect(screen.queryAllByTestId('omit-badge')).toHaveLength(0);
    expect(screen.queryByText(ko.tonesOmittedCaption)).toBeNull();
  });

  it('C9: at least one form omits the 5th (G) -> "G 생략" badge + caption', () => {
    // allVoicings(0,'9') includes the open form x30330 which drops G.
    renderModal({ root: 0, qualKey: '9', name: 'C9' });

    // order-independent: the badge text "G 생략" is present (one or more cards)
    expect(screen.getAllByText(ko.omitBadge('G')).length).toBeGreaterThan(0);

    // at least one omit badge rendered
    expect(screen.getAllByTestId('omit-badge').length).toBeGreaterThan(0);

    // caption shown once
    expect(screen.getByText(ko.tonesOmittedCaption)).toBeInTheDocument();
  });
});
