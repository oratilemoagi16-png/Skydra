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
 *
 * Reads document.body: theme-light overrides are declared on body, and body
 * still inherits the :root (dark) values when it carries no override.
 */
export function themeColor(varName: string, alpha?: number): string {
  if (typeof document === 'undefined' || !document.body) return '#000';
  const v = getComputedStyle(document.body).getPropertyValue(varName).trim();
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

/**
 * Muted categorical series palette for multi-series charts (cell voltages,
 * per-field telemetry, donuts). Anchored to the token hues — accent first,
 * then restrained steps — so charts stay on-system without implying status.
 */
export function chartSeries(): string[] {
  return [
    themeColor('--skydra-accent'),
    themeColor('--skydra-track'),
    themeColor('--skydra-warning'),
    '#5B8DB8', // steel blue
    '#9A7BAF', // plum
    '#C0798C', // rosewood
    '#8AA860', // sage
    '#C9605A', // brick
    '#B8A26A', // sand
    '#7D8CA3', // slate
    '#4FA3A5', // teal
    '#D98E4A', // apricot
  ];
}

/**
 * Resolve a chart color spec to a canvas-ready color:
 *  - 'var:--skydra-x' → live token value (theme-aware)
 *  - 'series:N'      → chartSeries()[N]
 *  - '#hex'/'rgb()'  → passed through (user color picks, literals)
 * Optional alpha produces an rgba() string.
 */
export function chartColor(spec: string, alpha?: number): string {
  let resolved: string;
  if (spec.startsWith('var:')) {
    resolved = themeColor(spec.slice(4));
  } else if (spec.startsWith('series:')) {
    resolved = chartSeries()[Number(spec.slice(7))] ?? '#888888';
  } else {
    resolved = spec;
  }
  if (alpha === undefined) return resolved;
  if (resolved.startsWith('rgb(')) {
    return `rgba(${resolved.slice(4, -1)}, ${alpha})`;
  }
  if (resolved.startsWith('#') && resolved.length === 7) {
    return resolved + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }
  return resolved;
}
