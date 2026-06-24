import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProvider } from '../../test-utils';
import { HomeView } from '../HomeView';

describe('HomeView', () => {
  it('focus layout: shows streak eyebrow and suggested chords', () => {
    renderWithProvider(<HomeView />);
    expect(screen.getByText('🔥 STREAK')).toBeInTheDocument();
    expect(screen.getByText('오늘의 추천 코드')).toBeInTheDocument();
    // suggested includes C, G, Am, F, Dm, Em
    expect(screen.getByText('Am')).toBeInTheDocument();
    expect(screen.getByText('Dm')).toBeInTheDocument();
  });

  it('renders 6 suggested chord diagrams', () => {
    const { container } = renderWithProvider(<HomeView />);
    // each suggested card has an svg
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(6);
  });

  it('switches to board layout showing collected card', async () => {
    const user = userEvent.setup();
    renderWithProvider(<HomeView />);
    await user.click(screen.getByRole('tab', { name: '대시보드' }));
    expect(screen.getByText(/담은 코드/)).toBeInTheDocument();
  });

  it('switches to minimal layout', async () => {
    const user = userEvent.setup();
    renderWithProvider(<HomeView />);
    await user.click(screen.getByRole('tab', { name: '미니멀' }));
    expect(screen.getByText('연속 연습')).toBeInTheDocument();
  });
});
