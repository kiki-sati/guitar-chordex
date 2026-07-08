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

  it('navigates between the 5 active views', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /코드 사전/ }));
    expect(screen.getByPlaceholderText(/코드 검색/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /스케일/ }));
    expect(screen.getByText('루트음')).toBeInTheDocument();
    // 악보 만들기(builder) 활성 (PR-1) — 사이드바에서 이동 시 빌더 뷰 렌더
    await user.click(screen.getByRole('button', { name: '악보 만들기' }));
    expect(screen.getByText('담은 코드 · 클릭해서 선택')).toBeInTheDocument();
    // exact match: the practice NAV button (header has "오늘 연습 기록")
    await user.click(screen.getByRole('button', { name: '연습 기록' }));
    expect(screen.getByText(/연속 연습 중/)).toBeInTheDocument();
  });

  it('enables the builder nav button but keeps lesson disabled', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /악보 만들기/ })).toBeEnabled();
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

  it('opens the chord detail screen and returns to the dictionary via the back button', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /코드 사전/ }));
    // open detail (screen transition, no overlay scrim) via "모든 폼" of the first card
    const allForms = screen.getAllByLabelText('모든 폼');
    await user.click(allForms[0]);
    expect(screen.getByText(/ALL VOICINGS/)).toBeInTheDocument();
    // dictionary toolbar is replaced (not overlaid): search box gone
    expect(screen.queryByPlaceholderText(/코드 검색/)).toBeNull();
    // it is a full screen, not a modal
    expect(screen.queryByRole('dialog')).toBeNull();
    // back via the appbar ← (aria-label 뒤로가기) -> returns to dictionary
    await user.click(screen.getByRole('button', { name: '뒤로가기' }));
    expect(screen.queryByText(/ALL VOICINGS/)).toBeNull();
    expect(screen.getByPlaceholderText(/코드 검색/)).toBeInTheDocument();
  });
});
