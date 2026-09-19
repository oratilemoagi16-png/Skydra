/**
 * Slim utility bar across the top of the app shell.
 * Carries product identity (left) and account-level controls (right):
 * profile selector and theme toggle. Destinations live in NavDock.
 */

import { useTranslation } from 'react-i18next';
import { LuMoon, LuSun } from 'react-icons/lu';
import { useFlightStore } from '@/stores/flightStore';
import { ProfileSelector } from '@/components/dashboard/ProfileSelector';
import wordmarkUrl from '../../assets/skydra-wordmark.png';

export function TopBar() {
  const { t } = useTranslation();
  const { themeMode, setThemeMode } = useFlightStore();

  const resolvedDark =
    themeMode === 'dark' ||
    (themeMode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    setThemeMode(resolvedDark ? 'light' : 'dark');
  };

  return (
    <header
      className="flex h-11 flex-shrink-0 items-center justify-between border-b border-line bg-surface px-3"
      style={{
        paddingLeft: 'calc(12px + var(--mobile-safe-left, 0px))',
        paddingRight: 'calc(12px + var(--mobile-safe-right, 0px))',
        paddingTop: 'var(--mobile-safe-top, 0px)',
        minHeight: 'calc(2.75rem + var(--mobile-safe-top, 0px))',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Wordmark asset is light-on-dark; keep it on a dark chip in both themes */}
        <span className="inline-flex items-center rounded-md bg-[#15161a] px-2.5 py-1">
          <img
            src={wordmarkUrl}
            alt="Skydra"
            className="h-[18px] w-auto"
            loading="lazy"
            decoding="async"
          />
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <ProfileSelector />
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          title={resolvedDark ? t('nav.themeToLight', 'Switch to light theme') : t('nav.themeToDark', 'Switch to dark theme')}
          aria-label={resolvedDark ? t('nav.themeToLight', 'Switch to light theme') : t('nav.themeToDark', 'Switch to dark theme')}
        >
          {resolvedDark ? <LuSun className="h-[18px] w-[18px]" /> : <LuMoon className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </header>
  );
}
