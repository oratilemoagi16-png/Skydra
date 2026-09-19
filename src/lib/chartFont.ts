/**
 * ECharts renders text on canvas and ignores inherited CSS fonts. Resolve the
 * Skydra font token stack once per chart so canvas text matches the UI font.
 */
export function chartFontFamily(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--skydra-font-sans').trim();
  return v || undefined;
}
