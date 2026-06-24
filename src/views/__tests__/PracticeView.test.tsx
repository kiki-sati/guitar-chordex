import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProvider } from '../../test-utils';
import { PracticeView } from '../PracticeView';
import { dateStr } from '../../domain/notes';
import { KEYS } from '../../state/persist';

const today = dateStr(new Date());

describe('PracticeView', () => {
  it('renders 4 stat cards', () => {
    renderWithProvider(<PracticeView />);
    expect(screen.getByText(/연속 연습 중/)).toBeInTheDocument();
    expect(screen.getByText(/총 연습한 날/)).toBeInTheDocument();
    expect(screen.getByText(/이번 주 세션/)).toBeInTheDocument();
    expect(screen.getByText(/누적 세션/)).toBeInTheDocument();
  });

  it('renders the grass heatmap and journal records', () => {
    const { container } = renderWithProvider(<PracticeView />);
    expect(container.querySelectorAll('[data-testid="grass-cell"]').length).toBeGreaterThan(0);
    // seed journal has 3 entries
    expect(screen.getByText(/기록 \(3\)/)).toBeInTheDocument();
  });

  it('adds a new drill from the draft input', async () => {
    const user = userEvent.setup();
    renderWithProvider(<PracticeView />);
    const input = screen.getByPlaceholderText(/연습할 내용/);
    await user.type(input, '새 연습 항목');
    await user.click(screen.getByRole('button', { name: '추가' }));
    expect(screen.getByText('새 연습 항목')).toBeInTheDocument();
  });

  it('logs practice → grass for today persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<PracticeView />);
    await user.click(screen.getByRole('button', { name: /오늘 연습 기록/ }));
    const stored = JSON.parse(localStorage.getItem(KEYS.grass) || '{}');
    expect(stored[today]).toBeGreaterThanOrEqual(1);
  });

  it('submits a journal entry → prepended and persisted', async () => {
    const user = userEvent.setup();
    renderWithProvider(<PracticeView />);
    await user.type(
      screen.getByPlaceholderText('오늘 무엇을 연습했나요?'),
      '테스트 일지',
    );
    await user.click(screen.getByRole('button', { name: '일지 기록 + 잔디 심기' }));
    // record count now 4
    expect(screen.getByText(/기록 \(4\)/)).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(KEYS.journal) || '[]');
    expect(stored[0].title).toBe('테스트 일지');
  });

  it('drill stamp click fills the circle (count increments)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<PracticeView />);
    // first seeded drill 'F 바레코드...' has count 6/10. Find its row.
    const titleEl = screen.getByText(/F 바레코드 깨끗하게/);
    const row = titleEl.closest('div')?.parentElement as HTMLElement;
    expect(row).toBeTruthy();
    const stamps = within(row).getAllByRole('button', { pressed: false });
    // clicking the first empty stamp (index 6) sets count to 7
    await user.click(stamps[0]);
    // counter text updates to 7 / 10
    expect(within(row).getByText('7 / 10')).toBeInTheDocument();
  });
});
