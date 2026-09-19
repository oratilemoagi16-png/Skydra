# Design-foundation visual review — PR #13

**Reviewed:** `skydra/main` @ `c70814c` (semantic tokens, Geist typography, floating bottom dock, ImportSheet, TopBar)
**Method:** judged the rendered product, not the diff — app run in web mode (`cargo run --features web` + `vite`), seeded with 5 demo flights, driven as a user at 1280×800 desktop and 420×800 mobile in dark and light themes. All screenshots committed under `docs/review/shots/`.
**Verdict standard:** does it read as deliberately-designed professional ops software, or AI-generated/generic?

---

## VERDICT: SHIP-WITH-FIXES

The foundation is real and mostly right: the token architecture is sound, the charcoal/orange direction is on-brief, the dock is functional and keyboard-navigable, and Import-as-action is implemented correctly. Nothing requires structural redesign.

But it is not yet *clean*. The app still ships a second, unacknowledged color system (cyan, indigo, navy, rainbow chart hues) on top of the new tokens, several accent/status pairs fail WCAG AA, and the map — the surface that should carry the product — is still wrapped in legacy navy furniture. These are fixable defects, not direction errors. They must land **before the Overview wave merges**, or that wave inherits the confetti and bakes it in.

---

## What works (and why it reads professional)

- **Token architecture.** `--skydra-*` triplets with `<alpha-value>`, semantic names (canvas/surface/elevated, ink/muted/faint, line, accent, danger/warning/success, track), and the `--drone-*` bridge redeclared under `body.theme-light` — the author understood `var()` computes at the declaring element. This is a real system, not a theme toggle.
- **Charcoal/off-white foundation.** `#191A1C` page / `#222326` chrome / `#2C2E32` elevated is disciplined and matches the FlytBase-class references in the research doc. Borders are 1px and quiet.
- **Typography.** Geist self-hosted via `@fontsource` (no CDN), Geist wired into ECharts canvas text via `chartFontFamily()` — the detail most migrations miss. Serials/timestamps render in Geist Mono (`SN: FCM4-2201`, `BATM4-0033` chips) — reads as instruments, correctly.
- **Dock.** Compact, one elevation tier reserved for floating UI, active = accent icon pill + label, `aria-current="page"`, roving tabindex with Arrow/Home/End verified working, focus ring clearly visible (`shots/42`), Import busy-spinner state exists. See `shots/10-dock-rest.png`.
- **Import-as-action.** Dialog on desktop, bottom sheet on mobile, Esc/backdrop/X all close it, the importer stays mounted so background sync survives, and an empty profile auto-opens it once — a genuinely good first-run affordance (`shots/51`).
- **74px reservation.** Content clears the dock at scroll end on both themes and sizes; `--mobile-safe-bottom` composes correctly.
- **Status layer exists separately from accent.** danger/warning/success are their own tokens; the new shell never uses orange for status.
- **Empty state** is quiet and the zero-data Overview + auto-opened import sheet works (`shots/51`, `52`).

## Findings — ranked by severity

### B1 — A second color system leaks everywhere the tokens didn't reach (BLOCKER)

Verified literals still rendering:

| Where | What renders | Evidence |
|---|---|---|
| `btn-primary` | **hover turns literal `bg-blue-500`** — computed `rgb(59,130,246)` on an orange button | `shots/70`, `36` |
| Activity heatmap | blue→cyan ramp `rgb(20,80,110)→rgb(20,230,230)` | `shots/63` |
| Milestone/rank strip | cyan gradient `#0ea5e9→#06b6d4→#14b8a6` + "Get Signature" CTA | `shots/01`, `63` |
| Flight-cluster map | indigo ramp `#6366f1→#3730a3`, indigo-gradient popup header, neon `#eaff3b`/`#f4ff57` heat layer, emerald `#10b981` markers | `shots/63` |
| Time-of-day radar | multicolor spokes (purple/green/orange) | `shots/01`, `63` |
| Map chrome | navy `#16213e`/`#4a4e69` ctrl group + scrollbar + replay-track remainder | `shots/22`, `35` |
| `themed-select` dropdown | `#0f0f1a` navy | code |
| Flight detail | teal `drone-accent` Export CTA; teal/violet tag chips | `shots/02`, `32` |
| Settings modal | teal Regenerate, orange Remove, amber Blacklist, bare-red "Clear Project Database" | `shots/03`, `23` |

**Why it reads unprofessional:** the design contract is charcoal + off-white + *one* orange + a fixed red/amber/green status layer. The rendered app shows ~6 unrelated hues. This is the single strongest "reskinned open-source utility" signal in the product — and every donut, cluster dot, and hover-blue button is a surface the Overview wave is about to inherit.

**Fix direction:** sweep `index.css` component classes (`btn-primary`, `btn-secondary`, `card`, `stat-card`, `themed-select`, scrollbar, `maplibregl-ctrl-*`, `replay-slider` remainder, `milestone-timeline`) and the chart/map literal palettes onto tokens before the Overview wave starts; then gate it — no literal hex in new components. Delete `hover:bg-blue-500` first; it's the most egregious single line in the codebase right now.

### B2 — Accent/status contrast fails AA in light theme and on hover (BLOCKER)

Measured (WCAG contrast ratios):

| Pair | Ratio | Verdict |
|---|---|---|
| accent text on light surface `#C24F1E`/`#EAE8E2` | **3.87** | fails AA for the 10px dock active label |
| accent-ink on accent-hover `#FFF`/`#E9753E` | **2.97** | fails even AA-large on hover |
| warning on light canvas `#9E6406`/`#F3F2EE` | **4.38** | fails AA small text |
| danger on dark elevated `#E5484D`/`#2C2E32` | **3.48** | fails AA small text (cards, dock surface) |
| muted on light surface `#6B6963`/`#EAE8E2` | **4.48** | marginal fail on chrome panels |
| ink, muted dark, focus rings, success | 4.7–16.9 | pass |

**Why:** the FlytBase spec Skydra is modeled on treats its muted floor (`#8A8A8A`) as an accessibility rule, not a vibe. An ops tool with illegible accent labels and vanishing hover contrast reads sloppy to exactly the audience it's for.

**Fix direction:** darken the light-theme accent text step (~`#A8430F`-class) or raise label size/weight; pick `accent-hover` so white-on-it stays ≥3:1 (darken hover rather than lighten); retune light warning and dark danger for the surfaces they actually sit on.

### B3 — At 1280px the map is below the fold (BLOCKER for Flights wave; flag now)

`SIDE_BY_SIDE_MIN_WIDTH = 1028` of *panel* width + the 340px rail means side-by-side telemetry+map only engages at ≈1368px viewport. At 1280 — the most common laptop class — the Flights workspace stacks: stat pills → telemetry card → map under the fold (`shots/02`, `21`).

**Why:** the research doc's core rule — map is the dominant working surface, ≥50–60% of the view — is violated on a mainstream laptop exactly when the rail is open. The layout constants live in `Dashboard.tsx` (shared shell), so this is foundation-owned even though the Flights wave will be the one to feel it.

**Fix direction:** lower `TELEMETRY_MIN_NORMAL_WIDTH`/rebalance the stack trigger, or auto-collapse the rail on selection below ~1440px. Decide the map-dominant geometry before the Flights wave builds on it.

### B4 — Map furniture is legacy-styled and eats the canvas (BLOCKER for the map zone of Overview)

- `Map Settings` panel defaults **expanded on desktop**, covering ~35% of the map at 1280 and ~55% at 420px (`shots/05`, `22`, `35`). It persists via sessionStorage, so a user can leave the canvas permanently occluded.
- The panel itself is `bg-drone-dark/80 rounded-xl shadow-lg` — the old shape/elevation vocabulary, not the new "borders before shadows" language.
- Cluster-map popups use an indigo gradient header (`shots/63`).

**Why:** "de-chrome the canvas; the map owns the center" is the design doc's own rule; the current map shows a furniture panel, navy controls, and a pillowed overlay vocabulary over it.

**Fix direction:** default-collapse Map Settings on all viewports (or a single quiet gear button); tokenize `map-overlay`, `maplibregl-ctrl-group`, cluster colors, and popup header before the Overview wave mounts `FlightClusterMap` in its new layout.

### Medium

- **M1 — The dock's raised center Import FAB is the one element that reads "mobile-social nav bar."** It works, but the protruding accent square is the exact silhouette the design doc warns against. Options: flush square aligned with siblings, or accent-bordered neutral button — keep the prominence, lose the FAB language. (`shots/10`, `42`)
- **M2 — Stat-pill values wrap unit onto a second line** ("94.4\nm", "22.9\nkm/h", `shots/02`, `32`). `whitespace-nowrap` + tabular mono numerals — instruments don't reflow.
- **M3 — Rank-progression strip + "Get Signature" CTA occupies the top of the operational Overview** (`shots/01`, `63`). Gamified marketing chrome where operational data should lead (FAA zoning rule; product doc bans promo surfaces in operational views). Overview wave must kill or rehouse it — flagged now so it isn't quietly restyled into the new system.
- **M4 — `track` green is doing double duty** as Export CTA and replay play button (`shots/02`, `22`). `--skydra-track` is defined for path/cursor; a green primary action reads as a second brand color and crowds the status layer. Map actions to accent or neutral.
- **M5 — Settings modal runs a rainbow action palette** (teal/orange/amber/red buttons, `shots/03`, `23`) and is untouched by tokens. Fine per sequencing (Settings is a later wave) — but it's the same palette leak as B1 and must be swept with it.
- **M6 — Sheets/modals don't trap focus.** ImportSheet sets `aria-modal` and focuses the panel on open, but Tab escapes behind the overlay.
- **M7 — `--skydra-faint` is defined but unused** (zero `text-faint` usages). Either wire it to placeholders/tertiary labels or drop it — dead tokens rot.
- **M8 — `* { @apply border-gray-700 }` base rule + the wall of `body.theme-light` `!important` overrides** is a fragile bridge: any new component using bare `border` gets gray-700, not `line`. Scheduled debt — make sure the migration plan includes its removal date, not just its existence.
- **Minor:** rail hide button is a literal `‹` glyph with a `pb-[2px]` hack; dock labels at 10px are small; dock `focusIndex` initializes to Overview regardless of the active view; scrollbar thumb is still navy `#4a4e69`.

## Blockers vs. backlog

**Must land before the Overview wave merges** (the wave builds on shared classes, map furniture, and accent tokens — these defects would be inherited, not fixed, downstream):

1. B1 palette sweep — kill the second color system in shared classes + charts + cluster map.
2. B2 contrast fixes — light accent text, accent-hover, warning/danger small text.
3. B4 map furniture — default-collapsed settings panel + tokenized map chrome (the Overview map zone mounts this component).
4. B3 layout thresholds — decide map-dominant geometry at ≥1280 now (foundation-owned constants in `Dashboard.tsx`).

**Follow-up backlog** (should fix, not blocking): M1 dock FAB silhouette, M2 nowrap numerals, M3 rank-strip removal decision (Overview wave owns), M4 action/track color split, M6 focus traps, M7/M8 token hygiene, minor craft items.

## Appendix — evidence

| Shot | Shows |
|---|---|
| `shots/01-overview-dark-1280.png` | Dark Overview: rank strip, KPI wall, cyan heatmap, rainbow radar |
| `shots/20-overview-light-1280.png` | Light Overview: card-wall float, cyan accents |
| `shots/63-overview-dark-full.png` | Full Overview: cluster map, indigo toggles, donuts, maintenance |
| `shots/02-flights-dark-1280.png` | Flights stacked at 1280 — map below fold; stat-pill wraps; teal Export |
| `shots/05` / `06` | Map region: expanded Map Settings panel over canvas, navy controls, replay bar |
| `shots/22-flights-light-map.png` | Light theme map: satellite tiles, green play, purple-ish scrub remainder |
| `shots/10-dock-rest.png`, `shots/42` | Dock rest state + focus ring on Import (keyboard nav verified) |
| `shots/04`, `shots/24`, `shots/36` | Import sheet: desktop dialog / light / mobile bottom sheet |
| `shots/03`, `shots/23` | Settings modal dark/light — rainbow action palette |
| `shots/32`, `shots/33`, `shots/35` | Mobile 420px: workspace, rail, map furniture coverage |
| `shots/51` | Empty state: auto-opened Import over zeroed Overview |
| `shots/70-manual-entry-hover.png` | `btn-primary` hover = literal blue (`rgb(59,130,246)`) |
