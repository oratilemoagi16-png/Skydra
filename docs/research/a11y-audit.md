# Skydra — Accessibility Audit (WCAG 2.2 AA)

**Date:** 2026-09-19 · **Base:** `origin/skydra/main` @ `b84e1b9` · **Auditor:** Devin (audit workstream — no product-code changes)

**Method.** Running app (Axum web backend on :3001 + Vite on :1420, seeded 5 flights), driven with axe-core 4.x via Playwright/CDP on the Overview, Flights, and Settings surfaces in **both** light and dark themes; full-keyboard Tab/Shift+Tab walks; DOM/ARIA inspection; 420 px mobile viewport; 640 CSS px (~200% zoom at 1280) reflow check. Findings are written as reusable pattern guidance for the redesign workstream, not line-by-line rewrites.

**Severity legend.** `blocker` = core feature unreachable by keyboard/AT. `serious` = WCAG A/AA failure that degrades real use. `moderate` = AA failure or strong usability gap. `minor` = polish/hardening.

**axe totals (unique rule failures per run):** Overview-light 8 rules (34 contrast nodes, 13 unlabeled inputs, 5 nested-interactive, …), Flights 5 rules, Settings-open 6 rules (+17 `region` nodes — dialog content lives outside all landmarks), Overview-dark 8 rules (27 contrast nodes).

---

## Blockers — keyboard/AT-unreachable core features

### B1. Row context menu is reachable only by right-click
`FlightList.tsx` (row `onContextMenu` handler) and `TelemetryCharts.tsx` open the flight action menu (rename, notes, color, tags, export, FlyCard, messages, delete) via `onContextMenu` only. There is **no keyboard trigger** — no per-row "more actions" button, no `Shift+F10`/`ContextMenu`/`Menu`-key handler — and the opened menu has no `role="menu"`/`menuitem`, no focus-on-open, no Escape→return-focus.
**WCAG 2.1.1 Keyboard.** *Fix:* add a visible `⋯` "More actions" `<button aria-haspopup="menu">` per row (and on the selected-flight header) that opens the same menu; also open it on `ContextMenu`/`Shift+F10` keydown on the focused row. Give the menu the ARIA menu pattern (focus first item on open, arrows navigate, Escape closes and returns focus to the trigger).

### B2. Flight list has no keyboard navigation model
`FlightList.tsx` renders each flight as `role="button" tabIndex={0}` containing **focusable child buttons** (rename/delete icons), so every row costs 3+ Tab stops and the list scales Tab-order linearly with fleet size (hundreds of flights = unusable). The row keydown handles Enter/Space but never `preventDefault()`s Space, so Space scrolls the page on keydown before firing. No `role="listbox"`/`treegrid`, no arrow-key navigation, no roving `tabIndex`, no `aria-selected` — axe flags `nested-interactive` on every row.
**WCAG 2.1.1 / 2.4.3 / 4.1.2.** *Fix:* make the list a single Tab stop: `role="listbox"` (or `treegrid` if rows keep inner actions) on the container, rows `role="option"` with `aria-selected`, roving `tabIndex` (selected row `0`, others `-1`), ArrowUp/Down + Home/End navigation, Enter activates, and call `e.preventDefault()` for Space. Keep row actions reachable via the `⋯` button (B1) so the pattern isn't nested-interactive.

### B3. Modals do not trap focus and never receive it
All overlay components except `FlightMessagesModal` are bare `fixed inset-0` stacks: `SettingsModal`, `EmailSignatureModal`, `FlyCardGenerator`, `ManualEntryModal`, `ColorPickerModal`, `HtmlReportModal`, `WeatherModal`, plus the import/export progress overlays in `FlightList`. Verified live: with Settings open, **45/45 consecutive Tab presses landed on background controls** (sidebar, drop zone, import buttons) — focus is never moved into the dialog, never trapped, and after Escape it lands on an unrelated input, not the trigger. Background content is not `inert`/`aria-hidden`, so screen readers traverse the entire dimmed page behind the modal.
**WCAG 2.4.3 Focus Order / 4.1.2.** *Fix:* one shared `Modal`/`Dialog` primitive used by every overlay: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the visible title, `inert` (or `aria-hidden`) on the app root, focus moved to the dialog (or first field) on open, a real Tab trap, Escape to close, and focus restored to the invoking control on close. `FlightMessagesModal.tsx` (~line 88) already has `role="dialog" aria-modal="true" aria-label` + a labeled close button — use it as the markup reference, it still lacks the trap/return parts.

### B4. Overview interactive elements are non-focusable `div`s
`Overview.tsx`: "Top flights"/"top distance" rows are `<div onClick>` (no role/tabIndex/key handler); each Activity-heatmap day cell is `<div title onDoubleClick>` — focusable by nothing, operable by nothing, and the `title` tooltip is unreachable for keyboard/touch/AT users. Similar `onDoubleClick` rename affordances exist elsewhere.
**WCAG 2.1.1.** *Fix:* use real `<button>` (or link) for row navigation; make heatmap cells focusable (grid/listbox pattern or per-cell buttons) with the tooltip content duplicated into `aria-label` or an adjacent visually-hidden text; provide a single-click/Enter equivalent for every double-click action.

### B5. Profile selection is keyboard-inaccessible
`App.tsx` initialization overlay profile dropdown items and `ProfileSelector.tsx` profile rows are `<div onClick>` — you cannot choose/switch/delete a profile without a pointer (a hard wall for a keyboard user on first launch).
**WCAG 2.1.1.** *Fix:* real buttons or a `listbox`/`menu` composite (trigger `aria-haspopup="listbox"`, options `role="option"`, arrow keys, Enter selects, Escape returns focus to trigger).

### B6. Collapse/resize affordances are mouse-only
`Dashboard.tsx`: the importer collapse chevron is `<span onClick>` (~line 436) and the "Filters" chevron is the same pattern; the sidebar resizer (~line 511) and the main split resizer (~line 676) are `onMouseDown`-only strips. None appear in Tab order or respond to keys.
**WCAG 2.1.1 / 4.1.2.** *Fix:* chevrons become `<button aria-expanded aria-controls>`; resizers become `role="separator" aria-orientation` focusable elements where Left/Right (or Up/Down) adjust width — or drop the resize feature on keyboard/AT and expose fixed layouts instead.

---

## Serious — WCAG A/AA failures degrading real use

### S1. No dialog semantics on 7+ modal components
No `role="dialog"`, `aria-modal`, or `aria-labelledby` on any modal except `FlightMessagesModal`; modal content also sits outside every landmark (17 `region` violations when Settings is open). SR users hear no announcement that a dialog opened and can wander the underlying page.
**WCAG 4.1.2 / 1.3.1.** *Fix:* same shared primitive as B3; label every dialog with `aria-labelledby` → its `<h2>` title.

### S2. Unlabeled and indistinguishable form controls (axe: `label` ×13+, `select-name` ×2, `button-name` ×1+)
- Six dual-range `<input type="range">` pairs (Duration / Max Altitude / Total Distance min & max, `FlightList.tsx` ~2940–3075): no labels at all, and the lo/hi inputs of each pair are indistinguishable — SR announces two bare "slider" widgets per filter. The visible `<label>` next to each group is unassociated text.
- Hidden file `<input multiple>` in the drop zone — unlabeled.
- Six numeric inputs in Overview's "top N" config grids — unlabeled.
- Two `.sort-select` `<select>`s in Overview cards — no name (`select-name`, critical).
- The map-area filter toggle (`FlightList.tsx` ~2718) is an `aria-pressed` `<button>` with **no accessible name** (`button-name`, critical). Settings' header close `×` and assorted icon-only buttons share the pattern (`title`-only or nothing).

**WCAG 1.3.1 / 3.3.2 / 4.1.2.** *Fix:* `aria-label`/`aria-labelledby` on every control ("Minimum duration" / "Maximum duration"), `aria-valuetext` on sliders ("4 min"), associate or replace the dead `<label>`s with `htmlFor`/`id` pairs or `aria-labelledby`.

### S3. Replay scrubber is an anonymous slider
`FlightMap.tsx` (~line 2110): the replay seek `<input type="range" min="0" max="1" step="0.001">` has no label and announces a raw 0–1 fraction; play/pause and speed buttons are `title`-named only.
**WCAG 4.1.2.** *Fix:* `aria-label="Replay position"`, `aria-valuetext="02:14 of 04:19"` (formatted time, not a fraction), and `aria-label`s on the transport buttons. Keyboard arrows already work natively once the input is reachable and labeled.

### S4. Palette contrast fails WCAG 1.4.3 in both themes (measured on running app)
| Theme | Pair | Ratio | Where |
|---|---|---|---|
| Light | `#94A3B8` on `#F4F7FA` | **2.38:1** | flight-row metadata (date/duration/distance) — every row |
| Light | `#94A3B8` on `#FCFDFE` | 2.51:1 | milestone axis labels (`10px`) |
| Light | `#64748B` on `#F4F7FA` | **4.42:1** | section headers, view-toggle labels, footer counts, subtitle |
| Dark | `#6B7280` on `#1A1A2E` | **3.52:1** | flight-row metadata — every row |
| Dark | `#6B7280` on `#0F1220` | 3.85:1 | milestone axis labels |

34 (Overview-light), 26 (Flights), 44 (Settings) and 27 (dark Overview) nodes — it is a **token-level** problem, not per-component. The design doc already prescribes a muted floor ≈ `#8A8A8A`-equivalent for dark; the shipped palette doesn't meet it, and the light theme is worse than dark.
**WCAG 1.4.3.** *Fix:* fix at the token level in `index.css`/Tailwind config — pick muted/secondary text values that hit ≥4.5:1 against each theme's surface colors, then sweep `text-gray-400`/`text-gray-500`/`text-slate-*` usages onto the token.

### S5. Focus visibility suppressed or missing
`.themed-select-trigger:focus { outline: none }` (index.css); sort selects use `.outline-none`; a live Tab-walk showed the "Flight weather" and "Export" buttons rendering `outline: auto 0px` — **no visible indicator at all**; cluster-map layer toggles hide the real checkbox with `sr-only` but the visual track has no `peer-focus-visible` ring, so the focused switch is invisible.
**WCAG 2.4.7.** *Fix:* one `:focus-visible` ring token (e.g. 2 px accent offset ring) applied globally; remove `outline:none` without replacement; add `peer-focus-visible:` styles to every `sr-only peer` toggle.

### S6. Custom Select and filter dropdowns lack listbox/menu semantics
`ui/Select.tsx` and the sidebar filter dropdowns (drone/battery/controller/tag/color/sort/export): `<button>` trigger + `<div>` options; arrow-key nav exists only inside an inner search box; no `aria-haspopup`/`aria-expanded` on triggers, no `role="listbox"`/`role="option"`/`aria-selected`/`aria-activedescendant`, focus does not return to the trigger on close; neighboring `<label>` texts are unassociated.
**WCAG 4.1.2 / 1.3.1.** *Fix:* adopt the ARIA listbox pattern (or a vetted headless listbox) for `Select`; give every dropdown trigger `aria-haspopup` + `aria-expanded`; on open move focus to the option list, on close/Escape return it to the trigger; wire the visible labels via `htmlFor`/`id` or `aria-labelledby`.

### S7. Nothing announces async state — zero live regions in the codebase
`grep` confirms **0** occurrences of `aria-live`, `role="status"`, `role="alert"`, `role="progressbar"`, `aria-busy`. Import progress, export/delete progress overlays, the red error toast (`fixed top-4 right-4` plain `div` + glyph-only `✕` button), loading spinners, and sync status are all silent to AT.
**WCAG 4.1.3 Status Messages / 1.3.1.** *Fix:* a single visually-hidden `aria-live="polite"` announcer fed by the toast/message system (`role="alert"` for errors), `role="progressbar" aria-valuenow` on the import/export bars, `role="status"` on spinners/loading text, `aria-busy` on refreshing regions.

### S8. Sidebar/view toggles announced as plain buttons
"Individual/Overview" segmented control is two buttons with visual-only active state — no `aria-pressed`, no `tablist`/`tab` roles. The same applies to the Importer/Filters collapsible sections (`aria-expanded`/`aria-controls` missing on the new `<button>`s from B6) and the `ToggleRow`/map-settings switches (`aria-pressed` exists on some, but `role="switch" + aria-checked` is the clearer contract).
**WCAG 4.1.2 / 1.3.1.** *Fix:* `role="switch" aria-checked` for on/off toggles; `aria-pressed` (or tablist semantics if it swaps panels) for the view toggle; `aria-expanded`/`aria-controls` on disclosure buttons.

---

## Moderate

### M1. Charts and map have no text alternative
No ECharts `aria` config anywhere (no `aria.enabled`, no `aria-label`); donuts, radar, telemetry strips and the activity heatmap convey data only visually; the MapLibre canvas has no summary. `TelemetryCharts`' toolbar buttons do have aria-labels (good).
**WCAG 1.1.1.** *Fix:* enable `aria: { enabled: true }` (or decal + labels) per chart, and provide a data-table/`aria-describedby` summary toggle for each viz ("Flights by Drone" → table of drone × flights); for the map expose a textual path/statistics summary region.

### M2. Touch targets below 24 × 24 px at mobile width (33 elements measured at 420 px)
Row rename/delete pencils 18 px, "Clear filters" 16 px tall, dual-range thumbs ~20 px (and overlapping when min≈max), date-jump buttons 20 px, chip remove `×` 15 px, sort select 20 px.
**WCAG 2.5.8 (AA).** *Fix:* enforce a 24×24 minimum (44×44 preferred per platform guidance) via min-hit-area utility; `p-2.5`/`min-h`/`min-w` on icon buttons; visually small is fine if the **hit area** is ≥24 px.

### M3. Landmarks & heading structure
Two unlabeled `<aside>`s (sidebar + collapsed rail) trigger `landmark-unique`; Overview cards jump to `<h3>` under a single `<h1>` with no `<h2>`s (`heading-order`); primary navigation isn't a `<nav>`; no skip-to-content link.
**WCAG 1.3.1 / 2.4.1.** *Fix:* label landmarks (`aria-label="Flight list sidebar"`), repair heading levels, wrap primary nav in `<nav aria-label>`, add a "Skip to flight workspace" link as the first tabbable element.

### M4. Errors are text-only and unannounced
Init/auth errors, ManualEntryModal validation messages, and the error toast render red text with no `role="alert"`, `aria-invalid`, or `aria-describedby` wiring; invalid fields are not marked invalid.
**WCAG 3.3.1 / 4.1.3.** *Fix:* `role="alert"` (or the polite announcer) for errors, `aria-invalid="true"` + `aria-describedby` → error id on each failing field.

### M5. `lang` never follows i18n
`index.html` hard-codes `lang="en"`; the app ships 13 locales but nothing updates `document.documentElement.lang` on language change.
**WCAG 3.1.1.** *Fix:* a `languageChanged` handler that sets `document.documentElement.lang = i18n.language`.

### M6. No `prefers-reduced-motion` handling
Zero occurrences in CSS/JS: spinner rotation, milestone/progress pulses, accordion/dropdown transitions, and `scroll-behavior: smooth` all run unconditionally.
**WCAG 2.3.3 / 2.2.2.** *Fix:* a single `@media (prefers-reduced-motion: reduce)` block disabling non-essential animation/transitions/smooth-scroll (keep functional progress indication), plus a JS check for any JS-driven animation.

### M7. Scroll regions unreachable by keyboard
`.overflow-x-auto` telemetry strip (`scrollable-region-focusable`) and the filter scroll area can't be scrolled without a pointing device.
**Fix:** `tabindex="0"` + `role="region"` + `aria-label` on scrollable regions.

---

## Minor

- **m1 — `title`-only names.** 58 `title=` attributes vs 16 `aria-label`s. `title` is a legal accessible-name source, but it's tooltip-latency dependent, invisible to touch users, and inconsistent; prefer `aria-label` (and a real tooltip component if tooltips are wanted).
- **m2 — Password visibility toggle is `tabIndex={-1}`** (`ui/PasswordInput.tsx`) — keyboard users can never reveal/check their password. Make it a normal focusable button; if the concern is accidental toggling, keep it reachable but require activation (it already does).
- **m3 — Dual-range thumbs overlap** at equal min≈max, making either thumb ungrabbable even for pointer users.
- **m4 — Space on flight rows scrolls the page** (no `preventDefault`) — folded into B2's fix.
- **m5 — Initialization overlay** autofocuses the password field; acceptable, but ensure the profile dropdown (B5) is reachable first so keyboard users can pick a profile at all.

---

## Verified OK / won't-do (do not re-flag)

- **Zoom & reflow:** at 640 CSS px (~200% zoom) there is **no horizontal scrollbar**; the app collapses to the sidebar-first mobile layout. Inner scroll regions still need keyboard scrollability (M7). `index.html` does not disable pinch zoom.
- **Escape & backdrop dismissal** work on every modal tested.
- **`FlightMessagesModal`** is the in-repo exemplar: `role="dialog"`, `aria-modal="true"`, `aria-label`, labeled close button (still needs trap/return, like everything).
- **Sort/export dropdown keyboard support:** arrow-key navigation + focus-into-menu on open already exist — keep the interaction, add the roles/states (S6).
- **Right-click context menus are fine** as an accelerator; the required fix is an *additional* visible menu trigger + `Menu`-key support (B1), not removal.
- **ECharts/MapLibre canvases:** don't attempt full canvas keyboard equivalence; provide labeled controls for map layers (already buttons in the cluster map) and textual/data-table alternatives (M1).
- **`title` as the accessible name** of icon buttons satisfies accName; count it as acceptable-minimum (m1), not a violation.
- **Ctrl+Q quit** is desktop-only; no conflict.
- **`sr-only`-hidden checkboxes** wrapped in `<label>` (cluster-map toggles) *do* get an accessible name; the defect is only the missing focus ring (S5), not labeling.

---

## Quick wins (single-session, low-risk)

1. `role="dialog" aria-modal="true" aria-labelledby` + Escape on all modal shells (even before the focus trap lands).
2. `aria-label` on every icon-only button; `aria-label`/`aria-labelledby` on dual-range inputs, sort selects, numeric inputs, the file input, and the replay slider (+`aria-valuetext`).
3. `role="alert"` on the error toast + auth/form errors; `aria-live="polite"` announcer div; `role="progressbar"` on import/export bars.
4. Remove `outline:none` suppressions / add a global `:focus-visible` ring; `peer-focus-visible:ring-2` on `sr-only peer` toggles.
5. `@media (prefers-reduced-motion: reduce)` block.
6. `document.documentElement.lang` sync on language change.
7. `aria-expanded`/`aria-controls` on disclosure buttons; label the duplicate `<aside>` landmarks; skip link.
8. `tabindex="0" role="region" aria-label` on scrollable strips.
9. Min 24 px hit areas on icon buttons and `×` chips.
10. `aria-pressed`/`role="switch" + aria-checked` on toggle controls (with names).

## Structural work (multi-session, design-affecting)

1. **Shared `Modal` primitive** — trap, initial focus, restore, inert background — then migrate every overlay (B3/S1).
2. **Flight-list keyboard model** — listbox/treegrid, roving `tabIndex`, arrows, `⋯` menu button + `Menu`-key (B1/B2).
3. **Menu/listbox primitives** — reuse for context menu, `Select`, profile picker, filter dropdowns (B1/B5/S6).
4. **Design-token contrast pass** — muted/secondary floors per surface per theme; sweep `gray-400/500` usages (S4). Tie into the token rebuild already in flight.
5. **Chart/map alternatives** — `aria` on ECharts, data-table fallbacks, textual map summary (M1).

---

## Evidence

Live-app screenshots committed alongside this report:

- `a11y-audit/overview-light.png` — Overview, light theme (contrast: row metadata 2.38:1).
- `a11y-audit/overview-dark.png` — Overview, dark theme (row metadata 3.52:1).
- `a11y-audit/flights-workspace.png` — Flights workspace: telemetry, map panel, replay bar.
- `a11y-audit/settings-modal.png` — Settings modal open over the (non-inert) app.
- `a11y-audit/mobile-420px.png` — 420 px layout.

Raw axe outputs and Tab-walk transcripts were captured per view (overview/flights/settings, light + dark); representative violation tables are inlined in S2/S4 above.

**Reproduction:**
```
cd src-tauri && cargo run --no-default-features --features web   # :3001
VITE_BACKEND=web npm run dev                                     # :1420
python3 scripts/dev/seed_demo_data.py
# then: playwright connectOverCDP(http://localhost:29229) + axe-core injection,
# or npx @axe-core/cli http://localhost:1420
```
