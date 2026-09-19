/**
 * Primary navigation dock — floating bottom bar.
 *
 * Overview | Flights | centered Import action | Settings
 *
 * Import is an action (opens the import sheet), not a destination, and does
 * not participate in the roving view state. Keyboard: ArrowLeft/Right/Home/End
 * move focus between all four controls (roving tabindex); Enter/Space activate.
 */

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuGauge, LuWaypoints, LuImport, LuSettings } from 'react-icons/lu';
import { cn } from '@/lib/cn';

export type DockView = 'overview' | 'flights';

interface NavDockProps {
  view: DockView;
  /** Import/sync currently running — Import button shows a busy spinner. */
  importBusy: boolean;
  onNavigate: (view: DockView) => void;
  onImport: () => void;
  onSettings: () => void;
}

const DOCK_ITEMS: { view: DockView; labelKey: string; icon: typeof LuGauge }[] = [
  { view: 'overview', labelKey: 'nav.overview', icon: LuGauge },
  { view: 'flights', labelKey: 'nav.flights', icon: LuWaypoints },
];

function DockItem({
  icon: Icon,
  label,
  active,
  tabIndex,
  onClick,
  itemRef,
}: {
  icon: typeof LuGauge;
  label: string;
  active: boolean;
  tabIndex: number;
  onClick: () => void;
  itemRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={itemRef}
      tabIndex={tabIndex}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        active ? 'text-accent' : 'text-muted hover:text-ink'
      )}
    >
      <span
        className={cn(
          'flex h-6 w-10 items-center justify-center rounded-md transition-colors',
          active && 'bg-accent/15'
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
      </span>
      <span className="text-[10px] font-medium leading-none tracking-wide">{label}</span>
    </button>
  );
}

export function NavDock({ view, importBusy, onNavigate, onImport, onSettings }: NavDockProps) {
  const { t } = useTranslation();
  // Roving tabindex: the element matching `focusIndex` is the tab stop.
  const [focusIndex, setFocusIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focusable order: Overview, Flights, Import, Settings
  const ITEM_COUNT = 4;
  const moveFocus = (next: number) => {
    const idx = ((next % ITEM_COUNT) + ITEM_COUNT) % ITEM_COUNT;
    setFocusIndex(idx);
    itemRefs.current[idx]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(focusIndex + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(focusIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveFocus(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus(ITEM_COUNT - 1);
    }
  };

  const setRef = (i: number) => (el: HTMLButtonElement | null) => {
    itemRefs.current[i] = el;
  };

  return (
    <nav
      aria-label={t('nav.primary', 'Primary')}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] flex justify-center"
      style={{ paddingBottom: 'calc(10px + var(--mobile-safe-bottom, 0px))' }}
      onKeyDown={onKeyDown}
    >
      <div className="pointer-events-auto flex items-end gap-1 rounded-[var(--skydra-radius-lg)] border border-line bg-elevated/95 px-2 py-1.5 shadow-dock backdrop-blur-sm">
        <DockItem
          icon={DOCK_ITEMS[0].icon}
          label={t(DOCK_ITEMS[0].labelKey)}
          active={view === 'overview'}
          tabIndex={focusIndex === 0 ? 0 : -1}
          onClick={() => onNavigate('overview')}
          itemRef={setRef(0)}
        />
        <DockItem
          icon={DOCK_ITEMS[1].icon}
          label={t(DOCK_ITEMS[1].labelKey)}
          active={view === 'flights'}
          tabIndex={focusIndex === 1 ? 0 : -1}
          onClick={() => onNavigate('flights')}
          itemRef={setRef(1)}
        />

        {/* Centered Import action — raised accent square */}
        <div className="flex min-w-[64px] flex-col items-center justify-end gap-0.5 px-1 pb-0.5">
          <button
            type="button"
            ref={setRef(2)}
            tabIndex={focusIndex === 2 ? 0 : -1}
            onClick={onImport}
            aria-label={t('nav.import')}
            title={t('nav.import')}
            className={cn(
              '-mt-4 flex h-11 w-11 items-center justify-center rounded-[10px] border border-line-strong/60 bg-accent text-accent-ink shadow-dock transition-transform',
              'hover:bg-accent-hover active:scale-[0.97]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-elevated'
            )}
          >
            {importBusy ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <LuImport className="h-5 w-5" strokeWidth={2} />
            )}
          </button>
          <span
            className={cn(
              'text-[10px] font-medium leading-none tracking-wide',
              importBusy ? 'text-accent' : 'text-muted'
            )}
          >
            {t('nav.import')}
          </span>
        </div>

        <DockItem
          icon={LuSettings}
          label={t('nav.settings')}
          active={false}
          tabIndex={focusIndex === 3 ? 0 : -1}
          onClick={onSettings}
          itemRef={setRef(3)}
        />
      </div>
    </nav>
  );
}
