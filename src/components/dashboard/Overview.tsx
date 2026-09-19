/**
 * Overview — ops-overview surface.
 * Composition (per docs/research/drone-ops-ux.md):
 *   A. Attention strip — actionable items only (overdue maintenance, declining
 *      batteries, flights with warning events). Empty state is calm, not a KPI.
 *   B. Dominant flight-locations map + recent flights rail.
 *   C. Compact activity stats band — text stats, not a tile wall.
 *   D. Equipment rail — aircraft + batteries with service status, maintenance
 *      actions, and the battery capacity trend chart.
 *   E. Secondary analytics — activity heatmap + flight records.
 * All numbers derive from existing real data endpoints; status colors come from
 * the semantic layer (danger/warning/success), never the accent.
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactECharts from 'echarts-for-react';
import { type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import type { Flight, OverviewStats } from '@/types';
import { getBatteryCapacityHistoryBatch } from '@/lib/api';
import {
  getBatteryGroupKey,
  getBatteryGroupMembers,
  getPairedBatteryDisplayName,
  useBatteryPairIndex,
} from '@/lib/batteryPairs';
import type { BatteryPairIndex } from '@/lib/batteryPairs';
import {
  formatDistance,
  formatDuration,
  formatAltitude,
  formatDateTime,
  formatDateDisplay as fmtDateDisplay,
  formatDateNumeric,
  normalizeSerial,
  isDecommissioned,
  type UnitPreferences,
} from '@/lib/utils';
import { cn } from '@/lib/cn';
import { useFlightStore } from '@/stores/flightStore';
import { FlightClusterMap } from './FlightClusterMap';
import { chartFontFamily, chartColors } from '@/lib/chartFont';
import { EmailSignatureModal } from './EmailSignatureModal';
import { DatePickerPopover } from '@/components/ui/DatePickerPopover';

// Rank thresholds — retained for the email-signature generator context only.
// The persistent progression strip was removed from the Overview head.
const RANKS = [
  { hours: 0, label: 'beginner' },
  { hours: 5, label: 'novice' },
  { hours: 20, label: 'intermediate' },
  { hours: 50, label: 'advanced' },
  { hours: 100, label: 'expert' },
  { hours: 200, label: 'legendary' },
] as const;

function currentRankLabel(totalHours: number, t: (k: string) => string): string {
  let label: string = RANKS[0].label;
  for (const r of RANKS) {
    if (totalHours >= r.hours) label = r.label;
  }
  return t(`overview.${label}`);
}

function resolveThemeMode(mode: 'system' | 'dark' | 'light'): 'dark' | 'light' {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return 'dark';
  }
  return mode;
}

interface OverviewProps {
  stats: OverviewStats;
  flights: Flight[];
  unitPrefs: UnitPreferences;
  onSelectFlight?: (flightId: number) => void;
  onOpenFlights?: () => void;
}

// =============================================================================
// Equipment model — one unified rail for aircraft + batteries
// =============================================================================

type EquipType = 'battery' | 'aircraft';
type EquipStatus = 'overdue' | 'due' | 'ok' | 'untracked' | 'retired';

interface EquipmentItem {
  key: string;
  type: EquipType;
  /** Primary serial; battery pairs store the group's member serials too. */
  serial: string | null;
  groupSerials: string[];
  displayName: string;
  /** Secondary line: aircraft model or battery serial/cycles. */
  subtitle: string | null;
  totalFlights: number;
  totalDurationSecs: number;
  maxCycleCount: number | null;
  /** False when no serial exists to key maintenance state against. */
  tracked: boolean;
  flightsSinceService: number;
  airtimeSinceServiceH: number;
  lastReset: Date | null;
  daysSinceService: number | null;
  /** Highest of the three dimension percentages (0-100+). */
  utilization: number;
  worstDim: 'flights' | 'airtime' | 'days';
  status: EquipStatus;
  /** Capacity decline vs peak, 0-1, when capacity telemetry exists. */
  capacityDrop: number | null;
}

interface AttentionItem {
  id: string;
  severity: 'danger' | 'warning';
  message: string;
  detail: string;
  target: { kind: 'equipment'; key: string } | { kind: 'flight'; id: number };
}

export function Overview({ stats, flights, unitPrefs, onSelectFlight, onOpenFlights }: OverviewProps) {
  const { t } = useTranslation();
  const locale = useFlightStore((state) => state.locale);
  const dateLocale = useFlightStore((state) => state.dateLocale);
  const appLanguage = useFlightStore((state) => state.appLanguage);
  const timeFormat = useFlightStore((state) => state.timeFormat);
  const themeMode = useFlightStore((state) => state.themeMode);
  const getBatteryDisplayName = useFlightStore((state) => state.getBatteryDisplayName);
  const renameBattery = useFlightStore((state) => state.renameBattery);
  const getDroneDisplayName = useFlightStore((state) => state.getDroneDisplayName);
  const renameDrone = useFlightStore((state) => state.renameDrone);
  const droneNameMap = useFlightStore((state) => state.droneNameMap);
  const batteryNameMap = useFlightStore((state) => state.batteryNameMap);
  const sidebarFilteredFlightIds = useFlightStore((state) => state.sidebarFilteredFlightIds);
  const getDisplaySerial = useFlightStore((state) => state.getDisplaySerial);
  const hideSerialNumbers = useFlightStore((state) => state.hideSerialNumbers);
  const overviewHighlightedFlightId = useFlightStore((state) => state.overviewHighlightedFlightId);
  const setHeatmapDateFilter = useFlightStore((state) => state.setHeatmapDateFilter);
  const maintenanceThresholds = useFlightStore((state) => state.maintenanceThresholds);
  const maintenanceLastReset = useFlightStore((state) => state.maintenanceLastReset);
  const setMaintenanceThreshold = useFlightStore((state) => state.setMaintenanceThreshold);
  const performMaintenance = useFlightStore((state) => state.performMaintenance);
  const batteryPairIndex = useBatteryPairIndex();
  const resolvedTheme = useMemo(() => resolveThemeMode(themeMode), [themeMode]);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [expandedEquipment, setExpandedEquipment] = useState<Set<string>>(new Set());

  // Use sidebar-filtered flights (fall back to all flights if no filter set yet)
  const filteredFlights = useMemo(() => {
    if (!sidebarFilteredFlightIds) return flights;
    return flights.filter((f) => sidebarFilteredFlightIds.has(f.id));
  }, [flights, sidebarFilteredFlightIds]);

  const filteredIdSet = useMemo(() => new Set(filteredFlights.map((f) => f.id)), [filteredFlights]);

  // Aggregate stats from the filtered flight set (same logic as before, minus
  // the fields only consumed by removed tiles/charts).
  const filteredStats = useMemo(() => {
    const totalFlights = filteredFlights.length;
    const totalDistanceM = filteredFlights.reduce((sum, f) => sum + (f.totalDistance ?? 0), 0);
    const totalDurationSecs = filteredFlights.reduce((sum, f) => sum + (f.durationSecs ?? 0), 0);
    const totalPhotos = filteredFlights.reduce((sum, f) => sum + (f.photoCount ?? 0), 0);
    const totalVideos = filteredFlights.reduce((sum, f) => sum + (f.videoCount ?? 0), 0);
    let maxAltitudeM = 0;
    for (const f of filteredFlights) {
      if ((f.maxAltitude ?? 0) > maxAltitudeM) maxAltitudeM = f.maxAltitude!;
    }

    // Battery usage (normalized serials, pair-aware merged values)
    const batteryMap = new Map<string, { count: number; duration: number; maxCycleCount: number | null }>();
    filteredFlights.forEach((f) => {
      const serial = normalizeSerial(f.batterySerial);
      if (serial) {
        const existing = batteryMap.get(serial) || { count: 0, duration: 0, maxCycleCount: null as number | null };
        const newMaxCycle = f.cycleCount != null
          ? (existing.maxCycleCount != null ? Math.max(existing.maxCycleCount, f.cycleCount) : f.cycleCount)
          : existing.maxCycleCount;
        batteryMap.set(serial, {
          count: existing.count + 1,
          duration: existing.duration + (f.durationSecs ?? 0),
          maxCycleCount: newMaxCycle,
        });
      }
    });

    const mergedBySerial = new Map<string, { count: number; duration: number; maxCycleCount: number | null }>();
    for (const serial of batteryMap.keys()) {
      const members = getBatteryGroupMembers(serial, batteryPairIndex);
      const relevant = members.length > 0 ? members : [serial];
      let count = 0;
      let duration = 0;
      let maxCycleCount: number | null = null;
      for (const member of relevant) {
        const usage = batteryMap.get(member);
        if (!usage) continue;
        count += usage.count;
        duration += usage.duration;
        if (usage.maxCycleCount != null) {
          maxCycleCount = maxCycleCount != null ? Math.max(maxCycleCount, usage.maxCycleCount) : usage.maxCycleCount;
        }
      }
      mergedBySerial.set(serial, { count, duration, maxCycleCount });
    }

    const batteriesUsed = Array.from(mergedBySerial.entries()).map(([serial, data]) => ({
      batterySerial: serial,
      flightCount: data.count,
      totalDurationSecs: data.duration,
      maxCycleCount: data.maxCycleCount,
    }));

    // Drone usage: keyed by serial, falling back to model for serial-less flights
    const droneMap = new Map<string, { model: string; serial: string | null; name: string | null; count: number; totalDurationSecs: number }>();
    filteredFlights.forEach((f) => {
      const serial = normalizeSerial(f.droneSerial);
      const key = serial || `model:${f.droneModel ?? 'Unknown'}`;
      const existing = droneMap.get(key);
      if (existing) {
        existing.count++;
        existing.totalDurationSecs += f.durationSecs ?? 0;
        if (!existing.name && f.aircraftName) existing.name = f.aircraftName;
        if (f.droneModel && existing.model === 'Unknown') existing.model = f.droneModel;
      } else {
        droneMap.set(key, {
          model: f.droneModel ?? 'Unknown',
          serial: serial || null,
          name: f.aircraftName ?? null,
          count: 1,
          totalDurationSecs: f.durationSecs ?? 0,
        });
      }
    });

    const modelCounts = new Map<string, number>();
    droneMap.forEach((d) => {
      const fallback = d.name || d.model;
      const displayName = d.serial ? getDroneDisplayName(d.serial, fallback) : fallback;
      modelCounts.set(displayName, (modelCounts.get(displayName) || 0) + 1);
    });

    const dronesUsed = Array.from(droneMap.entries())
      .map(([_, data]) => {
        const fallback = data.name || data.model;
        const displayName = data.serial ? getDroneDisplayName(data.serial, fallback) : fallback;
        const needsSerial = (modelCounts.get(displayName) || 0) > 1 && data.serial;
        return {
          droneModel: data.model,
          droneSerial: data.serial,
          aircraftName: data.name,
          flightCount: data.count,
          totalDurationSecs: data.totalDurationSecs,
          displayLabel: needsSerial ? `${displayName} (${getDisplaySerial(data.serial!)})` : displayName,
        };
      })
      .sort((a, b) => b.totalDurationSecs - a.totalDurationSecs);

    // Flights by date for the activity heatmap
    const dateMap = new Map<string, number>();
    const pad = (value: number) => String(value).padStart(2, '0');
    const toDateKey = (value: string) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value.split('T')[0];
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };
    filteredFlights.forEach((f) => {
      if (f.startTime) {
        const date = toDateKey(f.startTime);
        dateMap.set(date, (dateMap.get(date) || 0) + 1);
      }
    });
    const flightsByDate = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalFlights,
      totalDistanceM,
      totalDurationSecs,
      totalPhotos,
      totalVideos,
      maxAltitudeM,
      batteriesUsed,
      dronesUsed,
      flightsByDate,
    };
  }, [filteredFlights, getDroneDisplayName, droneNameMap, getBatteryDisplayName, batteryNameMap, getDisplaySerial, hideSerialNumbers, batteryPairIndex]);

  // Battery capacity history — one batched call replaces the per-serial N+1 loop.
  const [capacityHistory, setCapacityHistory] = useState<Map<string, [number, string, number][]>>(new Map());
  const batterySerialsKey = useMemo(
    () => filteredStats.batteriesUsed.map((b) => b.batterySerial).sort().join(','),
    [filteredStats.batteriesUsed],
  );
  useEffect(() => {
    let cancelled = false;
    const serials = batterySerialsKey ? batterySerialsKey.split(',') : [];
    if (serials.length === 0) {
      setCapacityHistory(new Map());
      return;
    }
    getBatteryCapacityHistoryBatch(serials)
      .then((raw) => {
        if (cancelled) return;
        const normalized = new Map<string, [number, string, number][]>();
        for (const [serial, points] of Object.entries(raw)) {
          if (points.length > 0) normalized.set(normalizeSerial(serial), points);
        }
        setCapacityHistory(normalized);
      })
      .catch(() => {
        if (!cancelled) setCapacityHistory(new Map());
      });
    return () => { cancelled = true; };
  }, [batterySerialsKey]);

  // Equipment items: batteries grouped by pair key + serial-keyed aircraft,
  // each with service-window progress against the configured thresholds.
  const equipmentItems = useMemo<EquipmentItem[]>(() => {
    const items: EquipmentItem[] = [];
    const now = Date.now();

    const progressFor = (type: EquipType, serials: string[], lastReset: Date | null) => {
      const relevant = serials;
      let flightsSince = 0;
      let airtimeSince = 0;
      for (const f of filteredFlights) {
        const fSerial = normalizeSerial(type === 'battery' ? f.batterySerial : f.droneSerial);
        if (!relevant.includes(fSerial)) continue;
        if (lastReset && f.startTime && new Date(f.startTime) <= lastReset) continue;
        flightsSince++;
        airtimeSince += f.durationSecs ?? 0;
      }
      return { flightsSince, airtimeH: airtimeSince / 3600 };
    };

    const buildItem = (input: {
      type: EquipType;
      serial: string;
      groupSerials: string[];
      displayName: string;
      subtitle: string | null;
      totalFlights: number;
      totalDurationSecs: number;
      maxCycleCount: number | null;
    }): EquipmentItem => {
      const thresholds = maintenanceThresholds[input.type];
      const resetMap = maintenanceLastReset[input.type];
      let lastReset: Date | null = null;
      for (const member of input.groupSerials) {
        const ts = resetMap[member];
        if (!ts) continue;
        const d = new Date(ts);
        if (!lastReset || d > lastReset) lastReset = d;
      }
      const { flightsSince, airtimeH } = progressFor(input.type, input.groupSerials, lastReset);
      const daysSinceService = lastReset ? Math.floor((now - lastReset.getTime()) / 86400000) : null;
      const flightsPct = (flightsSince / thresholds.flights) * 100;
      const airtimePct = (airtimeH / thresholds.airtime) * 100;
      const daysPct = daysSinceService != null ? (daysSinceService / thresholds.days) * 100 : null;
      let utilization = Math.max(flightsPct, airtimePct);
      let worstDim: EquipmentItem['worstDim'] = flightsPct >= airtimePct ? 'flights' : 'airtime';
      if (daysPct != null && daysPct > utilization) {
        utilization = daysPct;
        worstDim = 'days';
      }
      const retired = isDecommissioned(input.displayName);
      const status: EquipStatus = retired
        ? 'retired'
        : utilization >= 100
          ? 'overdue'
          : utilization >= 75
            ? 'due'
            : 'ok';
      return {
        key: `${input.type}:${input.serial}`,
        type: input.type,
        serial: input.serial,
        groupSerials: input.groupSerials,
        displayName: input.displayName,
        subtitle: input.subtitle,
        totalFlights: input.totalFlights,
        totalDurationSecs: input.totalDurationSecs,
        maxCycleCount: input.maxCycleCount,
        tracked: true,
        flightsSinceService: flightsSince,
        airtimeSinceServiceH: airtimeH,
        lastReset,
        daysSinceService,
        utilization,
        worstDim,
        status,
        capacityDrop: null,
      };
    };

    // Batteries: one row per pair group
    const seenGroups = new Set<string>();
    for (const battery of filteredStats.batteriesUsed) {
      const groupKey = getBatteryGroupKey(battery.batterySerial, batteryPairIndex);
      if (seenGroups.has(groupKey)) continue;
      seenGroups.add(groupKey);
      const members = getBatteryGroupMembers(battery.batterySerial, batteryPairIndex);
      const groupSerials = members.length > 0 ? members : [normalizeSerial(battery.batterySerial)];
      const displayName = getPairedBatteryDisplayName(battery.batterySerial, batteryPairIndex, getBatteryDisplayName);
      const points = capacityHistory.get(normalizeSerial(battery.batterySerial));
      let capacityDrop: number | null = null;
      if (points && points.length >= 2) {
        const peak = Math.max(...points.map((p) => p[2]));
        const latest = points[points.length - 1][2];
        if (peak > 0) capacityDrop = Math.max(0, (peak - latest) / peak);
      }
      items.push({
        ...buildItem({
          type: 'battery',
          serial: battery.batterySerial,
          groupSerials,
          displayName,
          subtitle: hideSerialNumbers ? null : getDisplaySerial(battery.batterySerial),
          totalFlights: battery.flightCount,
          totalDurationSecs: battery.totalDurationSecs,
          maxCycleCount: battery.maxCycleCount,
        }),
        key: `battery:${groupKey}`,
        capacityDrop,
      });
    }

    // Aircraft
    for (const drone of filteredStats.dronesUsed) {
      if (!drone.droneSerial) {
        // Serial-less aircraft can't be keyed into maintenance state.
        items.push({
          key: `aircraft-model:${drone.droneModel}`,
          type: 'aircraft',
          serial: null,
          groupSerials: [],
          displayName: drone.displayLabel,
          subtitle: null,
          totalFlights: drone.flightCount,
          totalDurationSecs: drone.totalDurationSecs,
          maxCycleCount: null,
          tracked: false,
          flightsSinceService: 0,
          airtimeSinceServiceH: 0,
          lastReset: null,
          daysSinceService: null,
          utilization: 0,
          worstDim: 'flights',
          status: isDecommissioned(drone.displayLabel) ? 'retired' : 'untracked',
          capacityDrop: null,
        });
        continue;
      }
      items.push(
        buildItem({
          type: 'aircraft',
          serial: drone.droneSerial,
          groupSerials: [drone.droneSerial],
          displayName: drone.displayLabel,
          subtitle:
            !hideSerialNumbers && !drone.displayLabel.includes(getDisplaySerial(drone.droneSerial))
              ? getDisplaySerial(drone.droneSerial)
              : drone.droneModel !== 'Unknown' && !drone.displayLabel.includes(drone.droneModel)
                ? drone.droneModel
                : null,
          totalFlights: drone.flightCount,
          totalDurationSecs: drone.totalDurationSecs,
          maxCycleCount: null,
        }),
      );
    }

    const rank: Record<EquipStatus, number> = { overdue: 0, due: 1, ok: 2, untracked: 3, retired: 4 };
    return items.sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return b.utilization - a.utilization;
    });
  }, [filteredStats.batteriesUsed, filteredStats.dronesUsed, filteredFlights, maintenanceThresholds, maintenanceLastReset, batteryPairIndex, getBatteryDisplayName, getDisplaySerial, hideSerialNumbers, capacityHistory]);

  // Recent flights for the rail — newest first
  const recentFlights = useMemo(
    () =>
      [...filteredFlights]
        .sort((a, b) => (Date.parse(b.startTime ?? '') || 0) - (Date.parse(a.startTime ?? '') || 0))
        .slice(0, 7),
    [filteredFlights],
  );

  const warningByFlightId = useMemo(() => {
    const map = new Map<number, number>();
    for (const wf of stats.warningFlights ?? []) {
      if (filteredIdSet.has(wf.flightId)) map.set(wf.flightId, wf.warnCount + wf.cautionCount);
    }
    return map;
  }, [stats.warningFlights, filteredIdSet]);

  // Attention items — declarative, numeric, severity-sorted.
  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    for (const item of equipmentItems) {
      if (item.status !== 'overdue' && item.status !== 'due') continue;
      const thresholds = maintenanceThresholds[item.type];
      const detail =
        item.worstDim === 'flights'
          ? t('overview.dimFlights', { used: item.flightsSinceService, limit: thresholds.flights })
          : item.worstDim === 'airtime'
            ? t('overview.dimAirtime', { used: item.airtimeSinceServiceH.toFixed(1), limit: thresholds.airtime })
            : t('overview.dimDays', { days: item.daysSinceService ?? 0, limit: thresholds.days });
      items.push({
        id: `svc-${item.key}`,
        severity: item.status === 'overdue' ? 'danger' : 'warning',
        message: t(item.status === 'overdue' ? 'overview.serviceOverdue' : 'overview.serviceDueSoon', { name: item.displayName }),
        detail,
        target: { kind: 'equipment', key: item.key },
      });
      if (item.capacityDrop != null && item.capacityDrop >= 0.08) {
        items.push({
          id: `cap-${item.key}`,
          severity: item.capacityDrop >= 0.2 ? 'danger' : 'warning',
          message: t('overview.capacityDecline', { name: item.displayName, pct: Math.round(item.capacityDrop * 100) }),
          detail: item.serial ?? '',
          target: { kind: 'equipment', key: item.key },
        });
      }
    }
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;
    for (const wf of stats.warningFlights ?? []) {
      if (!filteredIdSet.has(wf.flightId)) continue;
      const ts = wf.startTime ? Date.parse(wf.startTime) : NaN;
      if (Number.isFinite(ts) && ts < thirtyDaysAgo) continue;
      items.push({
        id: `warn-${wf.flightId}`,
        severity: 'warning',
        message: t('overview.flightWarningEvents', {
          name: wf.displayName,
          count: wf.warnCount + wf.cautionCount,
        }),
        detail: wf.startTime ? formatDateNumeric(new Date(wf.startTime), dateLocale) : '',
        target: { kind: 'flight', id: wf.flightId },
      });
    }
    const sevRank = { danger: 0, warning: 1 };
    return items.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  }, [equipmentItems, stats.warningFlights, filteredIdSet, maintenanceThresholds, t, dateLocale]);

  const revealEquipment = useCallback((key: string) => {
    setExpandedEquipment((prev) => new Set(prev).add(key));
    // Wait a frame so the row exists before scrolling.
    requestAnimationFrame(() => {
      document
        .getElementById(`eq-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const toggleEquipment = useCallback((key: string) => {
    setExpandedEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleAttentionAction = useCallback(
    (item: AttentionItem) => {
      if (item.target.kind === 'equipment') revealEquipment(item.target.key);
      else onSelectFlight?.(item.target.id);
    },
    [revealEquipment, onSelectFlight],
  );

  const isEmpty = filteredStats.totalFlights === 0;

  return (
    <div className="w-full min-w-0 max-w-[1600px] mx-auto px-3 sm:px-4 pt-4 pb-24 space-y-4">
      {/* Page header */}
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-ink font-sans">{t('nav.overview')}</h1>
        <button
          type="button"
          onClick={() => setShowSignatureModal(true)}
          className="text-xs text-muted hover:text-ink rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {t('overview.emailSignature')}
        </button>
      </header>

      {/* A. Attention strip */}
      <AttentionStrip items={attentionItems} onAction={handleAttentionAction} />

      {isEmpty ? (
        <div className="rounded-[var(--skydra-radius-lg)] border border-line bg-surface px-5 py-10 text-center">
          <p className="text-sm font-medium text-ink">{t('overview.emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted">{t('overview.emptyHint')}</p>
        </div>
      ) : (
        <>
          {/* B. Dominant map + recent flights rail */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)] [&>*]:min-w-0">
            <FlightClusterMap
              flights={filteredFlights}
              allFlights={flights}
              unitPrefs={unitPrefs}
              themeMode={themeMode}
              onSelectFlight={onSelectFlight}
              highlightedFlightId={overviewHighlightedFlightId}
            />
            <RecentFlights
              flights={recentFlights}
              warningByFlightId={warningByFlightId}
              unitPrefs={unitPrefs}
              locale={locale}
              dateLocale={dateLocale}
              appLanguage={appLanguage}
              hour12={timeFormat !== '24h'}
              onSelectFlight={onSelectFlight}
              onOpenFlights={onOpenFlights}
            />
          </div>

          {/* C. Compact stats band */}
          <ActivityBand
            flights={filteredFlights}
            stats={filteredStats}
            unitPrefs={unitPrefs}
            locale={locale}
            dateLocale={dateLocale}
            appLanguage={appLanguage}
          />

          {/* D. Equipment rail + capacity chart */}
          <EquipmentSection
            items={equipmentItems}
            expanded={expandedEquipment}
            onToggle={toggleEquipment}
            capacityHistory={capacityHistory}
            batteryPairIndex={batteryPairIndex}
            resolvedTheme={resolvedTheme}
            unitPrefs={unitPrefs}
            locale={locale}
            dateLocale={dateLocale}
            appLanguage={appLanguage}
            getBatteryDisplayName={getBatteryDisplayName}
            getDroneDisplayName={getDroneDisplayName}
            renameBattery={renameBattery}
            renameDrone={renameDrone}
            hideSerialNumbers={hideSerialNumbers}
            maintenanceThresholds={maintenanceThresholds}
            setMaintenanceThreshold={setMaintenanceThreshold}
            performMaintenance={performMaintenance}
          />

          {/* E. Secondary analytics */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)] [&>*]:min-w-0">
            <ActivityHeatmapCard
              flightsByDate={filteredStats.flightsByDate}
              isLight={resolvedTheme === 'light'}
              onActivateDate={(date) => setHeatmapDateFilter(date)}
              onOpenFlights={onOpenFlights}
            />
            <FlightRecords
              flights={filteredFlights}
              unitPrefs={unitPrefs}
              locale={locale}
              dateLocale={dateLocale}
              onSelectFlight={onSelectFlight}
            />
          </div>
        </>
      )}

      {showSignatureModal && (
        <EmailSignatureModal
          totalFlights={filteredStats.totalFlights}
          totalDurationSecs={filteredStats.totalDurationSecs}
          totalPhotos={filteredStats.totalPhotos}
          totalVideos={filteredStats.totalVideos}
          currentRank={currentRankLabel(filteredStats.totalDurationSecs / 3600, t)}
          onClose={() => setShowSignatureModal(false)}
        />
      )}
    </div>
  );
}

// =============================================================================
// A. Attention strip
// =============================================================================

const ATTENTION_PREVIEW = 3;

function AttentionStrip({
  items,
  onAction,
}: {
  items: AttentionItem[];
  onAction: (item: AttentionItem) => void;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, ATTENTION_PREVIEW);

  return (
    <section
      aria-labelledby="overview-attention-heading"
      className="rounded-[var(--skydra-radius-lg)] border border-line bg-surface"
    >
      <h2
        id="overview-attention-heading"
        className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted"
      >
        {t('overview.needsAttention')}
      </h2>
      {items.length === 0 ? (
        <p className="px-4 pb-3 pt-1.5 text-sm text-muted">{t('overview.noAttention')}</p>
      ) : (
        <ul className="px-2 pb-2 pt-1">
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onAction(item)}
                className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-2 w-2 flex-shrink-0 rounded-full',
                    item.severity === 'danger' ? 'bg-danger' : 'bg-warning',
                  )}
                />
                <span className="min-w-0 flex-1 text-sm text-ink">
                  <span className="truncate">{item.message}</span>
                  {item.detail && <span className="ml-2 text-xs text-muted">{item.detail}</span>}
                </span>
                <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0 text-faint" />
              </button>
            </li>
          ))}
          {items.length > ATTENTION_PREVIEW && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-expanded={showAll}
              >
                {showAll
                  ? t('overview.showLess')
                  : t('overview.showMoreAttention', { count: items.length - ATTENTION_PREVIEW })}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

// =============================================================================
// B2. Recent flights rail
// =============================================================================

function RecentFlights({
  flights,
  warningByFlightId,
  unitPrefs,
  locale,
  dateLocale,
  appLanguage,
  hour12,
  onSelectFlight,
  onOpenFlights,
}: {
  flights: Flight[];
  warningByFlightId: Map<number, number>;
  unitPrefs: UnitPreferences;
  locale: string;
  dateLocale: string;
  appLanguage: string;
  hour12: boolean;
  onSelectFlight?: (flightId: number) => void;
  onOpenFlights?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="overview-recent-heading"
      className="flex min-h-0 flex-col rounded-[var(--skydra-radius-lg)] border border-line bg-surface"
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 id="overview-recent-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('overview.recentFlights')}
        </h2>
        {onOpenFlights && (
          <button
            type="button"
            onClick={onOpenFlights}
            className="text-xs text-muted transition-colors hover:text-ink rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {t('overview.viewAll')}
          </button>
        )}
      </div>
      <ul className="flex-1 px-2 pb-2 pt-1">
        {flights.map((flight) => {
          const warnings = warningByFlightId.get(flight.id) ?? 0;
          return (
            <li key={flight.id}>
              <button
                type="button"
                onClick={() => onSelectFlight?.(flight.id)}
                className="w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                title={t('overview.openFlight', { name: flight.displayName || flight.fileName })}
              >
                <span
                  aria-hidden="true"
                  className="h-6 w-1 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: flight.color || 'rgb(var(--skydra-track))' }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {flight.displayName || flight.fileName}
                  </span>
                  <span className="block truncate text-[11px] text-faint">
                    {formatDateTime(flight.startTime, dateLocale, appLanguage, hour12)}
                    {flight.aircraftName || flight.droneModel ? ` · ${flight.aircraftName ?? flight.droneModel}` : ''}
                  </span>
                </span>
                {warnings > 0 && (
                  <span className="flex-shrink-0 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    {t('overview.warningCount', { count: warnings })}
                  </span>
                )}
                <span className="flex-shrink-0 text-right font-mono text-[11px] text-muted">
                  <span className="block">{formatDuration(flight.durationSecs)}</span>
                  <span className="block text-faint">{formatDistance(flight.totalDistance, unitPrefs.distance, locale)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// =============================================================================
// C. Activity stats band — text stats, not tiles
// =============================================================================

function ActivityBand({
  flights,
  stats,
  unitPrefs,
  locale,
  dateLocale,
  appLanguage,
}: {
  flights: Flight[];
  stats: {
    totalFlights: number;
    totalDistanceM: number;
    totalDurationSecs: number;
    batteriesUsed: { batterySerial: string }[];
    dronesUsed: { droneSerial: string | null }[];
  };
  unitPrefs: UnitPreferences;
  locale: string;
  dateLocale: string;
  appLanguage: string;
}) {
  const { t } = useTranslation();
  const last30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    let count = 0;
    let durationSecs = 0;
    let distanceM = 0;
    let lastFlight: Flight | null = null;
    let lastTs = -Infinity;
    for (const f of flights) {
      const ts = f.startTime ? Date.parse(f.startTime) : NaN;
      if (Number.isFinite(ts) && ts > lastTs) {
        lastTs = ts;
        lastFlight = f;
      }
      if (Number.isFinite(ts) && ts >= cutoff) {
        count++;
        durationSecs += f.durationSecs ?? 0;
        distanceM += f.totalDistance ?? 0;
      }
    }
    return { count, durationSecs, distanceM, lastFlight };
  }, [flights]);

  const items: { label: string; value: string }[] = [
    {
      label: t('overview.last30Days'),
      value: `${t('overview.flightCount', { count: last30.count })} · ${formatDuration(last30.durationSecs)} · ${formatDistance(last30.distanceM, unitPrefs.distance, locale)}`,
    },
    {
      label: t('overview.allTime'),
      value: `${t('overview.flightCount', { count: stats.totalFlights })} · ${formatDuration(stats.totalDurationSecs)} · ${formatDistance(stats.totalDistanceM, unitPrefs.distance, locale)}`,
    },
    {
      label: t('overview.fleet'),
      value: `${t('overview.aircraftCount', { count: stats.dronesUsed.length })} · ${t('overview.batteryCount', { count: stats.batteriesUsed.length })}`,
    },
  ];
  if (last30.lastFlight) {
    items.push({
      label: t('overview.lastFlight'),
      value: `${last30.lastFlight.displayName || last30.lastFlight.fileName} — ${fmtDateDisplay(new Date(last30.lastFlight.startTime!), dateLocale, appLanguage)}`,
    });
  }

  return (
    <section
      aria-label={t('overview.activitySummary')}
      className="rounded-[var(--skydra-radius-lg)] border border-line bg-surface px-4 py-3"
    >
      <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-faint">{item.label}</dt>
            <dd className="mt-0.5 truncate font-mono text-sm text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// =============================================================================
// D. Equipment section — unified aircraft + battery rail with service state
// =============================================================================

interface EquipmentSectionProps {
  items: EquipmentItem[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  capacityHistory: Map<string, [number, string, number][]>;
  batteryPairIndex: BatteryPairIndex;
  resolvedTheme: 'dark' | 'light';
  unitPrefs: UnitPreferences;
  locale: string;
  dateLocale: string;
  appLanguage: string;
  getBatteryDisplayName: (serial: string) => string;
  getDroneDisplayName: (serial: string, fallbackName: string) => string;
  renameBattery: (serial: string, displayName: string) => Promise<void> | void;
  renameDrone: (serial: string, displayName: string) => Promise<void> | void;
  hideSerialNumbers: boolean;
  maintenanceThresholds: {
    battery: { flights: number; airtime: number; days: number };
    aircraft: { flights: number; airtime: number; days: number };
  };
  setMaintenanceThreshold: (type: EquipType, field: 'flights' | 'airtime' | 'days', value: number) => void;
  performMaintenance: (type: EquipType, serial: string, date?: Date) => void;
}

function EquipmentSection(props: EquipmentSectionProps) {
  const { items, expanded, onToggle } = props;
  const { t } = useTranslation();
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  const hasCapacityData = props.capacityHistory.size > 0;

  return (
    <section
      aria-labelledby="overview-equipment-heading"
      className="rounded-[var(--skydra-radius-lg)] border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <h2 id="overview-equipment-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('overview.equipment')}
        </h2>
        <button
          type="button"
          onClick={() => setThresholdsOpen((v) => !v)}
          aria-expanded={thresholdsOpen}
          className="text-xs text-muted transition-colors hover:text-ink rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {t('overview.serviceThresholds')}
        </button>
      </div>

      {thresholdsOpen && (
        <ThresholdEditor
          thresholds={props.maintenanceThresholds}
          setMaintenanceThreshold={props.setMaintenanceThreshold}
        />
      )}

      {items.length === 0 ? (
        <p className="px-4 pb-4 pt-2 text-sm text-muted">{t('overview.noEquipment')}</p>
      ) : (
        <ul className="px-2 pb-2 pt-1">
          {items.map((item) => (
            <EquipmentRow key={item.key} item={item} {...props} isOpen={expanded.has(item.key)} onToggle={onToggle} />
          ))}
        </ul>
      )}

      {hasCapacityData && (
        <BatteryCapacityChart
          capacityHistory={props.capacityHistory}
          batteriesSeen={items.filter((i) => i.type === 'battery')}
          getBatteryDisplayName={props.getBatteryDisplayName}
          batteryPairIndex={props.batteryPairIndex}
          resolvedTheme={props.resolvedTheme}
          dateLocale={props.dateLocale}
        />
      )}
    </section>
  );
}

const STATUS_STYLES: Record<EquipStatus, { dot: string; text: string }> = {
  overdue: { dot: 'bg-danger', text: 'text-danger' },
  due: { dot: 'bg-warning', text: 'text-warning' },
  ok: { dot: 'bg-success', text: 'text-success' },
  untracked: { dot: 'bg-faint', text: 'text-faint' },
  retired: { dot: 'bg-faint', text: 'text-faint' },
};

function EquipmentRow({
  item,
  isOpen,
  onToggle,
  resolvedTheme,
  dateLocale,
  appLanguage,
  renameBattery,
  renameDrone,
  maintenanceThresholds,
  performMaintenance,
  capacityHistory,
}: EquipmentSectionProps & { item: EquipmentItem; isOpen: boolean; onToggle: (key: string) => void }) {
  const { t } = useTranslation();
  const thresholds = maintenanceThresholds[item.type];
  const styles = STATUS_STYLES[item.status];
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [serviceDate, setServiceDate] = useState<Date>(new Date());
  const [datePickerAnchor, setDatePickerAnchor] = useState<{ top: number; left: number } | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const statusLabel =
    item.status === 'overdue'
      ? t('overview.statusOverdue')
      : item.status === 'due'
        ? t('overview.statusDueSoon')
        : item.status === 'ok'
          ? t('overview.statusOk')
          : item.status === 'retired'
            ? t('overview.statusRetired')
            : t('overview.statusUntracked');

  const handleSaveRename = () => {
    const name = draftName.trim();
    if (item.serial == null) return;
    if (name.length === 0 || name === item.serial) {
      if (item.type === 'battery') renameBattery(item.serial, '');
      else renameDrone(item.serial, '');
      setEditing(false);
      setRenameError(null);
      return;
    }
    if (item.type === 'battery') renameBattery(item.serial, name);
    else renameDrone(item.serial, name);
    setEditing(false);
    setRenameError(null);
  };

  const handleMaintenance = () => {
    const date = new Date(serviceDate);
    date.setHours(23, 59, 59, 999);
    for (const member of item.groupSerials) {
      performMaintenance(item.type, member, date);
    }
    setServiceDate(new Date());
  };

  const flightsPct = Math.min((item.flightsSinceService / thresholds.flights) * 100, 100);
  const airtimePct = Math.min((item.airtimeSinceServiceH / thresholds.airtime) * 100, 100);
  const daysPct = item.daysSinceService != null ? Math.min((item.daysSinceService / thresholds.days) * 100, 100) : null;

  const rowId = `eq-${item.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const header = (
    <>
      <span aria-hidden="true" className={cn('h-2 w-2 flex-shrink-0 rounded-full', styles.dot)} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm text-ink">{item.displayName}</span>
          <span className="flex-shrink-0 rounded border border-line px-1 py-px text-[9px] font-medium uppercase tracking-wide text-faint">
            {item.type === 'battery' ? t('overview.batteryType') : t('overview.aircraftType')}
          </span>
          {item.capacityDrop != null && item.capacityDrop >= 0.08 && (
            <span
              className={cn(
                'flex-shrink-0 rounded px-1 py-px text-[9px] font-medium',
                item.capacityDrop >= 0.2 ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning',
              )}
            >
              {t('overview.capacityBadge', { pct: Math.round(item.capacityDrop * 100) })}
            </span>
          )}
        </span>
        <span className="block truncate text-[11px] text-faint">
          {item.subtitle ? `${item.subtitle} · ` : ''}
          {t('overview.flightCount', { count: item.totalFlights })} · {formatDuration(item.totalDurationSecs)}
          {item.maxCycleCount != null ? ` · ${t('overview.cyclesInfo', { cycles: item.maxCycleCount })}` : ''}
        </span>
      </span>
      {item.tracked ? (
        <span className="hidden sm:flex flex-shrink-0 items-center gap-2">
          <span className="w-24">
            <span className="block h-1.5 overflow-hidden rounded-full bg-canvas">
              <span
                className={cn(
                  'block h-full rounded-full transition-all',
                  item.status === 'overdue' ? 'bg-danger' : item.status === 'due' ? 'bg-warning' : 'bg-success',
                )}
                style={{ width: `${Math.min(item.utilization, 100)}%` }}
              />
            </span>
          </span>
          <span className={cn('w-20 text-right font-mono text-[11px]', styles.text)}>
            {statusLabel}
          </span>
        </span>
      ) : (
        <span className="flex-shrink-0 text-[10px] text-faint">{statusLabel}</span>
      )}
      <ChevronRightIcon
        className={cn('h-3.5 w-3.5 flex-shrink-0 text-faint transition-transform', isOpen && 'rotate-90')}
      />
    </>
  );

  return (
    <li id={rowId} className="scroll-mt-4">
      {item.tracked ? (
        <button
          type="button"
          onClick={() => onToggle(item.key)}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-md px-2 py-2.5">{header}</div>
      )}

      {item.tracked && isOpen && (
        <div className="mx-2 mb-2 rounded-md border border-line bg-canvas px-3 py-3">
          {/* Per-dimension service progress */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ProgressDim
              label={t('overview.flights')}
              used={`${item.flightsSinceService}`}
              limit={`${thresholds.flights}`}
              pct={flightsPct}
              over={item.flightsSinceService >= thresholds.flights}
            />
            <ProgressDim
              label={t('overview.airtime')}
              used={item.airtimeSinceServiceH.toFixed(1)}
              limit={`${thresholds.airtime}h`}
              pct={airtimePct}
              over={item.airtimeSinceServiceH >= thresholds.airtime}
            />
            <ProgressDim
              label={t('overview.daysSinceServiceLabel')}
              used={item.daysSinceService != null ? `${item.daysSinceService}d` : t('overview.never')}
              limit={`${thresholds.days}d`}
              pct={daysPct ?? 0}
              over={item.daysSinceService != null && item.daysSinceService >= thresholds.days}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">
              {t('overview.lastMaintenance', {
                date: item.lastReset ? fmtDateDisplay(item.lastReset, dateLocale, appLanguage) : t('overview.never'),
              })}
            </span>
          </div>

          {/* Actions: rename + log maintenance */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {editing ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    setRenameError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  aria-label={item.type === 'battery' ? t('overview.batteryName') : t('overview.droneName')}
                  className="h-8 min-w-0 flex-1 rounded border border-line bg-surface px-2 text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveRename}
                  className="text-xs text-accent hover:text-accent-hover rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {t('overview.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-xs text-muted hover:text-ink rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {t('overview.cancel')}
                </button>
                {renameError && <span className="text-[10px] text-danger">{renameError}</span>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraftName(item.displayName);
                  setEditing(true);
                }}
                className="rounded border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-ink hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {item.type === 'battery' ? t('overview.renameBattery') : t('overview.renameDrone')}
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  if (datePickerOpen) {
                    setDatePickerOpen(false);
                    setDatePickerAnchor(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDatePickerAnchor({ top: rect.top, left: rect.left });
                    setDatePickerOpen(true);
                  }
                }}
                className="rounded border border-line px-2.5 py-1.5 text-xs text-ink transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {fmtDateDisplay(serviceDate, dateLocale, appLanguage)}
              </button>
              <DatePickerPopover
                isOpen={datePickerOpen && !!datePickerAnchor}
                onClose={() => {
                  setDatePickerOpen(false);
                  setDatePickerAnchor(null);
                }}
                isLight={resolvedTheme === 'light'}
                mode="single"
                selected={serviceDate}
                onSelect={(date) => {
                  if (date) setServiceDate(date);
                  setDatePickerOpen(false);
                  setDatePickerAnchor(null);
                }}
                disabled={{ after: today }}
                defaultMonth={serviceDate}
                jumpMaxDate={today}
                onJumpDate={(date) => {
                  setServiceDate(date);
                  setDatePickerOpen(false);
                  setDatePickerAnchor(null);
                }}
                style={datePickerAnchor ? { top: Math.max(8, datePickerAnchor.top - 310), left: datePickerAnchor.left } : undefined}
              />
            </div>
            <button
              type="button"
              onClick={handleMaintenance}
              className="rounded border border-success px-2.5 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {t('overview.maintenanceDone')}
            </button>
          </div>

          {item.type === 'battery' && (
            <CapacityMiniSummary serial={item.serial} capacityHistory={capacityHistory} />
          )}
        </div>
      )}
    </li>
  );
}

function ProgressDim({
  label,
  used,
  limit,
  pct,
  over,
}: {
  label: string;
  used: string;
  limit: string;
  pct: number;
  over: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-muted">{label}</span>
        <span className={cn('font-mono text-[11px]', over ? 'text-danger' : pct >= 75 ? 'text-warning' : 'text-muted')}>
          {used}/{limit}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className={cn('h-full rounded-full', over ? 'bg-danger' : pct >= 75 ? 'bg-warning' : 'bg-success')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CapacityMiniSummary({
  serial,
  capacityHistory,
}: {
  serial: string | null;
  capacityHistory: Map<string, [number, string, number][]>;
}) {
  const { t } = useTranslation();
  if (!serial) return null;
  const points = capacityHistory.get(normalizeSerial(serial));
  if (!points || points.length === 0) return null;
  const latest = points[points.length - 1][2];
  const peak = Math.max(...points.map((p) => p[2]));
  return (
    <p className="mt-2 font-mono text-[11px] text-muted">
      {t('overview.capacityNow', { latest: Math.round(latest), peak: Math.round(peak) })}
    </p>
  );
}

// =============================================================================
// Threshold editor (collapsed by default)
// =============================================================================

function ThresholdEditor({
  thresholds,
  setMaintenanceThreshold,
}: {
  thresholds: EquipmentSectionProps['maintenanceThresholds'];
  setMaintenanceThreshold: EquipmentSectionProps['setMaintenanceThreshold'];
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => ({
    battery: { ...thresholds.battery },
    aircraft: { ...thresholds.aircraft },
  }));
  useEffect(() => {
    setDraft({
      battery: { ...thresholds.battery },
      aircraft: { ...thresholds.aircraft },
    });
  }, [thresholds]);

  const renderGroup = (type: EquipType) => (
    <fieldset className="min-w-0 flex-1">
      <legend className="text-[10px] font-semibold uppercase tracking-wide text-faint">
        {type === 'battery' ? t('overview.batteryType') : t('overview.aircraftType')}
      </legend>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {(['flights', 'airtime', 'days'] as const).map((field) => (
          <label key={field} className="block">
            <span className="block text-[10px] text-muted">
              {field === 'flights'
                ? t('overview.flightThreshold')
                : field === 'airtime'
                  ? t('overview.airtimeThreshold')
                  : t('overview.daysThreshold')}
            </span>
            <input
              type="number"
              min={field === 'airtime' ? 0.1 : 1}
              step={field === 'airtime' ? 0.5 : 1}
              value={draft[type][field]}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setDraft((prev) => ({
                  ...prev,
                  [type]: { ...prev[type], [field]: Number.isNaN(v) ? 0 : v },
                }));
              }}
              onBlur={() => {
                const v = draft[type][field];
                if (v > 0) setMaintenanceThreshold(type, field, v);
              }}
              className="mt-0.5 h-7 w-full rounded border border-line bg-canvas px-2 font-mono text-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="mx-4 mt-2 flex flex-wrap gap-4 rounded-md border border-line bg-canvas p-3">
      {renderGroup('battery')}
      {renderGroup('aircraft')}
    </div>
  );
}

// =============================================================================
// D2. Battery capacity trend chart
// =============================================================================

function BatteryCapacityChart({
  capacityHistory,
  batteriesSeen,
  getBatteryDisplayName,
  batteryPairIndex,
  resolvedTheme,
  dateLocale,
}: {
  capacityHistory: Map<string, [number, string, number][]>;
  batteriesSeen: EquipmentItem[];
  getBatteryDisplayName: (serial: string) => string;
  batteryPairIndex: BatteryPairIndex;
  resolvedTheme: 'dark' | 'light';
  dateLocale: string;
}) {
  const { t } = useTranslation();
  const isLight = resolvedTheme === 'light';
  const colors = useMemo(() => chartColors(), [isLight]);
  const seriesPalette = useMemo(
    () => [colors.accent, colors.track, colors.warning, colors.danger, colors.muted],
    [colors],
  );

  const availableSerials = useMemo(
    () =>
      batteriesSeen
        .flatMap((i) => i.groupSerials)
        .filter((s) => capacityHistory.has(normalizeSerial(s))),
    [batteriesSeen, capacityHistory],
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Default-select the first battery with data once the fetch lands.
  useEffect(() => {
    if (!initialized.current && availableSerials.length > 0) {
      setSelected([availableSerials[0]]);
      initialized.current = true;
    }
  }, [availableSerials]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayNameFor = useCallback(
    (serial: string) =>
      getPairedBatteryDisplayName(normalizeSerial(serial), batteryPairIndex, getBatteryDisplayName),
    [batteryPairIndex, getBatteryDisplayName],
  );

  const optionSerials = useMemo(() => {
    let list = availableSerials;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => displayNameFor(s).toLowerCase().includes(q) || s.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const aSel = selected.includes(a);
      const bSel = selected.includes(b);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return 0;
    });
  }, [availableSerials, search, selected, displayNameFor]);

  const capacitySeries = useMemo(
    () =>
      selected
        .filter((s) => capacityHistory.has(s))
        .flatMap((serial, idx) => {
          const color = seriesPalette[idx % seriesPalette.length];
          const points = capacityHistory.get(serial)!;
          const data = points
            .map(([, startTime, maxCap]) => {
              const time = Date.parse(startTime);
              if (!Number.isFinite(time)) return null;
              return [time, Math.round(maxCap)] as [number, number];
            })
            .filter((p): p is [number, number] => p !== null);
          const name = displayNameFor(serial);
          const series: Array<{
            name: string;
            type: 'line' | 'scatter';
            smooth?: boolean;
            showSymbol?: boolean;
            connectNulls?: boolean;
            symbolSize?: number;
            data: [number, number][];
            lineStyle?: { color: string };
            itemStyle?: { color: string };
          }> = [];
          if (data.length > 1) {
            series.push({
              name,
              type: 'line',
              smooth: true,
              showSymbol: false,
              connectNulls: true,
              data,
              lineStyle: { color },
              itemStyle: { color },
            });
          }
          series.push({ name, type: 'scatter', symbolSize: 7, data, itemStyle: { color } });
          return series;
        }),
    [capacityHistory, selected, displayNameFor, seriesPalette],
  );

  if (availableSerials.length === 0) return null;

  const allY = capacitySeries.flatMap((s) => (s.data as [number, number][]).map((p) => p[1]));
  const yMax = Math.max(500, ...allY);

  const chartOption = {
    textStyle: { fontFamily: chartFontFamily() },
    title: {
      text: t('overview.batteryCapacityHistory'),
      left: 'center',
      textStyle: { color: colors.ink, fontSize: 12, fontWeight: 'normal' as const },
    },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: colors.elevated,
      borderColor: colors.line,
      textStyle: { color: colors.ink },
      formatter: (params: Array<{ seriesName: string; value: [number, number] }>) => {
        if (!params?.length) return '';
        const dateLabel = params[0].value?.[0]
          ? formatDateNumeric(new Date(params[0].value[0]), dateLocale)
          : t('overview.unknownDate');
        const seen = new Set<string>();
        const lines = params
          .filter((item) => {
            if (seen.has(item.seriesName)) return false;
            seen.add(item.seriesName);
            return true;
          })
          .map((item) => `${item.seriesName}: ${item.value[1]} mAh`)
          .join('<br/>');
        return `<strong>${dateLabel}</strong><br/>${lines}`;
      },
    },
    legend: {
      type: 'scroll' as const,
      bottom: 0,
      data: [...new Set(capacitySeries.map((s) => s.name as string))],
      textStyle: { color: colors.muted, fontSize: 11 },
    },
    grid: { left: 16, right: 16, top: 40, bottom: 52, containLabel: true },
    xAxis: {
      type: 'time' as const,
      axisLine: { lineStyle: { color: colors.line } },
      axisLabel: { color: colors.muted, fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: yMax,
      name: 'mAh',
      nameTextStyle: { color: colors.muted, fontSize: 10 },
      axisLabel: { color: colors.muted, fontSize: 10 },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    dataZoom: [{ type: 'inside' as const, xAxisIndex: 0, filterMode: 'filter' as const }],
    series: capacitySeries,
  };

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted">{t('overview.batteryCapacityHistory')}</h3>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            className="flex items-center gap-1.5 rounded border border-line bg-canvas px-2 py-1 text-xs text-ink transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="max-w-[180px] truncate">
              {selected.length > 0 ? selected.map(displayNameFor).join(', ') : t('overview.selectBatteries')}
            </span>
            <ChevronRightIcon className="h-3 w-3 rotate-90 text-faint" />
          </button>
          {dropdownOpen && (
            <div
              role="listbox"
              aria-label={t('overview.selectBatteries')}
              className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-[var(--skydra-radius-lg)] border border-line bg-elevated shadow-overlay"
            >
              <div className="p-1.5">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('overview.searchBatteries')}
                  aria-label={t('overview.searchBatteries')}
                  className="w-full rounded border border-line bg-canvas px-2 py-1 text-xs text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  autoFocus
                />
              </div>
              <div className="max-h-[160px] overflow-y-auto">
                {optionSerials.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted">{t('overview.noSearchResults')}</p>
                ) : (
                  optionSerials.map((serial) => {
                    const checked = selected.includes(serial);
                    return (
                      <button
                        key={serial}
                        type="button"
                        role="option"
                        aria-selected={checked}
                        onClick={() =>
                          setSelected((prev) =>
                            prev.includes(serial) ? prev.filter((s) => s !== serial) : [...prev, serial],
                          )
                        }
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border',
                            checked ? 'border-accent bg-accent' : 'border-line-strong',
                          )}
                        >
                          {checked && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--skydra-accent-ink))" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span className="truncate">{displayNameFor(serial)}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {selected.length > 0 && (
                <div className="border-t border-line px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setSelected([])}
                    className="text-[10px] text-muted hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    {t('overview.clearBatterySelection')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {capacitySeries.length > 0 ? (
        <div className="h-[260px]">
          <ReactECharts option={chartOption} notMerge={true} style={{ height: '100%' }} />
        </div>
      ) : (
        <p className="text-xs text-muted">{t('overview.noCapacityData')}</p>
      )}
    </div>
  );
}

// =============================================================================
// E1. Activity heatmap — real focusable cells, single-activate filtering
// =============================================================================

function ActivityHeatmapCard({
  flightsByDate,
  isLight,
  onActivateDate,
  onOpenFlights,
}: {
  flightsByDate: { date: string; count: number }[];
  isLight: boolean;
  onActivateDate?: (date: Date) => void;
  onOpenFlights?: () => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useFlightStore((state) => state.dateLocale);
  const appLanguage = useFlightStore((state) => state.appLanguage);
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  oneYearAgo.setDate(oneYearAgo.getDate() + 1);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: oneYearAgo, to: today });
  const [pickingDate, setPickingDate] = useState<'from' | 'to' | null>(null);
  const [appliedFilter, setAppliedFilter] = useState<string | null>(null);
  const fromButtonRef = useRef<HTMLButtonElement>(null);
  const toButtonRef = useRef<HTMLButtonElement>(null);
  const [dateAnchor, setDateAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const ref = pickingDate === 'from' ? fromButtonRef.current : toButtonRef.current;
    if (pickingDate && ref) {
      const rect = ref.getBoundingClientRect();
      setDateAnchor({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 330),
        width: 320,
      });
    }
  }, [pickingDate]);

  const formatDate = (d: Date | undefined) => (d ? fmtDateDisplay(d, dateLocale, appLanguage) : '—');

  const filteredByDate = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return flightsByDate;
    const fromStr = dateRange.from.toISOString().split('T')[0];
    const toStr = dateRange.to.toISOString().split('T')[0];
    return flightsByDate.filter((f) => f.date >= fromStr && f.date <= toStr);
  }, [flightsByDate, dateRange]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    if (pickingDate === 'from') {
      const newTo = dateRange?.to && date > dateRange.to ? date : dateRange?.to;
      setDateRange({ from: date, to: newTo });
    } else if (pickingDate === 'to') {
      const newFrom = dateRange?.from && date < dateRange.from ? date : dateRange?.from;
      setDateRange({ from: newFrom, to: date });
    }
    setPickingDate(null);
  };

  const handleActivate = (date: Date) => {
    onActivateDate?.(date);
    setAppliedFilter(formatDateNumeric(date, dateLocale));
  };

  return (
    <section
      aria-labelledby="overview-activity-heading"
      className="rounded-[var(--skydra-radius-lg)] border border-line bg-surface p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="overview-activity-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('overview.flightActivity')}
        </h2>
        <div className="flex items-center gap-1 text-xs text-muted">
          <CalendarIcon />
          <button
            ref={fromButtonRef}
            type="button"
            onClick={() => setPickingDate(pickingDate === 'from' ? null : 'from')}
            aria-label={t('overview.selectStartDate')}
            className={cn(
              'rounded px-1.5 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              pickingDate === 'from' ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink hover:bg-elevated',
            )}
          >
            {formatDate(dateRange?.from)}
          </button>
          <span aria-hidden="true" className="text-faint">–</span>
          <button
            ref={toButtonRef}
            type="button"
            onClick={() => setPickingDate(pickingDate === 'to' ? null : 'to')}
            aria-label={t('overview.selectEndDate')}
            className={cn(
              'rounded px-1.5 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              pickingDate === 'to' ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink hover:bg-elevated',
            )}
          >
            {formatDate(dateRange?.to)}
          </button>
        </div>
      </div>

      <DatePickerPopover
        isOpen={!!(pickingDate && dateAnchor)}
        onClose={() => setPickingDate(null)}
        isLight={isLight}
        mode="single"
        selected={pickingDate === 'from' ? dateRange?.from : dateRange?.to}
        onSelect={handleDateSelect}
        disabled={{ after: today }}
        defaultMonth={pickingDate === 'from' ? dateRange?.from : dateRange?.to}
        jumpMaxDate={today}
        onJumpDate={(date) => handleDateSelect(date)}
        title={pickingDate === 'from' ? t('overview.selectStartDate') : t('overview.selectEndDate')}
        style={dateAnchor ? { top: dateAnchor.top, left: dateAnchor.left, width: dateAnchor.width } : undefined}
        footer={(
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setDateRange({ from: oneYearAgo, to: today });
                setPickingDate(null);
              }}
              className="text-xs text-muted hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {t('overview.resetTo365')}
            </button>
            <button
              type="button"
              onClick={() => setPickingDate(null)}
              className="text-xs text-ink hover:text-accent rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {t('overview.done')}
            </button>
          </div>
        )}
      />

      <ActivityHeatmap
        flightsByDate={filteredByDate}
        dateRange={dateRange}
        onActivateDate={handleActivate}
      />

      {appliedFilter && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span>{t('overview.filterApplied', { date: appliedFilter })}</span>
          {onOpenFlights && (
            <button
              type="button"
              onClick={onOpenFlights}
              className="text-accent hover:text-accent-hover rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {t('overview.viewAll')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

interface HeatmapCell {
  date: Date;
  count: number; // -1 = out of range placeholder
}

function ActivityHeatmap({
  flightsByDate,
  dateRange,
  onActivateDate,
}: {
  flightsByDate: { date: string; count: number }[];
  dateRange?: DateRange;
  onActivateDate?: (date: Date) => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useFlightStore((state) => state.dateLocale);
  const appLanguage = useFlightStore((state) => state.appLanguage);
  const labelWidth = 28;
  const gapSize = 2;
  const cellSize = 13;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);

  const { grid, months, maxCount, weekCount, flatCells } = useMemo(() => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const toDateKey = (date: Date) =>
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    const dateMap = new Map<string, number>();
    flightsByDate.forEach((f) => dateMap.set(f.date, f.count));

    const endDate = dateRange?.to ?? new Date();
    const startDateRaw = dateRange?.from ?? (() => {
      const d = new Date(endDate);
      d.setFullYear(d.getFullYear() - 1);
      d.setDate(d.getDate() + 1);
      return d;
    })();

    const startDate = new Date(startDateRaw);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const weeks: HeatmapCell[][] = [];
    const flatCells: { cell: HeatmapCell; flatIdx: number }[] = [];
    const currentDate = new Date(startDate);
    let maxCount = 0;
    let flat = 0;

    while (currentDate <= endDate) {
      const week: HeatmapCell[] = [];
      for (let day = 0; day < 7; day++) {
        if (currentDate <= endDate && currentDate >= startDateRaw) {
          const cell = { date: new Date(currentDate), count: dateMap.get(toDateKey(currentDate)) || 0 };
          maxCount = Math.max(maxCount, cell.count);
          week.push(cell);
          flatCells.push({ cell, flatIdx: flat });
          flat++;
        } else {
          week.push({ date: new Date(currentDate), count: -1 });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    const months: { label: string; col: number }[] = [];
    let lastMonth = -1;
    let lastShownCol = -999;
    const minLabelGapCols = 3;
    weeks.forEach((week, weekIdx) => {
      const firstValidDay = week.find((d) => d.count >= 0);
      if (firstValidDay) {
        const month = firstValidDay.date.getMonth();
        if (month !== lastMonth) {
          if (weekIdx - lastShownCol >= minLabelGapCols) {
            months.push({
              label: firstValidDay.date.toLocaleDateString(appLanguage || 'en', { month: 'short' }),
              col: weekIdx,
            });
            lastShownCol = weekIdx;
          }
          lastMonth = month;
        }
      }
    });

    return { grid: weeks, months, maxCount, weekCount: weeks.length, flatCells };
  }, [flightsByDate, dateRange, appLanguage]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = 0;
  }, [weekCount, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  // Token-derived cell fill: empty = grid token, filled = track ramp by intensity.
  const cellColor = (count: number): string => {
    if (count < 0) return 'transparent';
    if (count === 0) return 'rgb(var(--skydra-grid))';
    const intensity = Math.min(count / Math.max(maxCount, 1), 1);
    return `rgb(var(--skydra-track) / ${(0.25 + 0.75 * intensity).toFixed(2)})`;
  };

  const focusCell = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, flatCells.length - 1));
    setFocusIdx(clamped);
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`[data-flat="${flatCells[clamped]?.flatIdx}"]`);
    el?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flatCells.length === 0) return;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = focusIdx + 1;
    else if (e.key === 'ArrowLeft') next = focusIdx - 1;
    else if (e.key === 'ArrowDown') next = focusIdx + 7;
    else if (e.key === 'ArrowUp') next = focusIdx - 7;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = flatCells.length - 1;
    if (next === null) return;
    e.preventDefault();
    focusCell(next);
  };

  const dayLabels = [
    t('overview.sun'), t('overview.mon'), t('overview.tue'), t('overview.wed'),
    t('overview.thu'), t('overview.fri'), t('overview.sat'),
  ];

  const contentWidth = weekCount * cellSize + Math.max(weekCount - 1, 0) * gapSize + labelWidth * 2;
  const maxWidth = 1170;

  // Map cell -> flat index for rendering
  const flatIndexOf = new Map<HeatmapCell, number>();
  flatCells.forEach(({ cell, flatIdx }) => flatIndexOf.set(cell, flatIdx));

  return (
    <div className="w-full overflow-x-auto" ref={scrollRef}>
      <div className="flex flex-col min-w-max" style={{ width: `${Math.min(maxWidth, contentWidth)}px`, minWidth: `${contentWidth}px` }}>
        {/* Month labels */}
        <div
          aria-hidden="true"
          className="grid text-[10px] text-faint mb-1"
          style={{
            gridTemplateColumns: `repeat(${weekCount}, ${cellSize}px)`,
            marginLeft: `${labelWidth}px`,
            columnGap: `${gapSize}px`,
            paddingRight: `${labelWidth}px`,
          }}
        >
          {months.map((m, i) => (
            <div key={i} style={{ gridColumnStart: m.col + 1 }}>
              {m.label}
            </div>
          ))}
        </div>

        <div className="flex" style={{ columnGap: `${gapSize}px` }}>
          {/* Day labels */}
          <div
            aria-hidden="true"
            className="flex flex-col text-[10px] text-faint"
            style={{ rowGap: `${gapSize}px`, width: `${labelWidth}px` }}
          >
            {dayLabels.map((d, i) => (
              <div key={i} style={{ height: cellSize }} className="flex items-center">
                {i % 2 === 1 ? d : ''}
              </div>
            ))}
          </div>

          {/* Weeks — one tab stop, arrow-key navigation across cells */}
          <div
            ref={gridRef}
            role="group"
            aria-label={t('overview.flightActivity')}
            onKeyDown={handleKeyDown}
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${weekCount}, ${cellSize}px)`,
              gridTemplateRows: `repeat(7, ${cellSize}px)`,
              columnGap: `${gapSize}px`,
              rowGap: `${gapSize}px`,
            }}
          >
            {grid.map((week, weekIdx) =>
              week.map((day, dayIdx) => {
                const flatIdx = flatIndexOf.get(day);
                if (flatIdx === undefined) {
                  return (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      aria-hidden="true"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        gridColumnStart: weekIdx + 1,
                        gridRowStart: dayIdx + 1,
                      }}
                    />
                  );
                }
                const tooltip = t('overview.heatmapCell', {
                  date: formatDateNumeric(day.date, dateLocale),
                  count: day.count,
                });
                return (
                  <button
                    key={`${weekIdx}-${dayIdx}`}
                    type="button"
                    data-flat={flatIdx}
                    tabIndex={flatIdx === focusIdx ? 0 : -1}
                    aria-label={tooltip}
                    title={tooltip}
                    onClick={() => onActivateDate?.(day.date)}
                    onFocus={() => setFocusIdx(flatIdx)}
                    className="rounded-[2px] transition-shadow hover:ring-1 hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      gridColumnStart: weekIdx + 1,
                      gridRowStart: dayIdx + 1,
                      backgroundColor: cellColor(day.count),
                    }}
                  />
                );
              }),
            )}
          </div>

          <div style={{ width: `${labelWidth}px` }} />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-2 text-[10px] text-faint">
          <span>{t('overview.less')}</span>
          <div className="flex gap-0.5">
            {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
              <div
                key={i}
                className="w-[10px] h-[10px] rounded-[2px]"
                style={{
                  backgroundColor:
                    i === 0
                      ? 'rgb(var(--skydra-grid))'
                      : `rgb(var(--skydra-track) / ${(0.25 + 0.75 * intensity).toFixed(2)})`,
                }}
              />
            ))}
          </div>
          <span>{t('overview.more')}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// E2. Flight records — curated best-of rows
// =============================================================================

function FlightRecords({
  flights,
  unitPrefs,
  locale,
  dateLocale,
  onSelectFlight,
}: {
  flights: Flight[];
  unitPrefs: UnitPreferences;
  locale: string;
  dateLocale: string;
  onSelectFlight?: (flightId: number) => void;
}) {
  const { t } = useTranslation();
  const records = useMemo(() => {
    const rows: { label: string; flight: Flight; value: string }[] = [];
    const longest = flights.reduce<Flight | null>(
      (best, f) => ((f.durationSecs ?? 0) > (best?.durationSecs ?? 0) ? f : best),
      null,
    );
    if (longest) {
      rows.push({ label: t('overview.longestFlight'), flight: longest, value: formatDuration(longest.durationSecs) });
    }
    const highest = flights.reduce<Flight | null>(
      (best, f) => ((f.maxAltitude ?? 0) > (best?.maxAltitude ?? 0) ? f : best),
      null,
    );
    if (highest) {
      rows.push({
        label: t('overview.highestAltitude'),
        flight: highest,
        value: formatAltitude(highest.maxAltitude, unitPrefs.altitude, locale),
      });
    }
    const furthest = flights.reduce<Flight | null>(
      (best, f) => ((f.totalDistance ?? 0) > (best?.totalDistance ?? 0) ? f : best),
      null,
    );
    if (furthest) {
      rows.push({
        label: t('overview.furthestDistance'),
        flight: furthest,
        value: formatDistance(furthest.totalDistance, unitPrefs.distance, locale),
      });
    }
    // Deduplicate when one flight holds multiple records
    return rows.filter((row, i, arr) => arr.findIndex((r) => r.flight.id === row.flight.id && r.label === row.label) === i);
  }, [flights, unitPrefs, locale, t]);

  return (
    <section
      aria-labelledby="overview-records-heading"
      className="rounded-[var(--skydra-radius-lg)] border border-line bg-surface p-4"
    >
      <h2 id="overview-records-heading" className="text-xs font-semibold uppercase tracking-wide text-muted">
        {t('overview.recordsTitle')}
      </h2>
      {records.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t('overview.noFlightsAvailable')}</p>
      ) : (
        <ul className="mt-1">
          {records.map((row) => (
            <li key={row.label}>
              <button
                type="button"
                onClick={() => onSelectFlight?.(row.flight.id)}
                className="w-full flex items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                title={t('overview.openFlight', { name: row.flight.displayName || row.flight.fileName })}
              >
                <span className="w-28 flex-shrink-0 text-[11px] text-muted">{row.label}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {row.flight.displayName || row.flight.fileName}
                  </span>
                  <span className="block text-[11px] text-faint">
                    {formatDateNumeric(new Date(row.flight.startTime ?? ''), dateLocale)}
                  </span>
                </span>
                <span className="flex-shrink-0 font-mono text-xs text-ink">{row.value}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// =============================================================================
// Icons
// =============================================================================

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-faint"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
