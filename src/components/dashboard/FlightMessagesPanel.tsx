/**
 * Flight messages panel — the workspace detail-rail version of the old
 * FlightMessagesModal: scrollable tip/warn/caution list with clock + flight
 * time columns. Also exports the shared count formatter.
 */

import { useTranslation } from 'react-i18next';
import type { FlightMessage } from '@/types';
import { useFlightStore } from '@/stores/flightStore';
import { ensureAmPmUpperCase } from '@/lib/utils';

interface FlightMessagesPanelProps {
  messages: FlightMessage[];
  /** ISO string for flight start time, used to compute clock time */
  flightStartTime: string | null;
}

/** Format milliseconds offset as mm:ss */
export function formatFlightTimeMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Compute clock time string in local timezone from flight start ISO + offset ms */
export function formatMessageClockTime(flightStartTime: string | null, offsetMs: number, hour12 = true): string {
  if (!flightStartTime) return '—';
  try {
    const startMs = new Date(flightStartTime).getTime();
    if (isNaN(startMs)) return '—';
    const clockDate = new Date(startMs + offsetMs);
    return ensureAmPmUpperCase(clockDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12,
    }));
  } catch {
    return '—';
  }
}

export function FlightMessagesPanel({ messages, flightStartTime }: FlightMessagesPanelProps) {
  const { t } = useTranslation();
  const timeFormat = useFlightStore((state) => state.timeFormat);
  const hour12 = timeFormat !== '24h';

  const sorted = [...messages].sort((a, b) => a.timestampMs - b.timestampMs);

  return (
    <div className="flex flex-col min-h-0">
      {/* Column labels */}
      <div className="grid grid-cols-[52px_44px_1fr] gap-x-2 px-3 py-2 border-b border-line flex-shrink-0">
        <span className="text-[10px] font-medium uppercase tracking-wide text-faint">
          {t('dashboard.messagesColTime')}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-faint">
          {t('dashboard.messagesColFlight')}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-faint">
          {t('dashboard.messagesColMessage')}
        </span>
      </div>

      {/* Message list */}
      <div className="divide-y divide-line/50">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-faint text-sm">
            {t('dashboard.messagesEmpty')}
          </div>
        ) : (
          sorted.map((msg, idx) => {
            const isCaution = msg.messageType === 'caution';
            const isWarn = msg.messageType === 'warn';
            return (
              <div
                key={idx}
                className="grid grid-cols-[52px_44px_1fr] gap-x-2 items-baseline px-3 py-2.5"
              >
                <span className="text-[11px] font-medium text-ink tabular-nums leading-tight font-mono">
                  {formatMessageClockTime(flightStartTime, msg.timestampMs, hour12)}
                </span>
                <span className="text-[11px] tabular-nums text-muted leading-tight font-mono">
                  {formatFlightTimeMs(msg.timestampMs)}
                </span>
                <div className="flex items-start gap-2 min-w-0">
                  {isCaution ? (
                    <svg className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : isWarn ? (
                    <svg className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span
                    className={`text-[13px] leading-snug break-words min-w-0 ${isCaution ? 'text-danger' : isWarn ? 'text-warning' : 'text-ink'}`}
                  >
                    {msg.message}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
