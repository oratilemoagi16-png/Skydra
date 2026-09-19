# Visual-critique capture run — test plan

App: http://localhost:1420 (Vite) + :3001 (Axum), seeded with 5 JHB flights.
Output dir: /home/ubuntu/repos/Skydra/docs/review/shots-integrated/
Desktop shots: wmctrl resize Chrome to 1280x800, capture `scrot -u file.png`.
Mobile shots: DevTools device toolbar 420x800, Cmd+Shift+P → Capture screenshot → move from ~/Downloads.

## Naming
`NN-surface-theme-width.png` — 01-19 dark 1280, 20-39 light 1280, 40+ mobile.

## Capture sequence
1. Load app, ensure dark theme (TopBar toggle), resize 1280x800.
2. Overview: top of page shot; scroll to bottom shot (attention strip, stats band, map, equipment rail, heatmap/donut/radar).
3. Overview cluster map: confirm Map Settings panel state on load (expect COLLAPSED per FlightMap.tsx:403-410); click a cluster → popup shot (check popup header is not indigo); check heat layer toggle if present.
4. Flights: rail view shot; select a flight → workspace shot (verify map above fold, dominant). Detail rail tabs: Stats, Messages, Weather, Notes shots. Telemetry band expanded + collapsed.
5. Replay: press play, capture mid-replay (marker + scrubber + chart cursor); drag scrubber; close-up of replay bar (check remainder track is not purple).
6. Map furniture: ctrl group/zoom, layer toggle, open Map Settings panel expanded (measure ~% of canvas).
7. Menus: flight row "..." open; workspace header "..." open; flights rail filter/sort menus.
8. Settings: open modal; capture sidebar + each section group; a few bodies; check action button palette (Regenerate/Remove/Blacklist/Clear DB — should not be rainbow teal/orange/amber/red); open About dialog (check nested focus trap).
9. Dock: rest state; Tab-focus ring on item; scroll long page → does content clear or slide under dock?
10. Import: open ImportSheet (centered + action) → capture sheet; hover its btn-primary.
11. Hover checks: move mouse over btn-primary → screenshot + browser_console getComputedStyle(backgroundColor). Expect orange-family (NOT rgb(59,130,246)).
12. Focus trap: with Settings or About open, install focusin logger, Tab ~10x, dump window.__focusLog — all entries must have inDlg:true.
13. Light theme: repeat Overview top+bottom, Flights workspace selected, Settings, Import hover, a menu.
14. Mobile 420 dark: Overview top+bottom, Flights rail, selected workspace, Settings, dock over content at scroll end, Map Settings. A few light 420 shots.

## Defect checklist expectations (from code)
- btn-primary hover: `bg-accent hover:bg-accent-hover` (index.css:280) → expect orange accent, not blue 59,130,246. Verify computed RGB while hovered.
- Cluster ramp #FFB25E orange (FlightClusterMap.tsx:125) → expect not indigo.
- Activity heatmap: `rgb(var(--skydra-track) / intensity)` (Overview.tsx:1984) → tokenized ramp, not cyan.
- Map Settings default collapsed (FlightMap.tsx:403-410).
- Rank progression strip removed (Overview.tsx:47-48 comment); email signature is a quiet text button in page header (Overview.tsx:589).
- map-overlay class tokenized (index.css:135).
- NOTE: [59,130,246] still used for flight-track colors (FlightMap.tsx:198,219,1393) — legit data colors, but flag in report.

## Pass criteria
All screenshots captured and correctly named; each defect item marked FIXED/STILL PRESENT/NOT REACHABLE with evidence; anomalies listed.
