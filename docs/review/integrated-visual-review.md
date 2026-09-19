# Integrated-product visual review — surface wave

**Reviewed:** `origin/skydra/main` @ `13ac5a7` — post-merge integrated state: new Overview (attention strip + dominant map + equipment rail), Flights three-zone workspace (list rail | map | tabbed detail rail | telemetry band), grouped Settings on a shared Modal primitive, About/Licenses/Source dialog, floating dock, Geist typography, completed palette sweep.
**Method:** ran the real app in web mode (`cargo run --no-default-features --features web` on :3001 + `VITE_BACKEND=web npm run dev` on :1420), seeded with `scripts/dev/seed_demo_data.py` (5 flights), driven as a user at 1280×800 and 420×800 (DevTools device emulation) in dark and light themes. All evidence committed under `docs/review/shots-integrated/`. Colors cited from `getComputedStyle`, not eyeballed pixels.
**Verdict standard:** does it read as deliberately-designed professional drone-ops software, or AI-generated/generic dashboard?

---

## VERDICT: SHIP-WITH-FIXES

This reads as deliberately designed. The palette sweep actually happened — every chrome surface, popup, hover state, and dialog inspected resolves to `--skydra-*` tokens or the documented `chartSeries()` categorical palette; the confetti era is over. The Flights workspace is a real three-zone ops surface with a working shared cursor, grouped Settings on a real Modal primitive passes a live focus-trap test, and the About/Licenses/Source tabs discharge the AGPL obligations with unusual care. On evidence alone this would pass a "reskinned open-source utility?" sniff test — it doesn't look like one.

It is not a clean SHIP because three compositional defects and two correctness bugs survive: the map is letterboxed by its own telemetry band at default geometry, the Overview map ships permanently-open furniture that duplicates the exact defect the foundation review killed, Map Settings overflows the map zone it floats on, and there is an i18n interpolation leak on every row-actions button plus a labels duplicate in Settings. All fixable without rethinking the system — hence SHIP-WITH-FIXES, not REDESIGN.

---

## Prior blockers — verified in the render, not the diff

| Foundation finding | Verdict | Evidence |
|---|---|---|
| `btn-primary` hover = literal blue | **FIXED** — hover computes `rgb(212,100,43)` dark / `rgb(143,53,9)` light | `21-btn-primary-hover-dark.png`, `35-…-light.png` |
| Indigo cluster ramp / popup header | **FIXED** — cluster ramp is accent-orange (`#FFB25E`-family); popup is a tokenized dark panel with orange stat icons | `03-cluster-popup-dark-1280.png` |
| Neon `#eaff3b` heat layer | **FIXED** — Heatmap toggle renders subtle orange rings | `04-cluster-heatmap-on-dark-1280.png` |
| Cyan activity heatmap | **FIXED but misapplied token** — now `rgb(var(--skydra-track))` → renders GitHub-green (see F6) | `02-overview-dark-1280-bottom.png` |
| Navy map chrome / purple replay remainder | **FIXED** — `maplibregl-ctrl-group` and replay remainder on `--skydra-elevated`/`--skydra-border` tokens | `05`, `16b` |
| Map Settings covering >35% of canvas | **FIXED on FlightMap** (collapsed pill) — **NOT FIXED on the Overview cluster map** (see F2) | `05`, `17` vs `01`, `32`, `40` |
| Map below fold at 1280 | **FIXED in the letter** — map is above the fold; **violated in spirit** (see F1) | `05`/`06`, measured below |
| Rank strip + "Get Signature" CTA | **FIXED** — gone; only a quiet "Email signature" text action remains | `01` |
| Stat-pill unit wrap | **FIXED** — "94.4 m", "22.9 km/h" single-line in records and stats grid, desktop + mobile | `02`, `43` |
| Settings rainbow action palette | **FIXED** — Regenerate neutral outline; Remove/Clear-DB one semantic danger red | `24`, `26` |
| Modal focus escape | **FIXED where the Modal primitive is used** — Tab walked 40+ stops inside About dialog, zero escapes, clean wrap | `28` |

## What carries the product now

- **Composition matches the research doc.** Overview reads attention-strip → map+rail → equipment → secondary analytics; the map zone is the single largest element (`01`). Flights is list rail | map | detail rail | telemetry — master-detail without navigation, exactly the Airdata/ForeFlight pattern (`06`).
- **The replay HUD is the best surface in the app.** Mid-replay the map shows a mono instrument block — Height, Speed, Dist. Home, Battery %, Voltage, Batt. Temp, Satellites, Pitch/Roll/Yaw, Lat/Lng — plus the shared cursor dot tracking the telemetry charts (`15`). This is what "instruments, not dashboards" looks like.
- **Tokens hold under inspection.** Cluster popup, row/header menus (`07`/`09`), filter sliders with accent thumbs (`10`), Settings section rail, About tabs, dock active state — all on-system. ECharts text renders in Geist via `chartFontFamily()`; serials/timestamps in Geist Mono (`SN: FCM4-2201`, `BATM4-0033`).
- **Dock clears content.** `74px + --mobile-safe-bottom` reservation is present in the main scroll, the detail rail, and the flights list; focus ring is visible and roving-tabindex arrow nav works (`19`/`19b`). The Import-as-action sheet is correct in both themes (`20`/`34`).
- **Settings grouped sections + About dialog** are professional and legally careful — AGPL-3.0 chip, upstream attribution card, trademark disclaimer, §13 source offer with repo URL (`22`–`30`).

## Findings — ranked

### F1 — The telemetry band is taller than the map at default geometry (HIGH)

Measured on the live workspace at 1248×671 viewport: map section **209px** tall vs telemetry band **300px** (`TELEMETRY_DEFAULT_HEIGHT`) — the map gets ~38% of the workspace's vertical space while telemetry gets ~54%. Rendered, the map reads as a letterboxed strip with the replay bar and HUD nearly filling it (`05`, `15`, `17`); the product's best composition only appears when the user manually collapses the band (`18` — and there the map is genuinely dominant and the HUD instrument block sings).

The three-zone layout fixed the *horizontal* problem (map above the fold at 1280, ~47% width with both rails) but the *vertical* split inverts the stated rule — "map is the dominant working surface." A first-time user sees charts-first.

**Fix direction:** shrink `TELEMETRY_DEFAULT_HEIGHT` (≈220px) or default the band collapsed below ~900px viewport height; alternatively raise it to a 55/45 map/telemetry split. The drag-resize + collapse machinery already exists — this is a constants decision, not new work.

### F2 — Overview cluster-map furniture is permanent chrome (HIGH)

The foundation review killed Map Settings covering >35% of canvas; the new Overview map reintroduced the same disease in a worse form. `FlightClusterMap.tsx` renders the map-type `Select` + a `LAYERS` card (Clusters/Heatmap toggles) unconditionally at `top-2 left-2 w-44` — there is **no collapse affordance at all**. On the ~55%-width Overview map it occupies ~30% of the canvas at 1280 (`01`, `03`) and ~45% at 420 (`40`). Both elements also carry `shadow-md`/`shadow-lg` — the "borders and spacing before shadows" rule inverted again.

**Fix direction:** collapse to a single quiet button (gear or "Layers" pill — the FlightMap `Map Settings` pill already established the pattern), or at minimum drop the shadows and auto-collapse below a container width.

### F3 — Map Settings panel overflows the workspace map zone (MEDIUM-HIGH)

Expanding `Map Settings` in the Flights workspace renders its controls clipped by the map zone's bottom edge — the Mode/Color/Line dropdowns are unreachable (`17`). The panel assumes a tall canvas; at the F1 default (~209px) it physically doesn't fit. This is the collision of F1's geometry with uncapped overlay content.

**Fix direction:** make the panel scrollable / cap its height to the map zone (`max-height: 100%; overflow:auto`), or pop it out of the canvas (anchored popover) rather than inside it.

### F4 — Flight map renders as a black void at 420px (HIGH *if real; needs hardware verification*)

At 420×800 device emulation, the Flights workspace map mounts (canvas sized 420×300, markers START/END/H in DOM, satellite tiles returning HTTP 200) but paints pure black — reproduced across remounts, resizes, and a fresh reload (`43`). The Overview cluster map renders correctly under identical emulation in the same session, so this is not a blanket "emulation breaks WebGL" artifact; something in FlightMap's mount path (likely an early-size paint or a lost WebGL context) leaves it dead at mobile width. Console is clean.

**Action:** verify on a physical device or desktop-browser narrow window before shipping the workspace as mobile-capable. If it reproduces, this is the worst defect in the set — the product's primary surface dead on the viewport most likely used in the field.

### F5 — i18n interpolation leaks into user-visible tooltips + a11y names (MEDIUM, correctness bug)

Every "···" actions button exposes literal `More actions for {{name}}` as `title`/`aria-label` (`08`; confirmed in live DOM). Visible tooltip on hover, and screen readers announce the placeholder. Same class of bug: Units select reads "Metric (m, km/h) (m, km/h)" (`22`). Both are `t()` calls missing their interpolation arg or duplicated suffix.

**Fix direction:** find `moreActionsFor`-class keys and pass `{ name }` (or drop interpolation); fix the units option label.

### F6 — Activity heatmap is GitHub-green (MEDIUM)

The B1 sweep tokenized the heatmap onto `--skydra-track`, but `track` resolves to green — so the year calendar reads as a GitHub contribution graph (`02`, `33`). Semantically wrong token (a flight-path/cursor color applied to an activity ramp) and a generic-dev-dashboard signal on the Overview. Not a leak — a misapplied token.

**Fix direction:** ramp on `accent` at increasing alpha (or neutral→accent), which also disambiguates activity from status-green.

### F7 — Equipment threshold bars are nearly unreadable (MEDIUM)

The equipment rail's maintenance progress bars render as ~2px hairlines whose track nearly merges into the card surface in both themes (`02`, `33`, `41`). The "usage vs threshold" signal — the research doc's core equipment pattern — is present but illegible. Sort order (overdue → healthy) and green/amber status dots work; the bar itself doesn't.

**Fix direction:** raise track contrast (`line`/`faint` token), increase bar height to ~4–6px, consider mono `32/100` counts alongside.

### F8 — Telemetry series palette is designed but still reads busy (LOW-MEDIUM, judgment call)

The stray hues from the old review are now a *deliberate* 12-step muted categorical palette (`chartSeries()` in `src/lib/chartFont.ts`: accent, track, warning, then steel blue/plum/rosewood/sage/brick/sand/slate/teal/apricot). That is correctly engineered — but the rendered result on mobile still stacks steel-blue GPS bars, rosewood temperature, teal voltage, sand battery in adjacent panels (`44`, `45`), and at a glance it reads closer to "default analytics rainbow" than to one orange + status layer. Defensible; flagged because the design doc's bar is "avoid chart palettes with unrelated decorative colors."

**Fix direction (optional):** mute further (fewer hues, more value-steps of accent/neutral), or reserve saturated hues for user-selected series only.

### F9 — List-rail meta truncates mid-token (LOW)

Flight rows in the rail ellipsize the meta line as "4m 19s · 432 m · 9…" at 340px (`09`, `11`) — an instrument row shouldn't cut a number in half. Wrap to a second meta line or drop the lowest-priority field.

## Follow-up backlog (not blockers)

- **Dock Import FAB** — still a raised orange square; the "mobile-social nav bar" silhouette from M1 survives. Consider flush square w/ accent border.
- **Attention strip when empty** — "NEEDS ATTENTION / No items need attention" costs ~70px; collapse to a hairline or omit when clean.
- **Focus trap coverage** — verified on About (Modal primitive); legacy overlays not yet on it (ColorPickerModal, FlyCardGenerator, HtmlReportModal, progress overlays) still escape.
- **Replay scrubber `aria-valuetext`** — announces 0–1 fraction rather than "02:14 of 04:19" (carried from a11y audit S3).
- **Flight color chip** in workspace header uses `flight.color` literal — user-picked, acceptable, but consider constraining picks to a token-adjacent ramp.
- **`--skydra-faint` / light-theme bridge `!important` wall** — token-hygiene debt from M7/M8 still open.
- **Map-theme independence** — Mode select (Default/Satellite) already covers the ForeFlight rule; verify persistence is per-surface not global.
- **Telemetry `2/4` selector** — same chip repeated per panel reads noisy (`15`); one selector for the band would suffice.

## Appendix — evidence map

| Shot | Shows |
|---|---|
| `01`, `32` | Overview top dark/light — attention strip, map+rail, **LAYERS furniture over canvas** |
| `02`, `33`, `41` | Overview bottom — equipment rail (faint threshold bars), green activity heatmap, records |
| `03`, `03b`, `04` | Cluster popup tokenized; heatmap toggle on (subtle orange) |
| `05`/`06` | Flights workspace dark — map above fold, three-zone, telemetry band default 300px |
| `07`–`10` | Header menu, `{{name}}` tooltip bug, row menu, filters + bulk actions |
| `11`–`13` | Detail rail tabs: Messages empty state, Weather (loaded: 25.9°C + home address), Notes |
| `14`–`16b` | Replay active/mid/scrubbed — HUD instrument block, shared chart cursor, tokenized scrubber |
| `17` | Map Settings expanded — clipped by telemetry band, Mode/Color/Line unreachable |
| `18` | Telemetry collapsed — the composition the product should default to |
| `19`/`19b` | Dock focus ring (keyboard landing verified) |
| `20`/`34`, `21`/`35` | Import sheet dark/light; btn-primary hover orange (rgb verified) |
| `22`–`27` | Settings sections incl. "Metric (m, km/h) (m, km/h)" defect |
| `28`–`30` | About / Licenses / Source tabs (focus trap verified) |
| `31` | Flights workspace light — tokens hold, satellite map, stat rail |
| `40`, `42` | Mobile Overview — furniture covers ~45% of map at 420px |
| `43` | **Mobile workspace map black** — canvas sized, tiles 200, nothing paints |
| `44`, `45` | Mobile telemetry — categorical palette density (steel-blue GPS bars, rosewood temp, teal voltage) |
| `46` | Settings mobile — horizontal section rail |
