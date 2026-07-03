import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MigrationModal } from '../MigrationModal';
import { ko } from '../../i18n/strings';

describe('MigrationModal', () => {
  it('renders as an accessible dialog with title/body and both actions', () => {
    render(<MigrationModal onImport={() => {}} onSkip={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(ko.migrateTitle)).toBeInTheDocument();
    expect(screen.getByText(ko.migrateBody)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ko.migrateImport })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ko.migrateSkip })).toBeInTheDocument();
  });

  it('invokes onImport / onSkip on click', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onSkip = vi.fn();
    render(<MigrationModal onImport={onImport} onSkip={onSkip} />);
    await user.click(screen.getByRole('button', { name: ko.migrateImport }));
    expect(onImport).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: ko.migrateSkip }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons and shows importing label when busy', () => {
    render(<MigrationModal onImport={() => {}} onSkip={() => {}} busy />);
    expect(screen.getByRole('button', { name: ko.migrateImporting })).toBeDisabled();
    expect(screen.getByRole('button', { name: ko.migrateSkip })).toBeDisabled();
  });
});
