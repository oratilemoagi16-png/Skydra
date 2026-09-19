/**
 * Settings modal for API key configuration
 */

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { sha256 } from 'js-sha256';
import * as api from '@/lib/api';
import { isWebMode, getKeepUploadSettings, setKeepUploadSettings, KeepUploadSettings } from '@/lib/api';
import { useFlightStore } from '@/stores/flightStore';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { getBlacklist, getSyncFolderPath, removeFromBlacklist } from './FlightImporter';
import { AboutDialog } from '@/components/about/AboutDialog';
import { SMART_TAG_TYPES, getEnabledSmartTagTypes, setEnabledSmartTagTypes, SmartTagTypeId } from '@/lib/api';

import { useIsMobileRuntime } from '@/hooks/platform/useIsMobileRuntime';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BackupProgressEvent {
  operation: 'export' | 'import';
  percent: number;
  stage: string;
}

interface SyncBlacklistEntryUi {
  hash: string;
  currentFilename: string | null;
  isPresentInSyncFolder: boolean;
}

type SettingsSectionId = 'display' | 'profile' | 'tags' | 'sync' | 'data' | 'about';

const SETTINGS_SECTIONS: { id: SettingsSectionId; labelKey: string; descKey: string }[] = [
  { id: 'display', labelKey: 'settings.sectionDisplay', descKey: 'settings.sectionDisplayDesc' },
  { id: 'profile', labelKey: 'settings.sectionProfile', descKey: 'settings.sectionProfileDesc' },
  { id: 'tags', labelKey: 'settings.sectionTags', descKey: 'settings.sectionTagsDesc' },
  { id: 'sync', labelKey: 'settings.sectionSync', descKey: 'settings.sectionSyncDesc' },
  { id: 'data', labelKey: 'settings.sectionData', descKey: 'settings.sectionDataDesc' },
  { id: 'about', labelKey: 'settings.sectionAbout', descKey: 'settings.sectionAboutDesc' },
];

const SETTINGS_SECTION_DEFAULT_LABELS: Record<SettingsSectionId, string> = {
  display: 'Display & Language',
  profile: 'Profile & Security',
  tags: 'Tags',
  sync: 'Import & Sync',
  data: 'Data & Backup',
  about: 'About',
};

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const webMode = isWebMode();
  const isMobileRuntime = useIsMobileRuntime();
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [apiKeyType, setApiKeyType] = useState<'none' | 'default' | 'personal'>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [appLogDir, setAppLogDir] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [blacklistCount, setBlacklistCount] = useState(0);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);
  const [isBlacklistScanning, setIsBlacklistScanning] = useState(false);
  const [blacklistEntries, setBlacklistEntries] = useState<SyncBlacklistEntryUi[]>([]);
  const [selectedBlacklistHashes, setSelectedBlacklistHashes] = useState<Set<string>>(new Set());
  const [isClearingSelectedBlacklist, setIsClearingSelectedBlacklist] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupProgress, setBackupProgress] = useState<BackupProgressEvent | null>(null);
  const [fallbackProgress, setFallbackProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmRemoveAutoTags, setConfirmRemoveAutoTags] = useState(false);
  const [enabledTagTypes, setEnabledTagTypes] = useState<SmartTagTypeId[]>(() => getEnabledSmartTagTypes());
  const [isTagTypeDropdownOpen, setIsTagTypeDropdownOpen] = useState(false);
  const [tagTypeSearch, setTagTypeSearch] = useState('');
  const tagTypeDropdownRef = useRef<HTMLDivElement>(null);
  const [keepUploadSettings, setKeepUploadSettingsState] = useState<KeepUploadSettings | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('display');
  const isDesktopNav = useMediaQuery('(min-width: 1024px)');
  const blacklistPanelRef = useRef<HTMLDivElement>(null);

  // Profile password management state
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [autoLogout, setAutoLogout] = useState(false);

  const {
    unitPrefs,
    setUnitPref,
    locale,
    setLocale,
    dateLocale,
    setDateLocale,
    appLanguage,
    setAppLanguage,
    themeMode,
    setThemeMode,
    timeFormat,
    setTimeFormat,
    loadFlights,
    loadOverview,
    clearSelection,
    smartTagsEnabled,
    setSmartTagsEnabled,
    loadSmartTagsEnabled,
    regenerateSmartTags,
    removeAllAutoTags,
    isRegenerating,
    isRemovingAutoTags,
    regenerationProgress,
    loadApiKeyType,
    hideSerialNumbers,
    setHideSerialNumbers,
    activeProfile,
    profilePasswords,
    loadProfiles,
  } = useFlightStore();

  // Local state so the dropdown responds instantly; store update is deferred via startTransition
  const [localTimeFormat, setLocalTimeFormat] = useState<'12h' | '24h'>(timeFormat);
  const [isTimeFormatPending, startTimeFormatTransition] = useTransition();

  const [unitsDropdownOpen, setUnitsDropdownOpen] = useState(false);
  const canEditApiKey = activeProfile === 'default';

  useEffect(() => {
    if (webMode) return;

    let unlisten: (() => void) | undefined;
    let disposed = false;

    (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        if (disposed) return;
        unlisten = await listen<BackupProgressEvent>('backup-progress', (event) => {
          const payload = event.payload;
          setBackupProgress({
            operation: payload.operation,
            percent: Math.max(0, Math.min(100, Math.round(payload.percent))),
            stage: payload.stage || '',
          });
        });
      } catch (err) {
        console.warn('Failed to subscribe to backup progress events', err);
      }
    })();

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [webMode]);

  useEffect(() => {
    const needsFallback = isDeleting;
    if (!needsFallback) {
      setFallbackProgress(0);
      return;
    }

    setFallbackProgress((prev) => (prev > 0 ? prev : 8));
    const timer = setInterval(() => {
      setFallbackProgress((prev) => {
        if (prev >= 92) return 92;
        const delta = Math.max(1, Math.round((92 - prev) * 0.18));
        return Math.min(92, prev + delta);
      });
    }, 300);

    return () => clearInterval(timer);
  }, [isDeleting]);

  // True when any long-running destructive/IO operation is in progress
  const isBusy = isBackingUp || isRestoring || isDeleting || isRegenerating || isRemovingAutoTags;

  // Check if API key exists on mount
  useEffect(() => {
    if (isOpen) {
      void (async () => {
        checkApiKey();
        if (!webMode) {
          getAppLogDir();
        }
        loadSmartTagsEnabled();
        fetchAppVersion();
        setBlacklistCount((await getBlacklist()).size);
        // Load enabled tag types from backend
        api.loadEnabledSmartTagTypes().then(setEnabledTagTypes);
        // Load keep upload settings (Tauri desktop only)
        if (!isWebMode()) {
          getKeepUploadSettings().then(setKeepUploadSettingsState);
          api.getAutoLogout().then(setAutoLogout);
        }
      })();
    }
  }, [isOpen]);

  // Auto-dismiss messages after 5 seconds
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  // Keep dismissal props stable for the shared Modal: its open-effect depends on
  // `onClose`/`dismissable`, and Dashboard passes an inline onClose — every app
  // re-render would otherwise re-run the primitive's focus restore and steal
  // focus out of the dialog. Dismissal scoping (nested dialogs, busy ops, open
  // dropdowns) lives in the guarded handler instead of the `dismissable` flag.
  const onCloseRef = useRef(onClose);
  const dismissGuardRef = useRef(false);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    dismissGuardRef.current = isBusy || isAboutOpen || isBlacklistModalOpen;
  }, [isBusy, isAboutOpen, isBlacklistModalOpen]);
  const handleModalClose = useCallback(() => {
    if (!dismissGuardRef.current) onCloseRef.current();
  }, []);

  // Collapse open dropdowns when the dialog closes.
  useEffect(() => {
    if (isOpen) return;
    setUnitsDropdownOpen(false);
    setIsTagTypeDropdownOpen(false);
    setTagTypeSearch('');
  }, [isOpen]);

  // Move focus into the blacklist manager when it opens (it lives inside the
  // settings dialog panel, so the parent focus trap covers its controls).
  useEffect(() => {
    if (!isBlacklistModalOpen) return;
    const timer = window.setTimeout(() => {
      const panel = blacklistPanelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>('button:not([disabled])');
      (first ?? panel).focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isBlacklistModalOpen]);

  // Escape closes the blacklist manager itself (the settings dialog stays put
  // because its own dismissal is suspended while a nested dialog is open).
  useEffect(() => {
    if (!isBlacklistModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBlacklistScanning && !isClearingSelectedBlacklist) {
        setIsBlacklistModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isBlacklistModalOpen, isBlacklistScanning, isClearingSelectedBlacklist]);

  const checkApiKey = async () => {
    try {
      const exists = await api.hasApiKey();
      setHasKey(exists);
      const keyType = await api.getApiKeyType();
      setApiKeyType(keyType as 'none' | 'default' | 'personal');
    } catch (err) {
      console.error('Failed to check API key:', err);
    }
  };

  const fetchAppVersion = async () => {
    try {
      // Try Tauri API first (desktop mode)
      const { getVersion } = await import('@tauri-apps/api/app');
      const version = await getVersion();
      setAppVersion(version);
    } catch {
      // Fallback to package.json version injected by Vite
      setAppVersion(__APP_VERSION__);
    }
  };

  const getAppLogDir = async () => {
    try {
      const dir = await api.getAppLogDir();
      setAppLogDir(dir);
    } catch (err) {
      console.error('Failed to get app log dir:', err);
    }
  };

  const shortenHash = (hash: string): string => {
    if (hash.length <= 18) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const loadBlacklistEntriesForModal = async () => {
    setIsBlacklistScanning(true);
    setSelectedBlacklistHashes(new Set());

    try {
      const baseEntries = await api.getSyncBlacklistDetails();

      if (webMode) {
        setBlacklistEntries(baseEntries);
        setBlacklistCount(baseEntries.length);
        return;
      }

      const syncFolderPath = getSyncFolderPath();
      if (!syncFolderPath) {
        setBlacklistEntries(baseEntries);
        setBlacklistCount(baseEntries.length);
        return;
      }

      let allowedExtensionSet = new Set<string>();
      try {
        const allowedExtensions = await api.getAllowedLogExtensions();
        allowedExtensionSet = new Set(
          allowedExtensions.map((ext) => ext.trim().replace(/^\./, '').toLowerCase()).filter(Boolean)
        );
      } catch {
        // Keep an empty set and skip extension filtering if extension discovery fails.
      }

      const normalizeExt = (fileName: string): string | null => {
        const idx = fileName.lastIndexOf('.');
        if (idx < 0 || idx === fileName.length - 1) return null;
        return fileName.slice(idx + 1).toLowerCase();
      };

      const isAllowedByExtension = (fileName: string): boolean => {
        if (allowedExtensionSet.size === 0) return true;
        const ext = normalizeExt(fileName);
        if (!ext) return false;
        return allowedExtensionSet.has(ext);
      };

      const joinFolderPath = (folderPath: string, fileName: string): string => {
        const trimmed = folderPath.replace(/[\\/]+$/, '');
        return `${trimmed}/${fileName}`;
      };

      const baseHashSet = new Set(baseEntries.map((entry) => entry.hash));
      const resolvedByHash = new Map<string, string>();

      // Android mobile build uses persisted SAF URI permissions; resolve filenames via AndroidFs.
      if (isMobileRuntime) {
        try {
          const savedUriRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('mobileSyncFolderUri') : null;
          const savedUri = savedUriRaw ? JSON.parse(savedUriRaw) as { uri?: string; documentTopTreeUri?: string | null } : null;

          if (savedUri?.uri) {
            const androidFsModule = await import('tauri-plugin-android-fs-api') as unknown as {
              AndroidFs: {
                readDir: (uri: { uri: string; documentTopTreeUri: string | null }) => Promise<Array<{ type: 'Dir' | 'File'; name: string; uri: { uri: string; documentTopTreeUri: string | null } }>>;
                readFile: (uri: { uri: string; documentTopTreeUri: string | null }) => Promise<Uint8Array>;
                checkPersistedPickerUriPermission: (uri: { uri: string; documentTopTreeUri: string | null }, state: string) => Promise<boolean>;
              };
              AndroidUriPermissionState: {
                ReadOrWrite: string;
              };
            };

            const hasPermission = await androidFsModule.AndroidFs
              .checkPersistedPickerUriPermission(savedUri as { uri: string; documentTopTreeUri: string | null }, androidFsModule.AndroidUriPermissionState.ReadOrWrite)
              .catch(() => false);

            if (hasPermission) {
              const files: Array<{ name: string; uri: { uri: string; documentTopTreeUri: string | null } }> = [];

              const normalizeExt = (fileName: string): string | null => {
                const idx = fileName.lastIndexOf('.');
                if (idx < 0 || idx === fileName.length - 1) return null;
                return fileName.slice(idx + 1).toLowerCase();
              };

              const isAllowedByExtension = (fileName: string): boolean => {
                if (allowedExtensionSet.size === 0) return true;
                const ext = normalizeExt(fileName);
                if (!ext) return false;
                return allowedExtensionSet.has(ext);
              };

              const walk = async (uri: { uri: string; documentTopTreeUri: string | null }) => {
                const dirEntries = await androidFsModule.AndroidFs.readDir(uri);
                for (const entry of dirEntries) {
                  if (entry.type === 'Dir') {
                    await walk(entry.uri);
                    continue;
                  }
                  if (entry.type === 'File' && isAllowedByExtension(entry.name)) {
                    files.push({ name: entry.name, uri: entry.uri });
                  }
                }
              };

              await walk(savedUri as { uri: string; documentTopTreeUri: string | null });
              files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

              for (const file of files) {
                try {
                  const content = await androidFsModule.AndroidFs.readFile(file.uri);
                  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
                  const hash = sha256(bytes);
                  if (!baseHashSet.has(hash)) continue;
                  if (!resolvedByHash.has(hash)) {
                    resolvedByHash.set(hash, file.name);
                  }
                } catch {
                  continue;
                }
              }
            }
          }
        } catch {
          // Fall back to hash-only view if Android SAF access is unavailable.
        }

        const mergedEntries = baseEntries.map((entry) => {
          const resolvedName = resolvedByHash.get(entry.hash) ?? null;
          return {
            ...entry,
            currentFilename: resolvedName,
            isPresentInSyncFolder: resolvedName !== null,
          };
        });

        setBlacklistEntries(mergedEntries);
        setBlacklistCount(mergedEntries.length);
        return;
      }

      const { readDir } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir(syncFolderPath);

      const candidateFiles = entries
        .filter((entry) => entry.isFile && entry.name && isAllowedByExtension(entry.name))
        .map((entry) => entry.name as string)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      for (const name of candidateFiles) {
        const filePath = joinFolderPath(syncFolderPath, name);
        let hash: string;
        try {
          hash = await api.computeFileHash(filePath);
        } catch {
          continue;
        }

        if (!baseHashSet.has(hash)) continue;
        if (!resolvedByHash.has(hash)) {
          resolvedByHash.set(hash, name);
        }
      }

      const mergedEntries = baseEntries.map((entry) => {
        const resolvedName = resolvedByHash.get(entry.hash) ?? null;
        return {
          ...entry,
          currentFilename: resolvedName,
          isPresentInSyncFolder: resolvedName !== null,
        };
      });

      setBlacklistEntries(mergedEntries);
      setBlacklistCount(mergedEntries.length);
    } catch {
      // Keep modal functional even if scanning fails.
      const baseEntries = await api.getSyncBlacklistDetails().catch(() => []);
      setBlacklistEntries(baseEntries);
      setBlacklistCount(baseEntries.length);
    } finally {
      setIsBlacklistScanning(false);
    }
  };

  const openBlacklistModal = async () => {
    setIsBlacklistModalOpen(true);
    await loadBlacklistEntriesForModal();
  };

  const handleSelectAllBlacklist = () => {
    setSelectedBlacklistHashes(new Set(blacklistEntries.map((entry) => entry.hash)));
  };

  const handleDeselectAllBlacklist = () => {
    setSelectedBlacklistHashes(new Set());
  };

  const toggleBlacklistSelection = (hash: string) => {
    setSelectedBlacklistHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  };

  const handleClearSelectedBlacklist = async () => {
    if (selectedBlacklistHashes.size === 0) return;

    setIsClearingSelectedBlacklist(true);
    try {
      const selected = Array.from(selectedBlacklistHashes);
      await Promise.all(selected.map((hash) => removeFromBlacklist(hash)));

      const nextEntries = blacklistEntries.filter((entry) => !selectedBlacklistHashes.has(entry.hash));
      setBlacklistEntries(nextEntries);
      setSelectedBlacklistHashes(new Set());
      setBlacklistCount(nextEntries.length);
      setMessage({ type: 'success', text: t('settings.blacklistSelectedCleared') });
    } catch (err) {
      setMessage({ type: 'error', text: t('settings.blacklistSelectedClearFailed', { error: String(err) }) });
    } finally {
      setIsClearingSelectedBlacklist(false);
    }
  };

  const handleSave = async () => {
    if (!canEditApiKey) {
      setMessage({ type: 'error', text: t('settings.apiKeyDefaultProfileOnlyTitle') });
      return;
    }

    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: t('settings.enterApiKey') });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await api.setApiKey(apiKey.trim());
      setMessage({ type: 'success', text: 'API key saved successfully!' });
      setHasKey(true);
      setApiKey(''); // Clear the input for security
      await checkApiKey(); // Refresh key type to update badge
      await loadApiKeyType(); // Update global store for FlightImporter cooldown bypass
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to save: ${err}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    setMessage(null);
    try {
      await api.deleteAllFlights();
      clearSelection();
      await loadFlights();
      await loadOverview();
      setMessage({ type: 'success', text: 'All logs deleted.' });
      setConfirmDeleteAll(false);
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to delete: ${err}` });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    setMessage(null);
    if (!webMode) {
      setBackupProgress({ operation: 'export', percent: 0, stage: 'Starting backup' });
    }
    try {
      const success = await api.backupDatabase();
      if (success) {
        setMessage({ type: 'success', text: 'Database backup exported successfully!' });
      }
      // If not success, user cancelled - no message needed
    } catch (err) {
      setMessage({ type: 'error', text: `Backup failed: ${err}` });
    } finally {
      setIsBackingUp(false);
      setBackupProgress(null);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setMessage(null);
    if (!webMode) {
      setBackupProgress({ operation: 'import', percent: 0, stage: 'Starting restore' });
    }
    try {
      if (api.isWebMode()) {
        // Web mode: pick file via browser dialog
        const files = await api.pickFiles('.backup', false);
        if (files.length === 0) {
          setIsRestoring(false);
          return;
        }
        const msg = await api.restoreDatabase(files[0]);
        setMessage({ type: 'success', text: msg || 'Backup restored successfully!' });
      } else {
        // Tauri mode: native dialog handled inside restoreDatabase
        const msg = await api.restoreDatabase();
        if (!msg) {
          setIsRestoring(false);
          return; // user cancelled
        }
        setMessage({ type: 'success', text: msg });
      }
      // Refresh data after restore
      clearSelection();
      await loadFlights();
      await loadOverview();
    } catch (err) {
      setMessage({ type: 'error', text: `Restore failed: ${err}` });
    } finally {
      setIsRestoring(false);
      setBackupProgress(null);
    }
  };

  const onTabListKeyDown = (event: React.KeyboardEvent) => {
    const ids = SETTINGS_SECTIONS.map((s) => s.id);
    const idx = ids.indexOf(activeSection);
    let next = -1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (idx + 1) % ids.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (idx - 1 + ids.length) % ids.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ids.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const id = ids[next];
    setActiveSection(id);
    document.getElementById(`settings-tab-${id}`)?.focus();
  };

  const sortedBlacklistEntries = [...blacklistEntries].sort((a, b) => {
    const aSelected = selectedBlacklistHashes.has(a.hash);
    const bSelected = selectedBlacklistHashes.has(b.hash);

    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;

    const aName = (a.currentFilename ?? '').toLowerCase();
    const bName = (b.currentFilename ?? '').toLowerCase();

    if (aName && bName) return aName.localeCompare(bName);
    if (aName) return -1;
    if (bName) return 1;
    return a.hash.localeCompare(b.hash);
  });

  const nestedDialogOpen = isAboutOpen || isBlacklistModalOpen;

  if (!isOpen) return null;

  const activeSectionMeta = SETTINGS_SECTIONS.find((s) => s.id === activeSection) ?? SETTINGS_SECTIONS[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      labelledBy="settings-modal-title"
      className={`w-full max-w-[920px] max-h-[calc(100vh-2rem)] modal-mobile-max flex flex-col ${
        nestedDialogOpen
          ? ''
          : 'h-[min(720px,calc(100dvh-2rem))] bg-surface rounded-xl border border-line shadow-2xl'
      }`}
    >
      {/* Blocking overlay while a long-running operation is in progress */}
      {isBusy && (
        <div role="status" className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-elevated/90 backdrop-blur-[2px] rounded-xl">
          <svg className="w-10 h-10 text-accent animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
          </svg>
          <p className="mt-3 text-sm font-semibold text-ink">
            {isBackingUp && t('settings.exportingBackup')}
            {isRestoring && t('settings.restoringBackup')}
            {isDeleting && t('settings.deletingAllLogs')}
            {isRemovingAutoTags && t('settings.removingAutoTags')}
            {isRegenerating && (
              <>
                {t('settings.regeneratingSmartTags')}
                {regenerationProgress && (
                  <span className="block text-xs font-normal text-muted mt-1">
                    {t('settings.processedFlights', { x: regenerationProgress.processed, y: regenerationProgress.total })}
                  </span>
                )}
              </>
            )}
          </p>
          {!webMode && (isBackingUp || isRestoring) && backupProgress && (
            <div className="mt-3 w-72 max-w-[80vw]">
              <div
                className="h-2 rounded-full bg-line/70 overflow-hidden"
                role="progressbar"
                aria-valuenow={backupProgress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={isBackingUp ? t('settings.exportingBackup') : t('settings.restoringBackup')}
              >
                <div
                  className="h-full bg-accent transition-all duration-200"
                  style={{ width: `${backupProgress.percent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink text-center">
                {backupProgress.stage || (isBackingUp ? t('settings.exportingBackup') : t('settings.restoringBackup'))} ({backupProgress.percent}%)
              </p>
            </div>
          )}
          {isDeleting && (
            <div className="mt-3 w-72 max-w-[80vw]">
              <div
                className="h-2 rounded-full bg-line/70 overflow-hidden"
                role="progressbar"
                aria-valuenow={fallbackProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('settings.deletingAllLogs')}
              >
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${fallbackProgress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink text-center">
                {t('settings.deletingAllLogs')} ({fallbackProgress}%)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Accessible-name host — stays mounted while nested dialogs overlay this one */}
      <h2 id="settings-modal-title" className="sr-only">
        {t('settings.title')}
      </h2>

      {!nestedDialogOpen && (
        <>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-line">
            <h2 className="text-base font-semibold text-ink">
              {t('settings.title')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              aria-label={t('nav.close', 'Close')}
              className="text-muted hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body — section nav + active section panel */}
          <div
            className="flex-1 flex flex-col lg:flex-row min-h-0"
            onKeyDown={(e) => {
              // Esc peels an open dropdown before it reaches the dialog
              if (e.key !== 'Escape') return;
              if (!unitsDropdownOpen && !isTagTypeDropdownOpen) return;
              e.preventDefault();
              e.stopPropagation();
              setUnitsDropdownOpen(false);
              setIsTagTypeDropdownOpen(false);
              setTagTypeSearch('');
            }}
          >
            <div
              role="tablist"
              aria-orientation={isDesktopNav ? 'vertical' : 'horizontal'}
              aria-label={t('settings.sections', 'Settings sections')}
              onKeyDown={onTabListKeyDown}
              className="shrink-0 flex lg:flex-col gap-0.5 lg:gap-1 px-3 py-2 lg:py-4 lg:w-52 border-b lg:border-b-0 lg:border-r border-line overflow-x-auto"
            >
              {SETTINGS_SECTIONS.map((section) => {
                const selected = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    id={`settings-tab-${section.id}`}
                    aria-selected={selected}
                    aria-controls={`settings-panel-${section.id}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveSection(section.id)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 lg:py-2 text-[13px] font-medium text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      selected
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted hover:text-ink hover:bg-line/40'
                    }`}
                  >
                    {t(section.labelKey, SETTINGS_SECTION_DEFAULT_LABELS[section.id])}
                  </button>
                );
              })}
            </div>

            <div
              role="tabpanel"
              id={`settings-panel-${activeSection}`}
              aria-labelledby={`settings-tab-${activeSection}`}
              tabIndex={0}
              className="flex-1 min-w-0 overflow-y-auto settings-scroll p-4 lg:p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
            >
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-ink">
                  {t(activeSectionMeta.labelKey, SETTINGS_SECTION_DEFAULT_LABELS[activeSectionMeta.id])}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {t(activeSectionMeta.descKey, '')}
                </p>
              </div>

              {/* Action feedback (auto-dismisses after 5s) */}
              {message && (
                <p
                  role={message.type === 'error' ? 'alert' : 'status'}
                  className={`mb-3 text-xs ${message.type === 'success' ? 'text-success' : 'text-danger'}`}
                >
                  {message.text}
                </p>
              )}

              {/* ── Display & Language ─────────────────────────────── */}
              {activeSection === 'display' && (
                <div className="space-y-5">
                  {/* Units + Theme + Time Format — stack on mobile */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* Units — custom dropdown with per-dimension toggles inside */}
                    {(() => {
                      const allMetric = unitPrefs.distance === 'metric' && unitPrefs.altitude === 'metric' && unitPrefs.temperature === 'metric' && unitPrefs.speed === 'kmh';
                      const allImperial = unitPrefs.distance === 'imperial' && unitPrefs.altitude === 'imperial' && unitPrefs.temperature === 'imperial' && unitPrefs.speed === 'mph';
                      const summaryLabel = allMetric
                        ? `${t('settings.metric')} (m, km/h)`
                        : allImperial
                          ? `${t('settings.imperial')} (ft, mph)`
                          : t('settings.mixed', 'Mixed');
                      const unitRows: { key: 'distance' | 'altitude' | 'temperature'; label: string; metricLabel: string; imperialLabel: string }[] = [
                        { key: 'distance', label: t('settings.unitDistance', 'Distance'), metricLabel: 'km', imperialLabel: 'mi' },
                        { key: 'altitude', label: t('settings.unitAltitude', 'Altitude'), metricLabel: 'm', imperialLabel: 'ft' },
                        { key: 'temperature', label: t('settings.unitTemperature', 'Temperature'), metricLabel: '°C', imperialLabel: '°F' },
                      ];
                      return (
                        <div className="flex flex-col gap-1 col-span-2 sm:col-span-1 relative">
                          <label id="settings-label-units" className="text-xs font-medium text-muted">{t('settings.units')}</label>
                          {/* Trigger button styled like Select */}
                          <button
                            type="button"
                            onClick={() => setUnitsDropdownOpen(v => !v)}
                            aria-labelledby="settings-label-units"
                            aria-haspopup="dialog"
                            aria-expanded={unitsDropdownOpen}
                            className={`flex items-center justify-between w-full h-[34px] px-2.5 rounded-lg border text-[13px] transition-colors bg-canvas border-line text-ink hover:border-line-strong`}
                          >
                            <span className="truncate">{summaryLabel}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 ml-1 opacity-50">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          {/* Dropdown popover */}
                          {unitsDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setUnitsDropdownOpen(false)} />
                              <div
                                className={`absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border shadow-xl overflow-hidden bg-elevated border-line`}
                              >
                                {/* Bulk set buttons */}
                                <div className={`flex gap-1 p-2 border-b border-line`}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      for (const k of ['distance', 'altitude', 'temperature'] as const) setUnitPref(k, 'metric');
                                      setUnitPref('speed', 'kmh');
                                    }}
                                    className={`flex-1 text-[11px] font-medium py-1 rounded-md transition-colors ${allMetric
                                      ? 'bg-accent text-accent-ink'
                                      : 'bg-surface text-muted hover:bg-line/60'
                                      }`}
                                  >{t('settings.allMetric', 'All Metric')}</button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      for (const k of ['distance', 'altitude', 'temperature'] as const) setUnitPref(k, 'imperial');
                                      setUnitPref('speed', 'mph');
                                    }}
                                    className={`flex-1 text-[11px] font-medium py-1 rounded-md transition-colors ${allImperial
                                      ? 'bg-accent text-accent-ink'
                                      : 'bg-surface text-muted hover:bg-line/60'
                                      }`}
                                  >{t('settings.allImperial', 'All Imperial')}</button>
                                </div>
                                {/* Per-dimension toggles */}
                                {unitRows.map(({ key, label, metricLabel, imperialLabel }) => (
                                  <div key={key} className={`flex items-center justify-between px-3 py-[6px] border-b last:border-b-0 border-line/60`}>
                                    <span className={`text-[11px] text-muted`}>{label}</span>
                                    <div className={`flex rounded-md overflow-hidden border border-line`}>
                                      <button
                                        type="button"
                                        onClick={() => setUnitPref(key, 'metric')}
                                        aria-pressed={unitPrefs[key] === 'metric'}
                                        className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${unitPrefs[key] === 'metric'
                                          ? 'bg-accent text-accent-ink'
                                          : 'bg-transparent text-muted hover:text-ink'
                                          }`}
                                      >{metricLabel}</button>
                                      <button
                                        type="button"
                                        onClick={() => setUnitPref(key, 'imperial')}
                                        aria-pressed={unitPrefs[key] === 'imperial'}
                                        className={`px-2 py-0.5 text-[10px] font-medium transition-colors border-l border-line ${unitPrefs[key] === 'imperial'
                                          ? 'bg-accent text-accent-ink'
                                          : 'bg-transparent text-muted hover:text-ink'
                                          }`}
                                      >{imperialLabel}</button>
                                    </div>
                                  </div>
                                ))}
                                <div className={`flex items-center justify-between px-3 py-[6px] border-line/60`}>
                                  <span className={`text-[11px] text-muted`}>{t('settings.unitSpeed', 'Speed')}</span>
                                  <div className={`flex rounded-md overflow-hidden border border-line`}>
                                    {([
                                      { key: 'kmh', label: 'km/h' },
                                      { key: 'mph', label: 'mph' },
                                      { key: 'ms', label: 'm/s' },
                                      { key: 'fts', label: 'ft/s' },
                                    ] as const).map((option, idx) => (
                                      <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setUnitPref('speed', option.key)}
                                        aria-pressed={unitPrefs.speed === option.key}
                                        className={`px-1.5 py-0.5 text-[10px] font-medium transition-colors ${idx > 0 ? 'border-l border-line' : ''} ${unitPrefs.speed === option.key
                                          ? 'bg-accent text-accent-ink'
                                          : 'bg-transparent text-muted hover:text-ink'
                                          }`}
                                      >{option.label}</button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex flex-col gap-1">
                      <label id="settings-label-theme" className="text-xs font-medium text-muted">
                        {t('settings.theme')}
                      </label>
                      <Select
                        value={themeMode}
                        onChange={(v) => setThemeMode(v as 'system' | 'dark' | 'light')}
                        ariaLabelledBy="settings-label-theme"
                        options={[
                          { value: 'system', label: t('settings.system') },
                          { value: 'dark', label: t('settings.dark') },
                          { value: 'light', label: t('settings.light') },
                        ]}
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <label id="settings-label-timeformat" className="text-xs font-medium text-muted flex items-center gap-1.5">
                        {t('settings.timeFormat', 'Time Format')}
                        {isTimeFormatPending && (
                          <svg className="w-3 h-3 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                          </svg>
                        )}
                      </label>
                      <Select
                        value={localTimeFormat}
                        onChange={(v) => {
                          const fmt = v as '12h' | '24h';
                          setLocalTimeFormat(fmt);
                          // Yield the paint thread first, then commit to store
                          setTimeout(() => {
                            startTimeFormatTransition(() => setTimeFormat(fmt));
                          }, 0);
                        }}
                        ariaLabelledBy="settings-label-timeformat"
                        options={[
                          { value: '12h', label: t('settings.timeFormat12h', '12-hour') },
                          { value: '24h', label: t('settings.timeFormat24h', '24-hour') },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Language + Number & Date Format — stack on mobile */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* App Language */}
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <label id="settings-label-language" className="text-xs font-medium text-muted">
                        {t('settings.language')}
                      </label>
                      <Select
                        value={appLanguage}
                        onChange={(v) => setAppLanguage(v)}
                        listMaxHeight="max-h-[230px]"
                        ariaLabelledBy="settings-label-language"
                        options={[
                          { value: 'de', label: 'Deutsch' },
                          { value: 'en', label: 'English' },
                          { value: 'es', label: 'Español' },
                          { value: 'fr', label: 'Français' },
                          { value: 'hu', label: 'Magyar' },
                          { value: 'it', label: 'Italiano' },
                          { value: 'nl', label: 'Nederlands' },
                          { value: 'pl', label: 'Polski' },
                          { value: 'pt', label: 'Português BR' },
                          { value: 'tr', label: 'Turkce' },
                          { value: 'zh', label: '中文' },
                          { value: 'ja', label: '日本語' },
                          { value: 'ko', label: '한국어' },
                        ]}
                      />
                    </div>
                    {/* Number Format */}
                    <div className="flex flex-col gap-1">
                      <label id="settings-label-numbers" className="text-xs font-medium text-muted">
                        {t('settings.numbers')}
                      </label>
                      <Select
                        value={locale}
                        onChange={(v) => setLocale(v)}
                        ariaLabelledBy="settings-label-numbers"
                        options={[
                          { value: 'en-GB', label: '1,234.56' },
                          { value: 'de-DE', label: '1.234,56' },
                          { value: 'fr-FR', label: '1 234,56' },
                        ]}
                      />
                    </div>
                    {/* Date Format */}
                    <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                      <label id="settings-label-dates" className="text-xs font-medium text-muted">
                        {t('settings.dates')}
                      </label>
                      <Select
                        value={dateLocale}
                        onChange={(v) => setDateLocale(v)}
                        ariaLabelledBy="settings-label-dates"
                        options={[
                          { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                          { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                          { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY' },
                          { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' },
                          { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                          { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD' },
                          { value: 'YYYY/M/D', label: 'YYYY/M/D' },
                          { value: 'YYYY. M. D.', label: 'YYYY. M. D.' },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Hide Serial Numbers */}
                  <div className="pt-4 border-t border-line">
                    <button
                      type="button"
                      onClick={() => setHideSerialNumbers(!hideSerialNumbers)}
                      className="flex items-center justify-between gap-3 w-full text-[0.85rem] text-ink"
                      role="switch"
                      aria-checked={hideSerialNumbers}
                    >
                      <span>{t('settings.hideSerials')}</span>
                      <span
                        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-all ${hideSerialNumbers
                          ? 'bg-accent/90 border-accent'
                          : 'bg-elevated border-line-strong toggle-track-off'
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-elevated shadow transition-transform ${hideSerialNumbers ? 'translate-x-4' : 'translate-x-1'
                            }`}
                        />
                      </span>
                    </button>
                    <p className="text-xs text-muted mt-1">
                      {t('settings.hideSerialDesc')}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Profile & Security ─────────────────────────────── */}
              {activeSection === 'profile' && (
                <div className="space-y-5">
                  {/* Profile Password */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-ink">
                        {t('settings.profilePassword')}
                      </span>
                      <span className="text-xs text-muted">
                        {profilePasswords[activeProfile]
                          ? t('settings.passwordEnabled')
                          : t('settings.passwordDisabled')}
                      </span>
                      {profilePasswords[activeProfile] && (
                        <svg className="w-3.5 h-3.5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>

                    {pwMessage && (
                      <div
                        role={pwMessage.type === 'error' ? 'alert' : 'status'}
                        className={`text-xs mb-2 ${pwMessage.type === 'error' ? 'text-danger' : 'text-success'}`}
                      >
                        {pwMessage.text}
                      </div>
                    )}

                    {profilePasswords[activeProfile] ? (
                      /* Profile has a password — change or remove */
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <PasswordInput
                            wrapperClassName="flex-1 min-w-0"
                            placeholder={t('settings.currentPassword')}
                            aria-label={t('settings.currentPassword')}
                            value={pwCurrent}
                            onChange={e => setPwCurrent(e.target.value)}
                            className="w-full px-3 py-1.5 bg-canvas border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-focus"
                          />
                          <button
                            type="button"
                            disabled={pwBusy || !pwCurrent}
                            onClick={async () => {
                              setPwBusy(true);
                              setPwMessage(null);
                              try {
                                await api.removeProfilePassword(activeProfile, pwCurrent);
                                setPwMessage({ type: 'success', text: t('settings.passwordRemoved') });
                                setPwCurrent(''); setPwNew(''); setPwConfirm('');
                                await loadProfiles();
                              } catch (err) {
                                setPwMessage({ type: 'error', text: String(err) });
                              } finally { setPwBusy(false); }
                            }}
                            className="py-1.5 px-3 rounded-lg border border-danger text-danger text-xs hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            {t('settings.removePassword')}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <PasswordInput
                            wrapperClassName="flex-1 min-w-0"
                            placeholder={t('settings.newPasswordOpt')}
                            aria-label={t('settings.newPasswordLabel')}
                            value={pwNew}
                            onChange={e => setPwNew(e.target.value)}
                            className="w-full px-3 py-1.5 bg-canvas border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-focus"
                          />
                          {pwNew && (
                            <PasswordInput
                              wrapperClassName="flex-1 min-w-0"
                              placeholder={t('settings.confirmPassword')}
                              aria-label={t('settings.confirmPassword')}
                              value={pwConfirm}
                              onChange={e => setPwConfirm(e.target.value)}
                              className="w-full px-3 py-1.5 bg-canvas border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-focus"
                            />
                          )}
                          {pwNew && (
                            <button
                              type="button"
                              disabled={pwBusy || !pwCurrent || !pwNew || pwNew.length < 4 || pwNew !== pwConfirm}
                              onClick={async () => {
                                setPwBusy(true);
                                setPwMessage(null);
                                try {
                                  await api.setProfilePassword(activeProfile, pwNew, pwCurrent);
                                  setPwMessage({ type: 'success', text: t('settings.passwordChanged') });
                                  setPwCurrent(''); setPwNew(''); setPwConfirm('');
                                } catch (err) {
                                  setPwMessage({ type: 'error', text: String(err) });
                                } finally { setPwBusy(false); }
                              }}
                              className="py-1.5 px-3 rounded-lg bg-accent text-accent-ink text-xs hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                            >
                              {t('settings.changePassword')}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Profile has no password — set one */
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <PasswordInput
                            wrapperClassName="flex-1 min-w-0"
                            placeholder={t('settings.newPasswordLabel')}
                            aria-label={t('settings.newPasswordLabel')}
                            value={pwNew}
                            onChange={e => setPwNew(e.target.value)}
                            className="w-full px-3 py-1.5 bg-canvas border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-focus"
                          />
                          <PasswordInput
                            wrapperClassName="flex-1 min-w-0"
                            placeholder={t('settings.confirmPassword')}
                            aria-label={t('settings.confirmPassword')}
                            value={pwConfirm}
                            onChange={e => setPwConfirm(e.target.value)}
                            className="w-full px-3 py-1.5 bg-canvas border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-focus"
                          />
                          <button
                            type="button"
                            disabled={pwBusy || !pwNew || pwNew.length < 4 || pwNew !== pwConfirm}
                            onClick={async () => {
                              setPwBusy(true);
                              setPwMessage(null);
                              try {
                                await api.setProfilePassword(activeProfile, pwNew);
                                setPwMessage({ type: 'success', text: t('settings.passwordSet') });
                                setPwNew(''); setPwConfirm('');
                                await loadProfiles();
                              } catch (err) {
                                setPwMessage({ type: 'error', text: String(err) });
                              } finally { setPwBusy(false); }
                            }}
                            className="py-1.5 px-3 rounded-lg bg-accent text-accent-ink text-xs hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            {t('settings.setPassword')}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Auto-logout toggle — Tauri desktop only, visible when profile has a password */}
                    {!isWebMode() && profilePasswords[activeProfile] && (
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-line">
                        <label className="text-xs font-medium text-ink cursor-pointer" htmlFor="auto-logout-toggle">
                          {t('settings.autoLogout')}
                        </label>
                        <button
                          id="auto-logout-toggle"
                          type="button"
                          role="switch"
                          aria-checked={autoLogout}
                          onClick={async () => {
                            const next = !autoLogout;
                            setAutoLogout(next);
                            try {
                              await api.setAutoLogout(next);
                            } catch {
                              setAutoLogout(!next); // revert on failure
                            }
                          }}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-canvas ${autoLogout ? 'bg-accent' : 'bg-line-strong'
                            }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-elevated shadow transform transition-transform duration-200 ${autoLogout ? 'translate-x-[18px]' : 'translate-x-[3px]'
                              }`}
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* API Key */}
                  <div className="pt-4 border-t border-line">
                    <span className="block text-sm font-medium text-ink mb-2">
                      {t('settings.djiApiKey')}
                    </span>
                    <p className="text-xs text-muted mb-3">
                      {t('settings.djiApiKeyDesc')}{' '}
                      <span className="text-accent font-medium">
                        {t('settings.thisGuide')}
                      </span>
                    </p>

                    {/* Status indicator */}
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-sm text-muted">
                        {hasKey ? t('settings.apiKeyConfigured') : t('settings.noApiKey')}
                      </span>
                      {apiKeyType === 'none' && (
                        <span className="api-key-badge api-key-badge-none inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm-.5 3v5h1V4h-1zm0 6v1h1v-1h-1z" /></svg>
                          {t('settings.invalid')}
                        </span>
                      )}
                      {apiKeyType === 'default' && (
                        <span className="api-key-badge api-key-badge-default inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" /></svg>
                          {t('settings.default')}
                        </span>
                      )}
                      {apiKeyType === 'personal' && canEditApiKey && (
                        <button
                          onClick={async () => {
                            try {
                              await api.removeApiKey();
                              await checkApiKey();
                              await loadApiKeyType(); // Update global store
                              setMessage({ type: 'success', text: t('settings.customApiKeyRemoved') });
                            } catch (err) {
                              setMessage({ type: 'error', text: `${t('settings.failedToRemoveKey')}: ${err}` });
                            }
                          }}
                          className="api-key-badge api-key-badge-personal group inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer transition-all duration-150 hover:api-key-badge-remove"
                          title={t('settings.apiKeyRemoveTitle')}
                          aria-label={t('settings.apiKeyRemoveTitle')}
                        >
                          <svg className="w-3 h-3 group-hover:hidden" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm3.354 4.646a.5.5 0 010 .708l-4 4a.5.5 0 01-.708 0l-2-2a.5.5 0 11.708-.708L7 9.293l3.646-3.647a.5.5 0 01.708 0z" /></svg>
                          <svg className="w-3 h-3 hidden group-hover:block" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm2.854 4.146a.5.5 0 010 .708L8.707 8l2.147 2.146a.5.5 0 01-.708.708L8 8.707l-2.146 2.147a.5.5 0 01-.708-.708L7.293 8 5.146 5.854a.5.5 0 11.708-.708L8 7.293l2.146-2.147a.5.5 0 01.708 0z" /></svg>
                          <span className="group-hover:hidden">{t('settings.personal')}</span>
                          <span className="hidden group-hover:inline">{t('settings.apiKeyRemove')}</span>
                        </button>
                      )}
                      {apiKeyType === 'personal' && !canEditApiKey && (
                        <span className="api-key-badge api-key-badge-personal inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm3.354 4.646a.5.5 0 010 .708l-4 4a.5.5 0 01-.708 0l-2-2a.5.5 0 11.708-.708L7 9.293l3.646-3.647a.5.5 0 01.708 0z" /></svg>
                          {t('settings.personal')}
                        </span>
                      )}
                    </div>

                    {canEditApiKey ? (
                      <div className="flex gap-2">
                        <PasswordInput
                          wrapperClassName="flex-1 min-w-0"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={hasKey ? '••••••••••••••••' : t('settings.enterYourApiKey')}
                          aria-label={t('settings.djiApiKey')}
                          className="w-full px-3 py-1.5 bg-canvas border border-line rounded-lg text-xs text-ink focus:outline-none focus:ring-1 focus:ring-focus"
                        />
                        <button
                          onClick={handleSave}
                          disabled={isSaving || !apiKey.trim()}
                          className="py-1.5 px-3 rounded-lg bg-accent text-accent-ink text-xs hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {isSaving ? t('settings.savingApiKey') : hasKey ? t('settings.updateApiKey') : t('settings.saveApiKey')}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                        <p className="text-xs font-medium text-warning">
                          {t('settings.apiKeyDefaultProfileOnlyTitle')}
                        </p>
                        <p className="mt-1 text-xs text-warning/85">
                          {t('settings.apiKeyDefaultProfileOnlyDesc', { profile: activeProfile })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tags ───────────────────────────────────────────── */}
              {activeSection === 'tags' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p id="settings-smarttags-title" className="text-sm font-medium text-ink">{t('settings.smartTags')}</p>
                      <p className="text-xs text-muted">{t('settings.smartTagsDesc')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSmartTagsEnabled(!smartTagsEnabled)}
                      className="flex-shrink-0"
                      role="switch"
                      aria-checked={smartTagsEnabled}
                      aria-labelledby="settings-smarttags-title"
                    >
                      <span
                        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-all ${smartTagsEnabled
                          ? 'bg-accent/90 border-accent'
                          : 'bg-elevated border-line-strong toggle-track-off'
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-elevated shadow transition-transform ${smartTagsEnabled ? 'translate-x-4' : 'translate-x-1'
                            }`}
                        />
                      </span>
                    </button>
                  </div>

                  {/* Smart Tag Types Selector */}
                  {smartTagsEnabled && (
                    <div>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsTagTypeDropdownOpen((v) => !v)}
                          aria-haspopup="listbox"
                          aria-expanded={isTagTypeDropdownOpen}
                          aria-label={t('settings.tagTypesToApply', 'Tag types to apply')}
                          className="w-full text-xs h-8 px-3 py-1.5 flex items-center justify-between gap-2 rounded-lg border border-line-strong bg-elevated hover:border-line-strong transition-colors"
                        >
                          <span className={`truncate ${enabledTagTypes.length < SMART_TAG_TYPES.length ? 'text-ink' : 'text-muted'}`}>
                            {enabledTagTypes.length === SMART_TAG_TYPES.length
                              ? t('settings.allTagTypes')
                              : enabledTagTypes.length === 0
                                ? t('settings.noneSelected')
                                : t('settings.tagTypesSelected', { count: enabledTagTypes.length, total: SMART_TAG_TYPES.length })}
                          </span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        {isTagTypeDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => { setIsTagTypeDropdownOpen(false); setTagTypeSearch(''); }}
                            />
                            <div
                              ref={tagTypeDropdownRef}
                              role="listbox"
                              aria-multiselectable="true"
                              aria-label={t('settings.tagTypesToApply', 'Tag types to apply')}
                              className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 rounded-lg border border-line bg-elevated shadow-xl flex flex-col overflow-hidden"
                            >
                              {/* Search input */}
                              <div className="px-2 pt-2 pb-1 border-b border-line flex-shrink-0">
                                <input
                                  type="text"
                                  value={tagTypeSearch}
                                  onChange={(e) => setTagTypeSearch(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setIsTagTypeDropdownOpen(false);
                                      setTagTypeSearch('');
                                    }
                                  }}
                                  placeholder={t('settings.searchTagTypes')}
                                  aria-label={t('settings.searchTagTypes')}
                                  autoFocus
                                  className="w-full bg-canvas text-xs text-ink rounded px-2 py-1 border border-line-strong focus:border-accent focus:outline-none placeholder:text-faint"
                                />
                              </div>
                              <div className="overflow-y-scroll flex-1">
                                {(() => {
                                  const filtered = SMART_TAG_TYPES.filter((t) =>
                                    t.label.toLowerCase().includes(tagTypeSearch.toLowerCase()) ||
                                    t.description.toLowerCase().includes(tagTypeSearch.toLowerCase())
                                  );
                                  if (filtered.length === 0) {
                                    return <p className="text-xs text-muted px-3 py-2">{t('settings.noMatchingTagTypes')}</p>;
                                  }
                                  // Sort: selected first, then unselected
                                  const sorted = [...filtered].sort((a, b) => {
                                    const aSelected = enabledTagTypes.includes(a.id);
                                    const bSelected = enabledTagTypes.includes(b.id);
                                    if (aSelected && !bSelected) return -1;
                                    if (!aSelected && bSelected) return 1;
                                    return 0;
                                  });
                                  return sorted.map((tagType) => {
                                    const isSelected = enabledTagTypes.includes(tagType.id);
                                    return (
                                      <button
                                        key={tagType.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                          const newTypes = isSelected
                                            ? enabledTagTypes.filter((t) => t !== tagType.id)
                                            : [...enabledTagTypes, tagType.id];
                                          setEnabledTagTypes(newTypes);
                                          setEnabledSmartTagTypes(newTypes);
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${isSelected
                                          ? 'bg-accent/15 text-accent'
                                          : 'text-ink hover:bg-line/40'
                                          }`}
                                      >
                                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-accent bg-accent' : 'border-line-strong'
                                          }`}>
                                          {isSelected && (
                                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                          )}
                                        </span>
                                        <span className="truncate">{tagType.label}</span>
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-stretch gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const msg = await regenerateSmartTags();
                        setMessage({ type: 'success', text: msg });
                      }}
                      disabled={isBusy}
                      className="flex-1 py-[7px] px-3 rounded-lg border border-line text-ink hover:bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t('settings.regenerateBtn')}
                      </span>
                    </button>

                    {/* Remove Auto Tags */}
                    {confirmRemoveAutoTags ? (
                      <div className="flex-1 rounded-lg border border-danger/60 bg-danger/10 p-2.5">
                        <p className="text-xs text-danger">
                          {t('settings.removeAutoTagsConfirm')}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            onClick={async () => {
                              try {
                                const msg = await removeAllAutoTags();
                                setMessage({ type: 'success', text: msg });
                              } catch (err) {
                                setMessage({ type: 'error', text: `Failed to remove auto tags: ${err}` });
                              }
                              setConfirmRemoveAutoTags(false);
                            }}
                            className="text-xs text-danger hover:text-danger/80"
                          >
                            {t('flightList.yes')}
                          </button>
                          <button
                            onClick={() => setConfirmRemoveAutoTags(false)}
                            className="text-xs text-muted hover:text-ink"
                          >
                            {t('flightList.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveAutoTags(true)}
                        disabled={isBusy}
                        className="flex-1 py-[7px] px-3 rounded-lg border border-danger text-danger hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {t('settings.removeBtn')}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Import & Sync ──────────────────────────────────── */}
              {activeSection === 'sync' && (
                <div className="space-y-5">
                  {/* Keep Uploaded Files - Only show in Tauri desktop mode */}
                  {!isWebMode() && keepUploadSettings && (
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const newEnabled = !keepUploadSettings.enabled;
                              const result = await setKeepUploadSettings(newEnabled, keepUploadSettings.folder_path);
                              if (result) setKeepUploadSettingsState(result);
                            } catch (e) {
                              const details = e instanceof Error ? e.message : String(e);
                              setMessage({
                                type: 'error',
                                text: t('settings.uploadFolderAccessDenied', { error: details }),
                              });
                            }
                          }}
                          className="flex items-center gap-3 text-[0.85rem] text-ink"
                          role="switch"
                          aria-checked={keepUploadSettings.enabled}
                        >
                          <span
                            className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-all ${keepUploadSettings.enabled
                              ? 'bg-accent/90 border-accent'
                              : 'bg-elevated border-line-strong toggle-track-off'
                              }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-elevated shadow transition-transform ${keepUploadSettings.enabled ? 'translate-x-4' : 'translate-x-1'
                                }`}
                            />
                          </span>
                          <span>{t('settings.keepUploadedFiles')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { open } = await import('@tauri-apps/plugin-dialog');
                              const selected = await open({
                                directory: true,
                                multiple: false,
                                title: 'Select folder for uploaded files',
                                defaultPath: keepUploadSettings.folder_path,
                              });
                              if (selected && typeof selected === 'string') {
                                try {
                                  const result = await setKeepUploadSettings(keepUploadSettings.enabled, selected);
                                  if (result) setKeepUploadSettingsState(result);
                                } catch (e) {
                                  const details = e instanceof Error ? e.message : String(e);
                                  setMessage({
                                    type: 'error',
                                    text: t('settings.uploadFolderAccessDenied', { error: details }),
                                  });
                                }
                              }
                            } catch (e) {
                              console.error('Failed to select folder:', e);
                            }
                          }}
                          disabled={!keepUploadSettings.enabled}
                          aria-label={t('settings.selectFolder', 'Select folder')}
                          className={`p-1.5 rounded transition-colors ${keepUploadSettings.enabled
                            ? 'text-muted hover:text-ink hover:bg-line/60'
                            : 'text-muted cursor-not-allowed'
                            }`}
                          title={t('settings.selectFolder', 'Select folder')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {t('settings.keepUploadedDesc')}
                      </p>
                      {keepUploadSettings.enabled && (
                        <p className="text-xs text-muted mt-1">
                          <strong className="text-muted">{t('settings.folder')}</strong>
                          <br />
                          <code className="text-xs text-muted bg-canvas px-1 py-0.5 rounded break-all">
                            {keepUploadSettings.folder_path}
                          </code>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Sync blacklist */}
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {t('settings.syncBlacklist', 'Sync blacklist')}
                    </p>
                    <p className="text-xs text-muted mt-0.5 mb-3">
                      {t('settings.blacklistManagerDescription')}
                    </p>
                    <button
                      onClick={openBlacklistModal}
                      disabled={isBusy}
                      className="w-full py-2 px-3 rounded-lg border border-warning/60 text-warning hover:bg-warning/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {t('settings.manageBlacklistedLogs', { count: blacklistCount })}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Data & Backup ──────────────────────────────────── */}
              {activeSection === 'data' && (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <button
                      onClick={handleBackup}
                      disabled={isBusy}
                      className="flex-1 py-2 px-3 rounded-lg border border-accent/60 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {isBackingUp ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                          </svg>
                          {t('settings.exporting')}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                          </svg>
                          {t('settings.backupDatabase')}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={handleRestore}
                      disabled={isBusy}
                      className="flex-1 py-2 px-3 rounded-lg border border-line text-ink hover:bg-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {isRestoring ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                          </svg>
                          {t('settings.restoring')}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 6l-4-4m0 0L8 6m4-4v13" />
                          </svg>
                          {t('settings.importBackup')}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="pt-4 border-t border-line">
                    {confirmDeleteAll ? (
                      <div className="rounded-lg border border-danger/60 bg-danger/10 p-3">
                        <p className="text-xs text-danger">
                          {t('settings.deleteAllWarning')}
                        </p>
                        <p className="text-xs text-success mt-1.5">
                          {t('settings.deleteAllPreserveNote')}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <button
                            onClick={handleDeleteAll}
                            className="text-xs text-danger hover:text-danger"
                          >
                            {t('flightList.yes')}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteAll(false)}
                            className="text-xs text-muted hover:text-ink"
                          >
                            {t('flightList.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteAll(true)}
                        disabled={isBusy}
                        className="w-full py-2 px-3 rounded-lg border border-danger text-danger hover:bg-danger/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('settings.deleteAllLogs')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── About ──────────────────────────────────────────── */}
              {activeSection === 'about' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="text-muted">{t('settings.appVersion')}</span>
                    <span className="text-ink font-mono">{appVersion || '…'}</span>
                  </div>
                  {!webMode && (
                    <div className="text-xs">
                      <span className="text-muted">{t('settings.logLocation')}</span>
                      <code className="block mt-1 text-xs text-muted bg-canvas px-2 py-1 rounded break-all">
                        {appLogDir || t('settings.loading')}
                      </code>
                    </div>
                  )}
                  <div className="pt-3 border-t border-line">
                    <p className="text-xs text-muted">
                      {t('about.attribution')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAboutOpen(true)}
                      className="mt-3 py-1.5 px-3 rounded-lg border border-line text-ink hover:bg-elevated transition-colors text-xs font-medium"
                    >
                      {t('settings.aboutLicensesSource', 'About, licenses & source')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer — legal/attribution entry point (About / Licenses / Source) */}
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-line">
            <span className="text-[11px] text-muted">
              {appVersion && <>v{appVersion} · </>}AGPL-3.0-only
            </span>
            <button
              type="button"
              onClick={() => setIsAboutOpen(true)}
              className="text-xs font-medium transition-colors text-accent hover:text-accent-hover"
            >
              {t('settings.aboutSkydra', 'About Skydra')}
            </button>
          </div>
        </>
      )}

      <AboutDialog isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {/* Manage Sync Blacklist dialog (nested inside the settings dialog panel) */}
      {isBlacklistModalOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center p-4 overflow-y-auto">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!isBlacklistScanning && !isClearingSelectedBlacklist) {
                setIsBlacklistModalOpen(false);
              }
            }}
          />
          <div
            ref={blacklistPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-blacklist-title"
            tabIndex={-1}
            className={`relative w-full max-w-3xl rounded-xl border shadow-2xl h-[min(88vh,760px)] max-h-[min(88vh,760px)] grid grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden my-auto bg-elevated border-line outline-none`}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b border-line`}>
              <div>
                <h3 id="settings-blacklist-title" className={`text-base font-semibold text-ink`}>
                  {t('settings.manageBlacklistedLogs', { count: blacklistCount })}
                </h3>
                <p className={`text-xs mt-0.5 text-muted`}>
                  {t('settings.blacklistManagerDescription')}
                </p>
                <p className={`text-xs mt-1 text-muted`}>
                  {t('settings.blacklistManagerFunctionality')}
                </p>
              </div>
              <button
                onClick={() => setIsBlacklistModalOpen(false)}
                disabled={isBlacklistScanning || isClearingSelectedBlacklist}
                aria-label={t('nav.close', 'Close')}
                className={`transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted hover:text-ink`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={`flex items-center justify-between px-4 py-2 border-b border-line bg-canvas/50`}>
              <div className="flex items-center gap-4 text-xs">
                <button
                  onClick={handleSelectAllBlacklist}
                  disabled={isBlacklistScanning || blacklistEntries.length === 0}
                  className={`text-accent hover:text-accent-hover disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {t('settings.selectAll')}
                </button>
                <button
                  onClick={handleDeselectAllBlacklist}
                  disabled={isBlacklistScanning || selectedBlacklistHashes.size === 0}
                  className={`text-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {t('settings.deselectAll')}
                </button>
              </div>
              <div className={`text-xs text-muted`}>
                {t('settings.blacklistSelectedCount', { count: selectedBlacklistHashes.size })}
              </div>
            </div>

            <div className={`settings-scroll min-h-0 overflow-y-auto p-3 bg-elevated`}>
              {isBlacklistScanning ? (
                <div className={`h-full min-h-[220px] flex flex-col items-center justify-center rounded-lg border border-line bg-canvas/50`}>
                  <svg className="w-8 h-8 text-accent animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  <p className={`mt-3 text-sm text-ink`}>
                    {t('settings.scanningSyncFolderForBlacklistedFiles')}
                  </p>
                </div>
              ) : sortedBlacklistEntries.length === 0 ? (
                <div className={`h-full min-h-[220px] flex items-center justify-center rounded-lg border text-sm border-line bg-canvas/50 text-muted`}>
                  {t('settings.noBlacklistedLogsFound')}
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedBlacklistEntries.map((entry) => {
                    const checked = selectedBlacklistHashes.has(entry.hash);
                    return (
                      <label
                        key={entry.hash}
                        className={`w-full rounded-lg border px-3 py-2.5 grid grid-cols-[auto_1fr] gap-3 cursor-pointer transition-colors ${checked ? 'border-accent/60 bg-accent/10' : 'border-line bg-elevated hover:bg-surface'}`}
                      >
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBlacklistSelection(entry.hash)}
                            className="w-4 h-4 accent-accent"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className={`text-xs px-1.5 py-0.5 rounded bg-canvas text-ink`}>
                              {shortenHash(entry.hash)}
                            </code>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${entry.isPresentInSyncFolder
                              ? 'bg-success/15 text-success border-success/30'
                              : 'bg-surface text-muted border-line'
                              }`}>
                              {entry.isPresentInSyncFolder ? t('settings.blacklistPresentInSyncFolder') : t('settings.blacklistNotPresentInSyncFolder')}
                            </span>
                          </div>
                          <div className={`mt-1 text-sm truncate text-ink`} title={entry.currentFilename ?? ''}>
                            {entry.currentFilename ?? t('settings.blacklistUnresolvedFilename')}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`px-4 py-3 border-t border-line bg-canvas/50`}>
              <button
                onClick={handleClearSelectedBlacklist}
                disabled={isBlacklistScanning || isClearingSelectedBlacklist || selectedBlacklistHashes.size === 0}
                className="w-full py-2 px-3 rounded-lg border border-warning/60 text-warning hover:bg-warning/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isClearingSelectedBlacklist ? t('settings.clearingSelectedLogs') : t('settings.clearSelectedFromBlacklist')}
              </button>
            </div>
          </div>
        </div>
      )}

    </Modal>
  );
}
