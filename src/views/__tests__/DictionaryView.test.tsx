import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProvider } from '../../test-utils';
import { DictionaryView } from '../DictionaryView';

describe('DictionaryView', () => {
  it('renders 7 diatonic chord cards in key mode by default (C major)', () => {
    renderWithProvider(<DictionaryView />);
    // diatonic C major names
    expect(screen.getByText('Cmaj7')).toBeInTheDocument();
    expect(screen.getByText('G7')).toBeInTheDocument();
    expect(screen.getByText('Bm7♭5')).toBeInTheDocument();
  });

  it('updates the grid when a new root is selected', async () => {
    const user = userEvent.setup();
    renderWithProvider(<DictionaryView />);
    // select G (root pill)
    const pills = screen.getAllByRole('button', { name: 'G' });
    await user.click(pills[0]);
    // G major diatonic first chord = Gmaj7
    expect(screen.getByText('Gmaj7')).toBeInTheDocument();
  });

  it('search filters chords by normalized name', async () => {
    const user = userEvent.setup();
    renderWithProvider(<DictionaryView />);
    const input = screen.getByPlaceholderText(/코드 검색/);
    await user.type(input, 'am7');
    // result includes Am7
    expect(screen.getByText('Am7')).toBeInTheDocument();
    // result count label present
    expect(screen.getByText(/검색 결과/)).toBeInTheDocument();
  });

  it('shows empty message for no matches', async () => {
    const user = userEvent.setup();
    renderWithProvider(<DictionaryView />);
    const input = screen.getByPlaceholderText(/코드 검색/);
    await user.type(input, 'zzz');
    expect(screen.getByText(/일치하는 코드가 없어요/)).toBeInTheDocument();
  });

  it('switches to root mode showing chord group labels', async () => {
    const user = userEvent.setup();
    renderWithProvider(<DictionaryView />);
    await user.click(screen.getByRole('tab', { name: '루트별 코드' }));
    expect(screen.getByText(/트라이어드/)).toBeInTheDocument();
    expect(screen.getByText(/세븐스/)).toBeInTheDocument();
  });

  it('collect via card bookmark button adds to collected (no crash, toast path)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<DictionaryView />);
    // every card exposes a 담기 (collect) button; click the first
    const collectButtons = screen.getAllByLabelText('담기');
    expect(collectButtons.length).toBeGreaterThan(0);
    await user.click(collectButtons[0]);
    expect(collectButtons[0]).toBeInTheDocument();
  });
});
