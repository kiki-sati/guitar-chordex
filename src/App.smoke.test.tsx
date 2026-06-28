import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { dateStr } from './domain/notes';
import { KEYS } from './state/persist';
import { seedGrass } from './state/seed';

describe('App shell', () => {
  it('renders the brand name in the sidebar', () => {
    render(<App />);
    expect(screen.getByText('Chordex')).toBeInTheDocument();
  });

  it('starts on the Home view', () => {
    render(<App />);
    expect(screen.getByText('🔥 STREAK')).toBeInTheDocument();
  });

  it('navigates between the 4 active views', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /코드 사전/ }));
    expect(screen.getByPlaceholderText(/코드 검색/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /스케일/ }));
    expect(screen.getByText('루트음')).toBeInTheDocument();
    // exact match: the practice NAV button (header has "오늘 연습 기록")
    await user.click(screen.getByRole('button', { name: '연습 기록' }));
    expect(screen.getByText(/연속 연습 중/)).toBeInTheDocument();
  });

  it('disables builder and lesson nav buttons', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /악보 만들기/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /레슨 기록/ })).toBeDisabled();
  });

  it('header log button records practice (grass persists +1 over seed)', async () => {
    const user = userEvent.setup();
    render(<App />);
    const today = dateStr(new Date());
    // first load seeds grass in memory (persist effect skips first run, so
    // localStorage may not yet hold the grass key). Compare against the seed.
    const seeded = seedGrass()[today] || 0;
    await user.click(screen.getByRole('button', { name: '오늘 연습 기록' }));
    const after = JSON.parse(localStorage.getItem(KEYS.grass) || '{}')[today] || 0;
    expect(after).toBe(seeded + 1);
  });

  it('opens and closes the chord detail modal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /코드 사전/ }));
    // open detail via "모든 폼" of the first card
    const allForms = screen.getAllByLabelText('모든 폼');
    await user.click(allForms[0]);
    expect(screen.getByText(/ALL VOICINGS/)).toBeInTheDocument();
    // close via the × button
    await user.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.queryByText(/ALL VOICINGS/)).toBeNull();
  });
});
