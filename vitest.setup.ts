import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// React Testing Library: unmount after each test.
afterEach(() => {
  cleanup();
});

// jsdom provides a localStorage implementation; clear it between tests for isolation.
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no-op */
  }
});
