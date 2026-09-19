/**
 * Main Dashboard layout component
 * Orchestrates the flight list sidebar, charts, and map
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlightStore } from '@/stores/flightStore';
import { FlightList } from './FlightList';
import { FlightStats } from './FlightStats';
import { SettingsModal } from './SettingsModal';
import { TelemetryCharts } from '@/components/charts/TelemetryCharts';
import { FlightMap } from '@/components/map/FlightMap';
import { FlightMessagesModal } from './FlightMessagesModal';
import { Overview } from './Overview';
import { NavDock, type DockView } from '@/components/shell/NavDock';
import { TopBar } from '@/components/shell/TopBar';
import { ImportSheet } from '@/components/shell/ImportSheet';

export function Dashboard() {
  const {
    currentFlightData,
    overviewStats,
    isLoading,
    flights,
    isFlightsInitialized,
    selectedFlightId,
    unitPrefs,
    themeMode,
    loadOverview,
    isImporting,
    isBatchProcessing,
  } = useFlightStore();
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [activeView, setActiveView] = useState<DockView>('overview');
  const [topSidebarFlightId, setTopSidebarFlightId] = useState<number | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('sidebarWidth');
      if (stored) {
        const parsed = Number(stored);
        if (parsed >= 340 && parsed <= 420) return parsed;
      }
    }
    return 340;
  });
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('filtersCollapsed');
      if (stored !== null) return stored === 'true';
    }
    return true;
  });
  const [mainSplit, setMainSplit] = useState(50);
  const [mainPanelsWidth, setMainPanelsWidth] = useState(0);
  // Track if telemetry panel is collapsed (slider pulled past minimum width)
  const [isTelemetryCollapsed, setIsTelemetryCollapsed] = useState(false);
  const [preCollapseSplit, setPreCollapseSplit] = useState<number | null>(null);
  const [isImporterExternallyBusy, setIsImporterExternallyBusy] = useState(false);
  // Width of telemetry panel when collapsed (minimum visible width)
  const TELEMETRY_MIN_VISIBLE_WIDTH = 40;
  const TELEMETRY_MIN_NORMAL_WIDTH = 560;
  const TELEMETRY_SCROLL_MIN_WIDTH = 560;
  const TELEMETRY_CARD_MIN_WIDTH = 520;
  const MAP_MIN_WIDTH = 320;
  const MAP_STACK_TRIGGER_WIDTH = 420;
  const SIDE_BY_SIDE_MIN_WIDTH = TELEMETRY_MIN_NORMAL_WIDTH + MAP_STACK_TRIGGER_WIDTH + 48;
  const resizingRef = useRef<null | 'sidebar' | 'main'>(null);
  // First-run affordance: with no flights yet, open the import sheet once.
  const autoImportShownRef = useRef(false);
  useEffect(() => {
    if (isFlightsInitialized && flights.length === 0 && !autoImportShownRef.current) {
      autoImportShownRef.current = true;
      setShowImport(true);
    }
  }, [isFlightsInitialized, flights.length]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sidebarWidth', String(sidebarWidth));
    }
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (resizingRef.current === 'sidebar') {
        const nextWidth = Math.min(Math.max(event.clientX, 340), 420);
        setSidebarWidth(nextWidth);
      }
      if (resizingRef.current === 'main') {
        const container = document.getElementById('main-panels');
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const percentage = ((event.clientX - rect.left) / rect.width) * 100;
        const minLeftPercent = (TELEMETRY_MIN_VISIBLE_WIDTH / rect.width) * 100;
        const maxLeftPercent = 100 - (MAP_MIN_WIDTH / rect.width) * 100;

        // Calculate the actual pixel width the telemetry panel would be
        const telemetryPixelWidth = (percentage / 100) * rect.width;

        // If dragging below normal minimum, collapse the telemetry panel
        if (telemetryPixelWidth < TELEMETRY_MIN_NORMAL_WIDTH) {
          setIsTelemetryCollapsed(true);
        } else {
          setIsTelemetryCollapsed(false);
        }

        setMainSplit(
          Math.min(Math.max(percentage, minLeftPercent), maxLeftPercent)
        );
      }
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const container = document.getElementById('main-panels');
    if (!container) {
      setMainPanelsWidth(0);
      return;
    }

    const updateWidth = () => {
      const host = container.parentElement;
      const availableWidth = host
        ? host.getBoundingClientRect().width
        : container.getBoundingClientRect().width;
      setMainPanelsWidth(availableWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(container);

    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [activeView, currentFlightData?.flight.id, isSidebarHidden, sidebarWidth]);

  const isDesktopLayout = typeof window !== 'undefined' && window.innerWidth >= 768;
  const shouldStackPanels = isDesktopLayout && mainPanelsWidth > 0
    ? mainPanelsWidth < SIDE_BY_SIDE_MIN_WIDTH
    : !isDesktopLayout;
  const splitCardsViewportHeight = isDesktopLayout && !shouldStackPanels
    ? 'calc(100dvh - 200px)'
    : undefined;

  // Apply theme class on mount and listen for system preference changes.
  // The store's setThemeMode already applies classes synchronously for instant switching;
  // this effect only handles initial mount + OS-level dark/light changes.
  useEffect(() => {
    const applyTheme = (mode: 'system' | 'dark' | 'light') => {
      const prefersDark =
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : true;
      const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
      document.body.classList.remove('theme-dark', 'theme-light');
      document.body.classList.add(resolved === 'dark' ? 'theme-dark' : 'theme-light');
    };

    // Ensure correct class on initial mount
    applyTheme(themeMode);

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
        // Only react to OS changes when in 'system' mode
        const current = useFlightStore.getState().themeMode;
        if (current === 'system') applyTheme('system');
      };
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }
    return undefined;
  }, []);  // Run once on mount — store setter handles subsequent changes synchronously

  useEffect(() => {
    const handleImporterBusyChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ busy?: boolean }>;
      setIsImporterExternallyBusy(Boolean(customEvent.detail?.busy));
    };
    window.addEventListener('importerBusyStateChanged', handleImporterBusyChange as EventListener);
    return () => {
      window.removeEventListener('importerBusyStateChanged', handleImporterBusyChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleFiltersCollapsedChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ collapsed?: boolean }>;
      if (typeof customEvent.detail?.collapsed === 'boolean') {
        setIsFiltersCollapsed(customEvent.detail.collapsed);
      }
    };

    window.addEventListener('sidebarFiltersCollapsedChanged', handleFiltersCollapsedChange as EventListener);
    return () => {
      window.removeEventListener('sidebarFiltersCollapsedChanged', handleFiltersCollapsedChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (activeView === 'overview') {
      loadOverview();
    }
  }, [activeView, loadOverview]);

  const isImporterBusy = isImporting || isBatchProcessing || isImporterExternallyBusy;
  const sidebarMinHeight = 620
    + (!isFiltersCollapsed ? 180 : 0);
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  // Rail stays mounted in Overview so FlightList keeps reporting the top flight
  // (used to auto-select on first navigation); it collapses out of layout.
  const railHidden = isSidebarHidden || activeView === 'overview';

  const goToView = (view: DockView) => {
    if (view === 'flights') {
      const alreadyFlights = activeView === 'flights';
      if (activeView === 'overview' && selectedFlightId === null && topSidebarFlightId !== null) {
        useFlightStore.getState().selectFlight(topSidebarFlightId);
      }
      setActiveView('flights');
      // Clear highlighted flight when switching to flights view
      useFlightStore.getState().setOverviewHighlightedFlightId(null);
      if (isMobileViewport) {
        if (alreadyFlights) {
          // In the flights view, the dock item reopens the list rail
          setIsSidebarHidden(false);
        } else {
          // Entering flights: land on the list when nothing is selected,
          // otherwise go straight to the selected flight's workspace
          setIsSidebarHidden(useFlightStore.getState().selectedFlightId !== null);
        }
      }
    } else {
      setActiveView('overview');
    }
  };

  return (
    <div className={`flex h-full flex-col ${showSettings ? 'modal-open' : ''}`}>
      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Import sheet — importer stays mounted; opens from the dock action */}
      <ImportSheet open={showImport} onClose={() => setShowImport(false)} />

      {/* Utility bar: wordmark, profile selector, theme toggle */}
      <TopBar />

      <div
        className="relative flex min-h-0 flex-1"
        style={{ paddingBottom: 'calc(74px + var(--mobile-safe-bottom, 0px))' }}
      >
      {/* Flight list rail — the Flights workspace's browse surface.
          Mounted in both views so FlightList reports the top flight;
          collapses out of layout when hidden or when in Overview. */}
      <aside
        className={`bg-surface md:border-r border-line flex flex-col z-40 fixed inset-0 md:relative md:inset-auto mobile-safe-container h-full overflow-y-auto overflow-x-hidden transition-[width,min-width,opacity,transform] duration-300 ease-in-out ${railHidden ? 'opacity-0 pointer-events-none md:overflow-hidden' : 'opacity-100'
          }`}
        style={{
          // In desktop layout, avoid safe-area padding so width:0 truly collapses.
          paddingTop: isDesktopLayout ? 0 : undefined,
          paddingRight: isDesktopLayout ? 0 : undefined,
          paddingBottom: isDesktopLayout ? 0 : undefined,
          paddingLeft: isDesktopLayout ? 0 : undefined,
          width: typeof window !== 'undefined' && window.innerWidth < 768
            ? '100%'
            : (railHidden ? 0 : sidebarWidth),
          minWidth: typeof window !== 'undefined' && window.innerWidth < 768
            ? '100%'
            : (railHidden ? 0 : 340),
          transform: railHidden
            ? (typeof window !== 'undefined' && window.innerWidth < 768
              ? 'translateX(-100%)'
              : `translateX(-${sidebarWidth}px)`)
            : 'translateX(0)',
        }}
      >
          <div className={`flex h-full flex-col md:transition-opacity md:duration-150 ${railHidden ? 'md:opacity-0' : 'md:opacity-100'}`} style={{ minHeight: sidebarMinHeight }}>
          {/* Rail header */}
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t('nav.flights')}</h2>
            <button
              onClick={() => setIsSidebarHidden(true)}
              className="ml-1 bg-elevated border border-line rounded-full w-6 h-6 items-center justify-center text-muted hover:text-ink hidden md:flex"
              title={t('dashboard.hideSidebar')}
            >
              <span className="leading-none pb-[2px] text-lg">‹</span>
            </button>
          </div>

          {/* Flight List */}
          <div className="flex-1 min-h-0 flex flex-col pb-[76px] md:pb-0">
            <FlightList
              activeView={activeView}
              onTopFlightChange={setTopSidebarFlightId}
              onSelectFlight={(flightId) => {
                // Clear the overview highlight when navigating to a flight
                useFlightStore.getState().setOverviewHighlightedFlightId(null);
                setActiveView('flights');
                useFlightStore.getState().selectFlight(flightId);
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setIsSidebarHidden(true);
                }
              }}
              onHighlightFlight={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setIsSidebarHidden(true);
                }
              }}
            />
          </div>

          {/* Flight Count */}
          <div className="p-3 mb-[72px] md:mb-0 border-t border-line flex items-center justify-center gap-3">
            <span className="text-xs text-muted">
              {t('dashboard.flightsImported', { count: flights.length })}
            </span>

          </div>

          {/* Mobile close + settings buttons for sidebar */}
          <div className="absolute right-4 mobile-safe-fixed-top flex items-center gap-2 z-50 md:hidden">
            <button
              onClick={() => setIsSidebarHidden(true)}
              className="sidebar-mobile-btn border rounded-lg p-2 transition-colors"
              title={t('dashboard.hideSidebar')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div
            onMouseDown={() => {
              resizingRef.current = 'sidebar';
            }}
            className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-transparent hidden md:block"
          />
          </div>
        </aside>

      {activeView === 'flights' && (
        <aside
          className={`bg-surface border-r border-line items-start justify-center relative z-40 overflow-visible hidden md:flex md:transition-[width,min-width,opacity] md:duration-250 md:ease-in-out ${isSidebarHidden ? 'md:opacity-100 md:pointer-events-auto' : 'md:opacity-0 md:pointer-events-none'
            }`}
          style={{ width: isSidebarHidden ? '1.8rem' : 0, minWidth: isSidebarHidden ? '1.8rem' : 0 }}
        >
          <button
            onClick={() => setIsSidebarHidden(false)}
            className="sidebar-collapsed-toggle-btn relative z-50 mt-4 translate-x-1/2 border border-line rounded-full w-[4rem] h-[3rem] text-lg leading-none flex items-center justify-center"
            title={t('dashboard.showSidebar')}
          >
            ›
          </button>
        </aside>
      )}

      {/* Main Content */}
      <main
        className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
        onClick={() => {
          // Clear overview highlight when clicking outside the flight list
          if (activeView === 'overview') {
            useFlightStore.getState().setOverviewHighlightedFlightId(null);
          }
        }}
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-12 h-12 rounded-full spinner"
                style={{ border: '4px solid rgb(var(--skydra-accent))', borderTopColor: 'transparent' }}
              />
              <p className="text-sm text-muted">{t('dashboard.loadingFlightData')}</p>
            </div>
          </div>
        ) : activeView === 'overview' ? (
          <div className="w-full h-full overflow-auto">
            {overviewStats ? (
              <Overview
                stats={overviewStats}
                flights={flights}
                unitPrefs={unitPrefs}
                onSelectFlight={(flightId) => {
                  setActiveView('flights');
                  useFlightStore.getState().selectFlight(flightId);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setIsSidebarHidden(true);
                  }
                }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-gray-500">{t('dashboard.noOverviewData')}</p>
              </div>
            )}
          </div>
        ) : currentFlightData ? (
          <>
              <div className="w-full h-full min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="w-full min-h-full md:min-h-[780px] flex flex-col">
                {/* Stats Bar */}
                <FlightStats data={currentFlightData} />

                {/* Charts and Map Grid */}
                <div id="main-panels" className={`${shouldStackPanels ? 'flex-none' : 'flex-1'} md:min-h-[620px] flex flex-col ${shouldStackPanels ? '' : 'md:flex-row'} gap-4 p-4 overflow-visible ${shouldStackPanels ? '' : 'md:overflow-hidden'}`}>
                  {/* Telemetry Charts - when collapsed, content clips instead of squeezing */}
                  <div
                    className={`card flex flex-col min-h-[400px] md:min-h-[520px] relative ${isTelemetryCollapsed ? 'overflow-hidden' : 'overflow-hidden'}`}
                    style={{
                      flexBasis: isDesktopLayout && !shouldStackPanels ? `${mainSplit}%` : 'auto',
                      flexGrow: isDesktopLayout && !shouldStackPanels ? 0 : 1,
                      minWidth: isDesktopLayout && !shouldStackPanels ? (isTelemetryCollapsed ? TELEMETRY_MIN_VISIBLE_WIDTH : TELEMETRY_CARD_MIN_WIDTH) : '100%',
                      flexShrink: 0,
                      height: splitCardsViewportHeight,
                      maxHeight: splitCardsViewportHeight ?? '720px',
                    }}
                  >
                    <div className={`border-b border-gray-700 flex items-center ${isTelemetryCollapsed ? 'justify-center p-2' : 'justify-between p-3'}`}>
                      {!isTelemetryCollapsed && (
                        <div className="flex items-center gap-2">
                          <h2 className="font-semibold text-white">
                            {t('dashboard.telemetryData')}
                          </h2>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const container = document.getElementById('main-panels');
                          if (!container) return;
                          const rect = container.getBoundingClientRect();

                          if (!isTelemetryCollapsed) {
                            // Collapse it
                            setPreCollapseSplit(mainSplit);
                            setIsTelemetryCollapsed(true);
                            // Set to minimum visible width percentage
                            const minLeftPercent = (TELEMETRY_MIN_VISIBLE_WIDTH / rect.width) * 100;
                            setMainSplit(minLeftPercent);
                          } else {
                            // Expand it
                            setIsTelemetryCollapsed(false);
                            // Restore previous split or default to 50%
                            const minNormalPercent = (TELEMETRY_MIN_NORMAL_WIDTH / rect.width) * 100;
                            if (preCollapseSplit !== null && preCollapseSplit > minNormalPercent) {
                              setMainSplit(preCollapseSplit);
                            } else {
                              setMainSplit(50);
                            }
                          }
                        }}
                        className={`rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors ${isTelemetryCollapsed ? 'p-1' : 'p-1.5'}`}
                        title={isTelemetryCollapsed ? t('dashboard.expandPanel') : t('dashboard.collapsePanel')}
                        aria-label={isTelemetryCollapsed ? t('dashboard.expandPanel') : t('dashboard.collapsePanel')}
                      >
                        <svg
                          className={`transition-transform duration-200 ${isTelemetryCollapsed ? 'w-4 h-4' : 'w-5 h-5'} ${isTelemetryCollapsed ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                    {/* Inner container that maintains minimum width for content */}
                    <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto p-2">
                      <div
                        className="min-h-full"
                        style={{
                          minWidth: isDesktopLayout && !shouldStackPanels ? TELEMETRY_MIN_NORMAL_WIDTH : `${TELEMETRY_SCROLL_MIN_WIDTH}px`,
                          width: isDesktopLayout && !shouldStackPanels ? (isTelemetryCollapsed ? TELEMETRY_MIN_NORMAL_WIDTH : '100%') : '100%',
                        }}
                      >
                        <TelemetryCharts
                          data={currentFlightData!.telemetry}
                          unitPrefs={unitPrefs}
                          startTime={currentFlightData!.flight.startTime}
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    onMouseDown={() => {
                      resizingRef.current = 'main';
                    }}
                    className={`${shouldStackPanels ? 'hidden' : 'block'} w-2 shrink-0 self-stretch cursor-col-resize bg-gray-500/50 rounded hover:bg-drone-primary/80 transition-colors`}
                    title={t('dashboard.dragToResize')}
                  />

                  {/* Flight Map */}
                  <div
                    className={`card flex flex-col ${isDesktopLayout && !shouldStackPanels ? '' : 'h-[648px]'} md:min-h-[520px] overflow-hidden`}
                    style={{
                      flexBasis: isDesktopLayout && !shouldStackPanels ? 'auto' : 'auto',
                      flexGrow: isDesktopLayout && !shouldStackPanels ? 1 : 0,
                      minWidth: isDesktopLayout && !shouldStackPanels ? MAP_MIN_WIDTH : '100%',
                      flexShrink: isDesktopLayout && !shouldStackPanels ? 1 : 0,
                      height: splitCardsViewportHeight,
                      maxHeight: splitCardsViewportHeight ?? '720px',
                    }}
                  >
                    <div className="px-3 py-2.5 border-b border-gray-700 flex items-center justify-between">
                      <h2 className="font-semibold text-white">{t('dashboard.flightPath')}</h2>
                      {currentFlightData?.messages && currentFlightData.messages.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowMessagesModal(true)}
                          className="relative p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
                          title={t('dashboard.viewFlightMessages')}
                          aria-label={t('dashboard.viewFlightMessages')}
                        >
                          {/* Chat-bubble icon */}
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8 10h.01M12 10h.01M16 10h.01M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
                            />
                          </svg>
                          {/* Red badge with count */}
                          <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-0.5 flex items-center justify-center rounded-full bg-red-600 text-white msg-badge-count text-[11px] font-bold leading-none border border-drone-dark">
                            {currentFlightData.messages.length > 99 ? '99+' : currentFlightData.messages.length}
                          </span>
                        </button>
                      )}
                    </div>
                    <div className="flex-1 min-h-[420px] relative">
                      <FlightMap
                        track={currentFlightData!.track}
                        homeLat={currentFlightData!.flight.homeLat}
                        homeLon={currentFlightData!.flight.homeLon}
                        durationSecs={currentFlightData!.flight.durationSecs}
                        telemetry={currentFlightData!.telemetry}
                        themeMode={themeMode}
                        messages={currentFlightData!.messages}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Flight Messages Modal */}
            {showMessagesModal && currentFlightData?.messages && currentFlightData.messages.length > 0 && (
              <FlightMessagesModal
                isOpen={showMessagesModal}
                onClose={() => setShowMessagesModal(false)}
                messages={currentFlightData.messages}
                flightStartTime={currentFlightData.flight.startTime ?? null}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 mx-auto mb-6 text-gray-600">
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-300 mb-2">
                {t('dashboard.noFlightSelected')}
              </h2>
              <p className="text-gray-500">
                {t('dashboard.noFlightDescription')}
              </p>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Floating bottom dock — primary navigation */}
      <NavDock
        view={activeView}
        importBusy={isImporterBusy}
        onNavigate={goToView}
        onImport={() => setShowImport(true)}
        onSettings={() => setShowSettings(true)}
      />
    </div>
  );
}
