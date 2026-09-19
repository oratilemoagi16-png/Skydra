/**
 * Weather panel — historical weather at the flight's takeoff location & time,
 * rendered inside the workspace detail rail (previously a modal).
 * Data sourced from Open-Meteo Archive API (no API key required).
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchFlightWeather, fetchReverseGeocodeLocation } from '@/lib/weather';
import type { WeatherData } from '@/lib/weather';
import type { SpeedUnit, UnitSystem } from '@/lib/utils';
import { fmtNum, isImperialSpeedUnit, speedMultiplierFromMs, speedUnitLabel } from '@/lib/utils';
import { useFlightStore } from '@/stores/flightStore';

interface WeatherPanelProps {
  lat: number;
  lon: number;
  /** ISO-8601 date-time string of flight start */
  startTime: string;
  /** Unit system for temperature display */
  temperatureUnit: UnitSystem;
  /** Unit system for wind speed / precipitation / pressure display */
  speedUnit: SpeedUnit;
}

export function WeatherPanel({ lat, lon, startTime, temperatureUnit, speedUnit }: WeatherPanelProps) {
  const { t } = useTranslation();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setWeather(null);
    setLocationLabel(null);
    setLocationLoading(true);

    fetchFlightWeather(lat, lon, startTime)
      .then((w) => { if (!cancelled) setWeather(w); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    fetchReverseGeocodeLocation(lat, lon, useFlightStore.getState().locale, 'detailed')
      .then((l) => { if (!cancelled) setLocationLabel(l); })
      .catch(() => { if (!cancelled) setLocationLabel(null); })
      .finally(() => { if (!cancelled) setLocationLoading(false); });

    return () => { cancelled = true; };
  }, [lat, lon, startTime]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <svg className="w-7 h-7 text-accent animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
        <p className="mt-3 text-sm text-muted">{t('weather.fetching')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <ErrorIcon className="w-8 h-8 text-danger mb-3" />
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!weather) return null;

  const isTempImperial = temperatureUnit === 'imperial';
  const isSpeedImperial = isImperialSpeedUnit(speedUnit);
  const locale = useFlightStore.getState().locale;
  const fmtTemp = (c: number) =>
    isTempImperial ? `${fmtNum((c * 9) / 5 + 32, 1, locale)}°F` : `${fmtNum(c, 1, locale)}°C`;
  const fmtSpeed = (kmh: number) =>
    `${fmtNum((kmh / 3.6) * speedMultiplierFromMs(speedUnit), 1, locale)} ${speedUnitLabel(speedUnit)}`;
  const fmtPrecip = (mm: number) =>
    isSpeedImperial ? `${fmtNum(mm * 0.03937, 2, locale)} in` : `${fmtNum(mm, 1, locale)} mm`;
  const fmtPressure = (hPa: number) =>
    isSpeedImperial ? `${fmtNum(hPa * 0.02953, 2, locale)} inHg` : `${fmtNum(hPa, 0, locale)} hPa`;

  return (
    <div className="p-4">
      {/* Condition summary */}
      <div className="text-center mb-4">
        <p className="text-3xl font-bold text-ink font-mono tabular-nums">{fmtTemp(weather.temperature)}</p>
        <p className="text-sm text-muted mt-1">{weather.conditionLabel}</p>
      </div>

      {/* Reverse-geocoded home-point location */}
      <div className="mb-4 rounded-lg bg-surface/60 border border-line px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <LocationPinIcon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-faint">{t('weather.location')}</p>
            <p className="text-sm text-ink leading-snug break-words">
              {locationLoading
                ? t('weather.locationFetching')
                : (locationLabel ?? `${fmtNum(lat, 4, locale)}, ${fmtNum(lon, 4, locale)}`)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <WeatherStat
          icon={<ThermometerIcon className="w-5 h-5 text-warning" />}
          label={t('weather.feelsLike')}
          value={fmtTemp(weather.apparentTemperature)}
        />
        <WeatherStat
          icon={<WindIcon className="w-5 h-5 text-accent" />}
          label={t('weather.windSpeed')}
          value={fmtSpeed(weather.windSpeed)}
        />
        <WeatherStat
          icon={<WindSockIcon className="w-5 h-5 text-teal-400" />}
          label={t('weather.windGusts')}
          value={fmtSpeed(weather.windGusts)}
        />
        <WeatherStat
          icon={<DropletIcon className="w-5 h-5 text-sky-400" />}
          label={t('weather.humidity')}
          value={`${weather.humidity}%`}
        />
        <WeatherStat
          icon={<CloudIcon className="w-5 h-5 text-muted" />}
          label={t('weather.cloudCover')}
          value={`${weather.cloudCover}%`}
        />
        <WeatherStat
          icon={<RainIcon className="w-5 h-5 text-indigo-400" />}
          label={t('weather.precipitation')}
          value={fmtPrecip(weather.precipitation)}
        />
        <WeatherStat
          icon={<CompassIcon className="w-5 h-5 text-success" />}
          label={t('weather.windDirection')}
          value={`${weather.windDirection}° ${degToCardinal(weather.windDirection)}`}
        />
        <WeatherStat
          icon={<GaugeIcon className="w-5 h-5 text-violet-400" />}
          label={t('weather.pressure')}
          value={fmtPressure(weather.pressure)}
        />
      </div>

      {/* Footer */}
      <p className="text-[10px] text-faint text-center mt-4">
        {t('weather.attribution')}
      </p>
      <p className="text-[10px] text-faint text-center mt-1">
        {t('weather.locationAttribution')}
      </p>
    </div>
  );
}

function WeatherStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface/60 border border-line px-3 py-2.5">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-faint truncate">{label}</p>
        <p className="text-sm font-semibold text-ink truncate font-mono tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function degToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Icons (inline SVGs, theme-responsive via className)

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function ThermometerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9V3m0 6a3 3 0 100 6 3 3 0 000-6zm0 6v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0" />
    </svg>
  );
}

function WindIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h8.5a3.5 3.5 0 10-3.5-3.5M6 8h4.5a2.5 2.5 0 10-2.5-2.5M6 16h6.5a2.5 2.5 0 110 5H6" />
    </svg>
  );
}

function WindSockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18M3 6h13l-2 3 2 3H3" />
    </svg>
  );
}

function DropletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.5c-3.5 0-6.5-2.8-6.5-6.5 0-4.5 6.5-12 6.5-12s6.5 7.5 6.5 12c0 3.7-3 6.5-6.5 6.5z" />
    </svg>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
    </svg>
  );
}

function RainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 19v2m4-2v2m4-2v2" />
    </svg>
  );
}

function CompassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </svg>
  );
}

function GaugeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 110-18 9 9 0 010 18z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l3.5-3.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function LocationPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6-5.062 6-11a6 6 0 10-12 0c0 5.938 6 11 6 11z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}
