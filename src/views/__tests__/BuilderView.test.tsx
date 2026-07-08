import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProvider } from '../../test-utils';
import { BuilderView } from '../BuilderView';
import { SHEETS_KEY } from '../../state/sheet-persist';

/**
 * BuilderView 통합 테스트 (PR-1 로컬 전용).
 * 기본 provider는 seedCollected 4개(C/G/Am/F)를 담은 코드로 채운다 → 팔레트 arm/place 테스트 가능.
 */
describe('BuilderView', () => {
  it('renders the sheet card, palette and add-measure control', () => {
    renderWithProvider(<BuilderView />);
    expect(
      screen.getByPlaceholderText('악보 제목'),
    ).toBeInTheDocument();
    expect(screen.getByText('담은 코드 · 클릭해서 선택')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ 마디 추가' })).toBeInTheDocument();
  });

  it('play button is disabled with 준비 중 title (오디오 후속)', () => {
    renderWithProvider(<BuilderView />);
    const play = screen.getByRole('button', { name: /재생/ });
    expect(play).toBeDisabled();
    expect(play).toHaveAttribute('title', '준비 중');
  });

  it('shows seeded collected chords in the palette (C/G/Am/F)', () => {
    renderWithProvider(<BuilderView />);
    // palette cards render 고르기 label
    expect(screen.getAllByText('고르기').length).toBe(4);
  });

  it('arming a chord shows the armed hint and 선택됨 label (AC-10)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<BuilderView />);
    const armButtons = screen.getAllByText('고르기');
    // click the first palette card (its parent role=button)
    await user.click(armButtons[0].closest('[role="button"]') as HTMLElement);
    expect(screen.getByText('✓ 선택됨')).toBeInTheDocument();
    // hint banner updates to the armed suffix (빈 박을 클릭해 넣으세요)
    expect(screen.getByText(/빈 박을 클릭해 넣으세요/)).toBeInTheDocument();
  });

  it('arming then clicking an empty beat places the chord (AC-11) and updates CHORDS count', async () => {
    const user = userEvent.setup();
    renderWithProvider(<BuilderView />);
    // meta line starts at 0 CHORDS
    expect(screen.getByText(/0 CHORDS/)).toBeInTheDocument();
    // arm first chord
    await user.click(
      (screen.getAllByText('고르기')[0].closest('[role="button"]')) as HTMLElement,
    );
    // click first empty beat cell (title=클릭해서 코드 넣기).
    // 빈 셀의 접근성 이름은 텍스트(·/+)라 title로 조회한다.
    const cells = screen.getAllByTitle('클릭해서 코드 넣기');
    await user.click(cells[0]);
    // now 1 CHORDS
    expect(screen.getByText(/1 CHORDS/)).toBeInTheDocument();
  });

  it('saving with a filled slot persists a sheet to cs_sheets (AC-15/AC-19)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<BuilderView />);
    await user.type(screen.getByPlaceholderText('악보 제목'), '내 진행');
    // arm + place one chord
    await user.click(
      (screen.getAllByText('고르기')[0].closest('[role="button"]')) as HTMLElement,
    );
    await user.click(screen.getAllByTitle('클릭해서 코드 넣기')[0]);
    // save
    await user.click(screen.getByRole('button', { name: '저장' }));
    // saved sheets section appears
    expect(screen.getByText(/저장된 악보 1/)).toBeInTheDocument();
    // persisted to cs_sheets
    const stored = JSON.parse(localStorage.getItem(SHEETS_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('내 진행');
  });

  it('saving with no filled slot shows a toast and does not persist (AC-15)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<BuilderView />);
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.queryByText(/저장된 악보/)).toBeNull();
    const stored = JSON.parse(localStorage.getItem(SHEETS_KEY) || '[]');
    expect(stored).toHaveLength(0);
  });

  it('adding a measure grows the grid (AC-8 via UI)', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProvider(<BuilderView />);
    const before = container.querySelectorAll('[role="button"][title="클릭해서 코드 넣기"]').length;
    await user.click(screen.getByRole('button', { name: '+ 마디 추가' }));
    const after = container.querySelectorAll('[role="button"][title="클릭해서 코드 넣기"]').length;
    expect(after).toBe(before + 4); // 4/4 → +4 beats
  });

  it('changing time signature to 3/4 re-pads to a multiple of 3', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProvider(<BuilderView />);
    await user.click(screen.getByRole('tab', { name: '3/4' }));
    const cells = container.querySelectorAll(
      '[role="button"][title="클릭해서 코드 넣기"]',
    ).length;
    expect(cells % 3).toBe(0);
  });

  it('load and delete a saved sheet (AC-16/AC-17)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<BuilderView />);
    // create a sheet
    await user.type(screen.getByPlaceholderText('악보 제목'), '캐논');
    await user.click(
      (screen.getAllByText('고르기')[0].closest('[role="button"]')) as HTMLElement,
    );
    await user.click(screen.getAllByTitle('클릭해서 코드 넣기')[0]);
    await user.click(screen.getByRole('button', { name: '저장' }));

    const savedSection = screen.getByText(/저장된 악보 1/).parentElement as HTMLElement;
    // load
    await user.click(within(savedSection).getByRole('button', { name: '불러오기' }));
    // title input restored
    expect(screen.getByPlaceholderText('악보 제목')).toHaveValue('캐논');
    // delete
    await user.click(within(savedSection).getByRole('button', { name: '삭제' }));
    expect(screen.queryByText(/저장된 악보/)).toBeNull();
  });

  it('empty palette shows the dictionary link (removing all collected)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<BuilderView />);
    // palette remove buttons are aria-label 삭제; click repeatedly (list shrinks)
    for (let i = 0; i < 4; i++) {
      const btns = screen.getAllByRole('button', { name: '삭제' });
      await user.click(btns[0]);
    }
    expect(screen.getByText('코드 사전')).toBeInTheDocument();
  });
});
