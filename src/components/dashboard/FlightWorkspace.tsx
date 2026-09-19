/**
 * FlightWorkspace — the Flights three-zone ops surface:
 *   header strip | [ dominant map + detail rail (Stats · Msgs · Weather · Notes) ]
 *   above a resizable telemetry band. One shared time cursor links map replay,
 *   chart axes and the scrubber (via the store's mapReplayProgress).
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FlightDataResponse } from '@/types';
import { useFlightStore } from '@/stores/flightStore';
import { FlightStats } from './FlightStats';
import { FlightMessagesPanel } from './FlightMessagesPanel';
import { WeatherPanel } from './WeatherPanel';
import { FlightNotesPanel } from './FlightNotesPanel';
import { TelemetryCharts } from '@/components/charts/TelemetryCharts';
import { FlightMap } from '@/components/map/FlightMap';
import { formatAltitude, formatDateTime, formatDistance, formatDuration, formatSpeed } from '@/lib/utils';

type RailTab = 'stats' | 'messages' | 'weather' | 'notes';

// Sized so the map column keeps ≥50% of the view at 1280px with the
// 340px flights rail alongside (1280 − 340 − 300 = 640).
const RAIL_WIDTH = 300;
const RAIL_COLLAPSED_WIDTH = 46;
const TELEMETRY_DEFAULT_HEIGHT = 300;
const TELEMETRY_MIN_HEIGHT = 140;
const TELEMETRY_MAX_RATIO = 0.72;

interface FlightWorkspaceProps {
  data: FlightDataResponse;
  /** True while the next flight's data is loading — keep this mounted, dimmed. */
  stale?: boolean;
  /** Mobile-only: reopen the flights list rail. */
  onBackToList?: () => void;
  isMobileViewport: boolean;
}

export function FlightWorkspace({ data, stale = false, onBackToList, isMobileViewport }: FlightWorkspaceProps) {
  const { t } = useTranslation();
  const { flight, telemetry } = data;

  const unitPrefs = useFlightStore((s) => s.unitPrefs);
  const locale = useFlightStore((s) => s.locale);
  const dateLocale = useFlightStore((s) => s.dateLocale);
  const appLanguage = useFlightStore((s) => s.appLanguage);
  const themeMode = useFlightStore((s) => s.themeMode);
  const timeFormat = useFlightStore((s) => s.timeFormat);
  const updateFlightName = useFlightStore((s) => s.updateFlightName);

  const [railTab, setRailTab] = useState<RailTab>('stats');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Telemetry band height + drag resize (desktop only)
  const [telemetryHeight, setTelemetryHeight] = useState(TELEMETRY_DEFAULT_HEIGHT);
  const [telemetryCollapsed, setTelemetryCollapsed] = useState(false);
  const prevTelemetryHeightRef = useRef(TELEMETRY_DEFAULT_HEIGHT);
  const dragStateRef = useRef<{ startY: number; startHeight: number; containerHeight: number } | null>(null);
  const topZoneRef = useRef<HTMLDivElement>(null);

  const messageCount = data.messages?.length ?? 0;
  const weatherAvailable = flight.homeLat != null && flight.homeLon != null && !!flight.startTime;

  // Reset per-flight rail state
  useEffect(() => {
    setRailTab('stats');
    setIsEditingName(false);
  }, [flight.id]);

  // 'skydra:rename-flight' — the shared actions menu delegates row-level
  // rename to the workspace header when opened from here (rail may be hidden).
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ flightId?: number }>).detail;
      if (detail?.flightId !== flight.id) return;
      setDraftName(flight.displayName || flight.fileName);
      setIsEditingName(true);
    };
    window.addEventListener('skydra:rename-flight', handler);
    return () => window.removeEventListener('skydra:rename-flight', handler);
  }, [flight.id, flight.displayName, flight.fileName]);

  useEffect(() => {
    if (isEditingName) nameInputRef.current?.select();
  }, [isEditingName]);

  const commitName = () => {
    const name = draftName.trim();
    if (name.length > 0 && name !== (flight.displayName || flight.fileName)) {
      updateFlightName(flight.id, name);
    }
    setIsEditingName(false);
  };

  // Telemetry band drag-resize (vertical)
  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const delta = drag.startY - event.clientY;
      const max = Math.max(TELEMETRY_MIN_HEIGHT, drag.containerHeight * TELEMETRY_MAX_RATIO);
      const next = Math.min(Math.max(drag.startHeight + delta, TELEMETRY_MIN_HEIGHT), max);
      setTelemetryHeight(next);
      setTelemetryCollapsed(false);
    };
    const handleUp = () => {
      dragStateRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  const startTelemetryDrag = (event: React.MouseEvent) => {
    const container = topZoneRef.current?.parentElement;
    dragStateRef.current = {
      startY: event.clientY,
      startHeight: telemetryCollapsed ? prevTelemetryHeightRef.current : telemetryHeight,
      containerHeight: container?.getBoundingClientRect().height ?? 800,
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    event.preventDefault();
  };

  const toggleTelemetry = () => {
    if (telemetryCollapsed) {
      setTelemetryCollapsed(false);
      setTelemetryHeight(prevTelemetryHeightRef.current);
    } else {
      prevTelemetryHeightRef.current = telemetryHeight;
      setTelemetryCollapsed(true);
    }
  };

  const openActionsMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Stop this click reaching the menu's document-level close listener.
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent('skydra:open-flight-actions', {
      detail: { flightId: flight.id, x: rect.left, y: rect.bottom + 4, trigger: event.currentTarget },
    }));
  };

  const tabs: { id: RailTab; label: string; icon: React.ReactNode; badge?: number; disabled?: boolean; title?: string }[] = [
    { id: 'stats', label: t('workspace.statsTab', 'Stats'), icon: <StatsIcon /> },
    { id: 'messages', label: t('dashboard.flightMessages'), icon: <ChatIcon />, badge: messageCount > 0 ? messageCount : undefined },
    { id: 'weather', label: t('weather.title'), icon: <WeatherTabIcon />, disabled: !weatherAvailable, title: !weatherAvailable ? t('weather.unavailable', 'No takeoff location or time') : undefined },
    { id: 'notes', label: t('flightList.notes', 'Notes'), icon: <NotesIcon />, badge: flight.notes ? 1 : undefined },
  ];

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const enabled = tabs.filter((tab) => !tab.disabled);
    const currentIdx = enabled.findIndex((tab) => tab.id === railTab);
    let nextIdx = currentIdx;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIdx = (currentIdx + 1) % enabled.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIdx = (currentIdx - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        nextIdx = 0;
        break;
      case 'End':
        nextIdx = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = enabled[nextIdx];
    if (next) {
      setRailTab(next.id);
      document.getElementById(`rail-tab-${next.id}`)?.focus();
    }
  };

  const header = (
    <header className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-11 border-b border-line bg-surface">
      {/* Mobile: back to the flight list */}
      {onBackToList && (
        <button
          type="button"
          onClick={onBackToList}
          className="p-1.5 -ml-1 rounded-lg text-muted hover:text-ink hover:bg-elevated transition-colors md:hidden"
          aria-label={t('nav.flights')}
          title={t('nav.flights')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Flight color chip */}
      <span
        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
        style={{ backgroundColor: flight.color ?? '#7dd3fc' }}
        aria-hidden="true"
      />

      {/* Name — double-click or the actions-menu Rename edits inline */}
      {isEditingName ? (
        <input
          ref={nameInputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitName(); }
            if (e.key === 'Escape') { e.preventDefault(); setIsEditingName(false); }
          }}
          className="input h-7 px-2 text-sm w-48 sm:w-64"
          aria-label={t('flightList.flightName')}
        />
      ) : (
        <h1
          className="text-sm font-semibold text-ink truncate min-w-0 max-w-[40%] sm:max-w-[30%] cursor-text"
          onDoubleClick={() => {
            setDraftName(flight.displayName || flight.fileName);
            setIsEditingName(true);
          }}
          title={flight.displayName || flight.fileName}
        >
          {flight.displayName || flight.fileName}
        </h1>
      )}

      {/* Mono scan metrics */}
      <div className="hidden sm:flex items-center gap-2 min-w-0 text-[11px] text-muted font-mono tabular-nums">
        <span className="truncate">{formatDateTime(flight.startTime, dateLocale, appLanguage, timeFormat === '24h' ? false : true)}</span>
        {!!flight.durationSecs && <span>· {formatDuration(flight.durationSecs)}</span>}
        {!!flight.totalDistance && <span>· {formatDistance(flight.totalDistance, unitPrefs.distance, locale)}</span>}
        {!!flight.maxAltitude && <span className="hidden lg:inline">· {formatAltitude(flight.maxAltitude, unitPrefs.altitude, locale)}</span>}
        {!!flight.maxSpeed && <span className="hidden lg:inline">· {formatSpeed(flight.maxSpeed, unitPrefs.speed, locale)}</span>}
      </div>

      <div className="flex-1" />

      {/* Messages shortcut — jumps to the rail's Messages tab */}
      {messageCount > 0 && (
        <button
          type="button"
          onClick={() => { setRailTab('messages'); setRailCollapsed(false); }}
          className="relative p-1.5 rounded-lg text-muted hover:text-ink hover:bg-elevated transition-colors"
          title={t('dashboard.viewFlightMessages')}
          aria-label={t('dashboard.viewFlightMessages')}
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
          </svg>
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold leading-none">
            {messageCount > 99 ? '99+' : messageCount}
          </span>
        </button>
      )}

      {/* Actions — the same menu as the list rows */}
      <button
        type="button"
        onClick={openActionsMenu}
        aria-haspopup="menu"
        aria-label={t('flightList.moreActions', 'More actions for {{name}}').replace('{{name}}', flight.displayName || flight.fileName)}
        title={t('flightList.moreActions', 'More actions for {{name}}').replace('{{name}}', flight.displayName || flight.fileName)}
        className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-elevated transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
    </header>
  );

  const railTabsBar = (
    <div
      role="tablist"
      aria-label={t('workspace.detailTabs', 'Flight details')}
      onKeyDown={onTabKeyDown}
      className={`flex items-stretch border-b border-line shrink-0 ${railCollapsed ? 'flex-col border-b-0' : ''}`}
    >
      {railCollapsed ? (
        <>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`rail-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={railTab === tab.id}
              aria-disabled={tab.disabled || undefined}
              aria-label={tab.label}
              tabIndex={railTab === tab.id ? 0 : -1}
              title={tab.title ?? tab.label}
              onClick={() => {
                if (tab.disabled) return;
                setRailTab(tab.id);
                setRailCollapsed(false);
              }}
              className={`relative p-2.5 transition-colors ${railTab === tab.id ? 'text-accent' : 'text-faint hover:text-muted'} ${tab.disabled ? 'opacity-40' : ''}`}
            >
              {tab.icon}
              {tab.badge !== undefined && (
                tab.badge > 1 ? (
                  <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 flex items-center justify-center rounded-full bg-danger text-white text-[9px] font-bold leading-none">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-warning" />
                )
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRailCollapsed(false)}
            className="p-2.5 text-faint hover:text-muted transition-colors"
            title={t('dashboard.expandPanel')}
            aria-label={t('dashboard.expandPanel')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </>
      ) : (
        <>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`rail-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={railTab === tab.id}
              aria-controls={`rail-tabpanel-${tab.id}`}
              aria-disabled={tab.disabled || undefined}
              aria-label={tab.label}
              tabIndex={railTab === tab.id ? 0 : -1}
              title={tab.title ?? tab.label}
              onClick={() => !tab.disabled && setRailTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 h-9 text-xs font-medium transition-colors border-b-2 -mb-px ${railTab === tab.id
                ? 'text-ink border-accent'
                : 'text-faint border-transparent hover:text-muted'
                } ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {tab.icon}
              <span className="hidden 2xl:inline">{tab.label}</span>
              {tab.badge !== undefined && (
                tab.badge > 1 ? (
                  <span className="min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold leading-none">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                )
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRailCollapsed(true)}
            className="px-2 text-faint hover:text-muted transition-colors hidden md:block"
            title={t('dashboard.collapsePanel')}
            aria-label={t('dashboard.collapsePanel')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );

  const railPanel = (
    <div
      id={`rail-tabpanel-${railTab}`}
      role="tabpanel"
      aria-labelledby={`rail-tab-${railTab}`}
      className="flex-1 min-h-0 overflow-y-auto"
    >
      {railTab === 'stats' && <FlightStats data={data} compact onOpenWeather={weatherAvailable ? () => setRailTab('weather') : undefined} />}
      {railTab === 'messages' && (
        <FlightMessagesPanel messages={data.messages ?? []} flightStartTime={flight.startTime ?? null} />
      )}
      {railTab === 'weather' && weatherAvailable && (
        <WeatherPanel
          lat={flight.homeLat!}
          lon={flight.homeLon!}
          startTime={flight.startTime!}
          temperatureUnit={unitPrefs.temperature}
          speedUnit={unitPrefs.speed}
        />
      )}
      {railTab === 'notes' && <FlightNotesPanel flightId={flight.id} notes={flight.notes ?? null} />}
      {/* Dock clearance: last panel row stays above the floating dock at scroll end */}
      <div className="shrink-0" style={{ height: 'calc(74px + var(--mobile-safe-bottom, 0px))' }} aria-hidden="true" />
    </div>
  );

  const mapSection = (
    <section
      aria-label={t('dashboard.flightPath')}
      className="relative flex-1 min-w-0 min-h-0"
    >
      <FlightMap
        track={data.track}
        homeLat={flight.homeLat}
        homeLon={flight.homeLon}
        durationSecs={flight.durationSecs}
        telemetry={telemetry}
        themeMode={themeMode}
        messages={data.messages}
      />
    </section>
  );

  const telemetryBand = (
    <section
      aria-label={t('dashboard.telemetryData')}
      className="relative shrink-0 border-t border-line bg-surface flex flex-col"
      style={isMobileViewport ? undefined : { height: telemetryCollapsed ? 36 : telemetryHeight }}
    >
      <div className="h-9 shrink-0 flex items-center gap-2 px-3 border-b border-line/60">
        {/* Drag handle hit-area (desktop) */}
        {!isMobileViewport && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('dashboard.dragToResize')}
            title={t('dashboard.dragToResize')}
            onMouseDown={startTelemetryDrag}
            className="absolute left-0 right-0 -top-1 h-2.5 cursor-row-resize group"
          >
            <div className="mx-auto mt-1 h-1 w-10 rounded-full bg-line group-hover:bg-accent transition-colors" />
          </div>
        )}
        <h2 className="text-xs font-semibold text-ink">{t('dashboard.telemetryData')}</h2>
        <div className="flex-1" />
        {!isMobileViewport && (
          <button
            type="button"
            onClick={toggleTelemetry}
            className="p-1 rounded text-faint hover:text-ink hover:bg-elevated transition-colors"
            title={telemetryCollapsed ? t('dashboard.expandPanel') : t('dashboard.collapsePanel')}
            aria-label={telemetryCollapsed ? t('dashboard.expandPanel') : t('dashboard.collapsePanel')}
            aria-expanded={!telemetryCollapsed}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${telemetryCollapsed ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
      <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-auto ${isMobileViewport ? 'min-h-[420px]' : ''} ${telemetryCollapsed ? 'hidden' : ''}`}>
        <div className="min-w-[560px] p-2 h-full">
          <TelemetryCharts
            data={telemetry}
            unitPrefs={unitPrefs}
            startTime={flight.startTime}
          />
        </div>
        {/* Dock clearance: last chart's axis/legend clears the floating dock at scroll end */}
        <div className="shrink-0" style={{ height: 'calc(74px + var(--mobile-safe-bottom, 0px))' }} aria-hidden="true" />
      </div>
    </section>
  );

  if (isMobileViewport) {
    // Mobile: stacked zones — header top strip, map, detail tabs, telemetry
    return (
      <div
        className={`flex flex-col h-full overflow-y-auto bg-canvas transition-opacity duration-200 ${stale ? 'opacity-60 pointer-events-none' : ''}`}
        aria-busy={stale || undefined}
      >
        {header}
        <div className="h-[44dvh] min-h-[260px] shrink-0 border-b border-line">
          {mapSection}
        </div>
        <div className="shrink-0 bg-surface">
          {railTabsBar}
          <div className="min-h-[200px]">{railPanel}</div>
        </div>
        {telemetryBand}
        {/* Dock clearance for the stacked scroll column */}
        <div className="shrink-0" style={{ height: 'calc(74px + var(--mobile-safe-bottom, 0px))' }} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full min-h-0 bg-canvas transition-opacity duration-200 ${stale ? 'opacity-60' : ''}`}
      aria-busy={stale || undefined}
    >
      {header}
      {/* Top zone: dominant map + detail rail */}
      <div ref={topZoneRef} className="flex-1 min-h-0 flex">
        {mapSection}
        <aside
          aria-label={t('workspace.detailTabs', 'Flight details')}
          className="shrink-0 border-l border-line bg-surface flex flex-col transition-[width] duration-200"
          style={{ width: railCollapsed ? RAIL_COLLAPSED_WIDTH : RAIL_WIDTH }}
        >
          {railTabsBar}
          {!railCollapsed && railPanel}
        </aside>
      </div>
      {/* Bottom zone: telemetry band */}
      {telemetryBand}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────

function StatsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
    </svg>
  );
}

function WeatherTabIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
