import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProvider } from '../../test-utils';
import { ScalesView } from '../ScalesView';

describe('ScalesView', () => {
  it('renders the fretboard with scale-note circles and a root highlight', () => {
    const { container } = renderWithProvider(<ScalesView />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="scale-note"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-testid="scale-root"]').length).toBeGreaterThan(0);
  });

  it('shows the R degree chip', () => {
    renderWithProvider(<ScalesView />);
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('changes scale on tab click (blues)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<ScalesView />);
    await user.click(screen.getByRole('tab', { name: '블루스' }));
    expect(screen.getByText(/블루스 스케일/)).toBeInTheDocument();
  });

  it('shows legend labels', () => {
    renderWithProvider(<ScalesView />);
    expect(screen.getByText('루트음')).toBeInTheDocument();
    expect(screen.getByText('스케일 구성음')).toBeInTheDocument();
  });
});
