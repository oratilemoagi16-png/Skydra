/**
 * ECharts renders text on canvas and ignores inherited CSS fonts. Resolve the
 * Skydra font token stack once per chart so canvas text matches the UI font.
 */
export function chartFontFamily(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--skydra-font-sans').trim();
  return v || undefined;
}

/**
 * Resolve a --skydra-* RGB-triplet CSS variable (e.g. '--skydra-accent') to a
 * canvas-friendly 'rgb(r, g, b)' / 'rgba(r, g, b, a)' string. Canvas and
 * MapLibre paint APIs cannot consume CSS vars, so charts read the live token
 * value at render time — this keeps them on the semantic palette.
 */
export function themeColor(varName: string, alpha?: number): string {
  if (typeof document === 'undefined') return '#000';
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!v) return '#000';
  const channels = v.split(/\s+/).join(', ');
  return alpha === undefined ? `rgb(${channels})` : `rgba(${channels}, ${alpha})`;
}

export function chartColors() {
  return {
    ink: themeColor('--skydra-text'),
    muted: themeColor('--skydra-muted'),
    faint: themeColor('--skydra-faint'),
    accent: themeColor('--skydra-accent'),
    track: themeColor('--skydra-track'),
    danger: themeColor('--skydra-danger'),
    warning: themeColor('--skydra-warning'),
    success: themeColor('--skydra-success'),
    line: themeColor('--skydra-border'),
    grid: themeColor('--skydra-grid'),
    elevated: themeColor('--skydra-elevated'),
  };
}
