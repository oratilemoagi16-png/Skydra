/**
 * Import surface launched from the dock's centered Import action.
 *
 * Hosts the existing FlightImporter unchanged. The importer stays mounted at
 * all times (the sheet hides via `hidden`, not unmount) so its startup
 * auto-sync and busy-state events keep working regardless of visibility.
 *
 * Desktop: centered dialog. Mobile: bottom sheet. Esc / backdrop / X close it.
 * The sync-folder config button and cancel-busy affordance moved here from
 * the old sidebar import section.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuFolderCheck, LuFolderCog, LuX } from 'react-icons/lu';
import { useFlightStore } from '@/stores/flightStore';
import { FlightImporter, getSyncFolderPath, normalizeSyncFolderPath, setSyncFolderPath } from '@/components/dashboard/FlightImporter';
import { isWebMode } from '@/lib/api';
import { useIsMobileRuntime } from '@/hooks/platform/useIsMobileRuntime';
import { cn } from '@/lib/cn';

interface ImportSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ImportSheet({ open, onClose }: ImportSheetProps) {
  const { t } = useTranslation();
  const isMobileRuntime = useIsMobileRuntime();
  const { isImporting, isBatchProcessing } = useFlightStore();
  const [syncFolder, setSyncFolder] = useState<string | null>(() => getSyncFolderPath());
  const panelRef = useRef<HTMLDivElement>(null);

  const busy = isImporting || isBatchProcessing;

  // Track sync-folder changes made anywhere (importer, mobile picker)
  useEffect(() => {
    const onChanged = () => setSyncFolder(getSyncFolderPath());
    window.addEventListener('syncFolderChanged', onChanged);
    return () => window.removeEventListener('syncFolderChanged', onChanged);
  }, []);

  // Esc to close + move focus into the sheet on open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const configureSyncFolder = async () => {
    if (isMobileRuntime) {
      window.dispatchEvent(new CustomEvent('requestMobileSyncFolderSelection'));
      return;
    }
    try {
      const { open: openDialog } = await import('@tauri-apps/plugin-dialog');
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: t('dashboard.selectSyncFolder'),
      });
      const selectedFolder =
        typeof selected === 'string'
          ? selected
          : Array.isArray(selected) && typeof selected[0] === 'string'
            ? selected[0]
            : null;
      if (selectedFolder) {
        setSyncFolderPath(normalizeSyncFolderPath(selectedFolder));
        window.dispatchEvent(new CustomEvent('syncFolderChanged'));
      }
    } catch (e) {
      console.error('Failed to select sync folder:', e);
    }
  };

  const showSyncConfig = !isWebMode();

  return (
    <div
      className={cn(
        'fixed inset-0 z-[50] flex flex-col items-center justify-end sm:justify-center',
        open ? '' : 'hidden'
      )}
      role="dialog"
      aria-modal="true"
      aria-label={t('nav.import')}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden border border-line bg-elevated shadow-overlay outline-none rounded-t-[var(--skydra-radius-lg)] sm:mx-4 sm:max-w-[440px] sm:rounded-[var(--skydra-radius-lg)]"
        style={{ paddingBottom: 'var(--mobile-safe-bottom, 0px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink">{t('nav.import')}</h2>
          <div className="flex items-center gap-1">
            {showSyncConfig && (
              <button
                type="button"
                onClick={configureSyncFolder}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  syncFolder
                    ? 'text-success hover:bg-success/10'
                    : 'text-danger hover:bg-danger/10'
                )}
                title={syncFolder ? `Sync folder: ${syncFolder}` : t('dashboard.configureSyncFolder')}
              >
                {syncFolder ? <LuFolderCheck className="h-4 w-4" /> : <LuFolderCog className="h-4 w-4" />}
              </button>
            )}
            {busy && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('cancelImporterAction'));
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                title={t('nav.cancelImport', 'Cancel import/sync')}
                aria-label={t('nav.cancelImport', 'Cancel import/sync')}
              >
                <LuX className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              title={t('nav.close', 'Close')}
              aria-label={t('nav.close', 'Close')}
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Importer body — the existing flow, unmodified */}
        <div className="settings-scroll overflow-y-auto px-4 py-3">
          <FlightImporter />
        </div>
      </div>
    </div>
  );
}
