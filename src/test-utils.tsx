import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AppProvider } from './state/AppContext';

/** AppProvider로 감싼 렌더. localStorage는 vitest.setup이 매 테스트 초기화. */
export function renderWithProvider(ui: ReactElement): RenderResult {
  return render(<AppProvider>{ui}</AppProvider>);
}
