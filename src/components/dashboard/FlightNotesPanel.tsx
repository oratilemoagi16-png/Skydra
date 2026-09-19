/**
 * Notes panel — the workspace detail-rail version of the old notes modal:
 * view + inline-edit flight notes bound to the store.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlightStore } from '@/stores/flightStore';

interface FlightNotesPanelProps {
  flightId: number;
  notes: string | null;
}

export function FlightNotesPanel({ flightId, notes }: FlightNotesPanelProps) {
  const { t } = useTranslation();
  const updateFlightNotes = useFlightStore((s) => s.updateFlightNotes);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? '');

  // Reset the editor when switching between flights
  useEffect(() => {
    setIsEditing(false);
    setDraft(notes ?? '');
  }, [flightId, notes]);

  const save = async () => {
    const trimmed = draft.trim();
    await updateFlightNotes(flightId, trimmed.length > 0 ? trimmed : null);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="p-4">
        {notes ? (
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">{notes}</p>
        ) : (
          <p className="text-sm text-faint italic">{t('flightList.addNotePlaceholder')}</p>
        )}
        <button
          type="button"
          onClick={() => {
            setDraft(notes ?? '');
            setIsEditing(true);
          }}
          className="mt-3 px-3 py-1.5 text-sm rounded-lg border border-line text-muted hover:text-ink hover:bg-elevated transition-colors"
        >
          {notes ? t('flightList.editNotes') : t('flightList.addNotes')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, 500))}
        placeholder={t('flightList.addNotePlaceholder')}
        aria-label={t('flightList.notes', 'Notes')}
        className="w-full h-32 px-3 py-2 rounded-lg bg-surface border border-line text-sm text-ink placeholder-faint resize-none focus:outline-none focus:border-accent"
        autoFocus
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-faint font-mono tabular-nums">{draft.length}/500</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(notes ?? '');
              setIsEditing(false);
            }}
            className="px-3 py-1.5 text-sm text-muted hover:text-ink transition-colors"
          >
            {t('flightList.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            className="px-4 py-1.5 text-sm bg-accent text-accent-ink rounded-lg hover:bg-accent-hover transition-colors"
          >
            {t('flightList.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
