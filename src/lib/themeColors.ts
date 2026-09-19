/**
 * Resolve Skydra CSS custom properties ("R G B" triplets) for non-DOM
 * contexts — ECharts canvas, MapLibre paint props, inline styles that cannot
 * use `rgb(var(--skydra-*))` directly. Values are read from <body> so the
 * theme-light overrides apply; resolved per call, so theme switches propagate
 * on the next render.
 */

export function themeColorTriplet(varName: string): [number, number, number] {
  if (typeof document === 'undefined') return [0, 0, 0];
  const raw = getComputedStyle(document.body).getPropertyValue(varName).trim();
  const [r, g, b] = raw.split(/\s+/).map(Number);
  return [r || 0, g || 0, b || 0];
}

/** e.g. themeColor('--skydra-accent') -> 'rgb(224, 99, 44)' */
export function themeColor(varName: string, alpha?: number): string {
  const [r, g, b] = themeColorTriplet(varName);
  return alpha === undefined
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Categorical series palette for charts/maps — a deliberately muted set
 * harmonized with the charcoal/orange token system (accent, track, warning
 * lead; the rest are restrained aviation hues). Static hexes because they are
 * consumed in both themes; keep in sync with --skydra-* values in index.css.
 */
export const SERIES = {
  accent: '#E0632C',   // --skydra-accent (dark); also fine on light surfaces
  track: '#2DBE8F',    // --skydra-track
  amber: '#E8A33D',    // --skydra-warning
  steel: '#5B8DB8',    // muted steel blue
  plum: '#9A7BAF',     // muted plum
  rosewood: '#C0798C', // muted rose
  sage: '#8AA860',     // sage green
  brick: '#C9605A',    // muted brick red
  sand: '#B8A26A',     // sand
  slate: '#7D8CA3',    // blue-slate neutral
  teal: '#4FA3A5',     // muted teal
  apricot: '#D98E4A',  // apricot
} as const;

export const CHART_SERIES: string[] = [
  SERIES.accent,
  SERIES.track,
  SERIES.amber,
  SERIES.steel,
  SERIES.plum,
  SERIES.rosewood,
  SERIES.sage,
  SERIES.brick,
  SERIES.sand,
  SERIES.slate,
  SERIES.teal,
  SERIES.apricot,
];
