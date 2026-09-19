/**
 * Shared accessible modal primitive.
 *
 * Provides: portal to body, backdrop, role="dialog" + aria-modal +
 * aria-labelledby/aria-label wiring, focus moved into the dialog on open,
 * Tab focus trapping, Escape to close, focus restored to the trigger on
 * close, and body scroll-lock (modal-open class) while open.
 */

import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name target: id of the element labelling the dialog */
  labelledBy?: string;
  /** Accessible name when there is no visible label element */
  label?: string;
  /** dialog (default) or alertdialog for blocking/confirm contexts */
  role?: 'dialog' | 'alertdialog';
  /** className for the centred panel wrapper */
  className?: string;
  /** className for the outer positioning container */
  containerClassName?: string;
  /** when true, clicking the backdrop does NOT close (blocking overlays) */
  dismissable?: boolean;
  children: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  labelledBy,
  label,
  role = 'dialog',
  className = '',
  containerClassName = '',
  dismissable = true,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Capture trigger, move focus in, scroll-lock, Esc handling
  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.classList.add('modal-open');

    // Move focus into the dialog (first focusable, else the panel itself)
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panel).focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dismissable) {
          event.stopPropagation();
          onClose();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === firstEl || !panel.contains(active)) {
          event.preventDefault();
          lastEl.focus();
        }
      } else if (active === lastEl || !panel.contains(active)) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.body.classList.remove('modal-open');
      // Restore focus to the element that opened the dialog
      const trigger = restoreFocusRef.current;
      if (trigger && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [isOpen, onClose, dismissable]);

  const handleBackdropClick = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center p-4 overflow-y-auto mobile-safe-container ${containerClassName}`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        className={`relative z-10 my-auto outline-none ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
