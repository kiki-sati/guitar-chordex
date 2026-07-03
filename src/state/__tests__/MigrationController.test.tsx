import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MigrationController } from '../MigrationController';
import { KEYS } from '../persist';
import { ko } from '../../i18n/strings';
import type { SupabaseRepository } from '../supabase-repository';
import type { AsyncRepository } from '../repository';
import type { PersistedState } from '../persist';

function makeRemote(migratedAt: string | null) {
  const remote = {
    getMigratedAt: vi.fn().mockResolvedValue(migratedAt),
    setMigratedAt: vi.fn().mockResolvedValue(undefined),
  };
  return remote as unknown as SupabaseRepository & typeof remote;
}

function makeRepo() {
  const repo: AsyncRepository = {
    loadCached: vi.fn(() => empty()),
    start: vi.fn(),
    apply: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
  return repo as AsyncRepository & { apply: ReturnType<typeof vi.fn> };
}

function empty(): PersistedState {
  return { grass: {}, journal: [], drills: [], collected: [], lang: 'ko' };
}

function seedLegacy() {
  localStorage.setItem(KEYS.grass, JSON.stringify({ '2026-07-01': 3 }));
  localStorage.setItem(
    KEYS.journal,
    JSON.stringify([{ id: 'j1', date: 'd', title: 't', minutes: 1, chords: [], notes: '' }]),
  );
}

beforeEach(() => localStorage.clear());

describe('MigrationController — judgment branches (B6-4/5/6)', () => {
  it('B6-4: migratedAt !== null → no modal (re-proposal prevented)', async () => {
    seedLegacy();
    const remote = makeRemote('2026-06-01T00:00:00.000Z');
    render(<MigrationController remote={remote} repo={makeRepo()} />);
    await waitFor(() => expect(remote.getMigratedAt).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(remote.setMigratedAt).not.toHaveBeenCalled();
  });

  it('B6-5: migratedAt=null & no legacy → no modal + setMigratedAt(now)', async () => {
    // no legacy data seeded
    const remote = makeRemote(null);
    render(<MigrationController remote={remote} repo={makeRepo()} />);
    await waitFor(() => expect(remote.setMigratedAt).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('B6-6: migratedAt=null & legacy present → modal shown', async () => {
    seedLegacy();
    const remote = makeRemote(null);
    render(<MigrationController remote={remote} repo={makeRepo()} />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(ko.migrateTitle)).toBeInTheDocument();
    // did NOT auto-set migratedAt (waits for user choice)
    expect(remote.setMigratedAt).not.toHaveBeenCalled();
  });
});

describe('MigrationController — actions (B6-7/8)', () => {
  it('B6-7: "가져오기" → apply(legacyToChanges) + setMigratedAt, modal closes', async () => {
    seedLegacy();
    const remote = makeRemote(null);
    const repo = makeRepo();
    render(<MigrationController remote={remote} repo={repo} />);
    const importBtn = await screen.findByRole('button', { name: ko.migrateImport });

    await act(async () => {
      importBtn.click();
    });

    await waitFor(() => expect(repo.apply).toHaveBeenCalledTimes(1));
    const changes = repo.apply.mock.calls[0][0];
    // legacy grass + journal converted → at least a grass and journal change present
    expect(changes.some((c: { kind: string }) => c.kind === 'grass')).toBe(true);
    expect(changes.some((c: { kind: string }) => c.kind === 'journal')).toBe(true);
    await waitFor(() => expect(remote.setMigratedAt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // legacy keys preserved (rollback safety)
    expect(localStorage.getItem(KEYS.grass)).not.toBeNull();
  });

  it('B6-8: "새로 시작" → setMigratedAt only, apply NOT called, legacy preserved', async () => {
    seedLegacy();
    const remote = makeRemote(null);
    const repo = makeRepo();
    render(<MigrationController remote={remote} repo={repo} />);
    const skipBtn = await screen.findByRole('button', { name: ko.migrateSkip });

    await act(async () => {
      skipBtn.click();
    });

    await waitFor(() => expect(remote.setMigratedAt).toHaveBeenCalledTimes(1));
    expect(repo.apply).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(localStorage.getItem(KEYS.grass)).not.toBeNull();
  });
});
