# Skydra performance audit

**Base:** `origin/skydra/main` @ `b84e1b9`
**Method:** seeded dev DB (`scripts/dev/seed_demo_data.py` → 6 flights, ~17.7k telemetry points), backend `cargo run --no-default-features --features web` on :3001, frontend measured on the **production `build:web` output** served behind an /api proxy (plus dev-mode React commit counts where noted). Measurements via Playwright over CDP (`longtask` PerformanceObserver, React DevTools `onCommitFiberRoot` hook), `curl` timing, and DuckDB (1.5.5) query timing on a copy of the live DB.
**Scale caveat:** the seed dataset is small (6 flights). Findings that only appear at scale are marked **[scaling]** and carry measured per-unit costs; everything else was measured directly.

## Headline numbers

| Interaction | Measurement (prod build) |
|---|---|
| Select a flight (detail view) | **18 long tasks, ~7.2s of main-thread blocking** after click (dev build: 6.6s) |
| Replay, map sync OFF | 14 long tasks, **3.6s blocked in a 5s window** |
| Replay, map sync ON | 21 long tasks, **5.4s blocked in a 5s window** (~50% worse) |
| Flight select, React commits (dev) | **120 commits** for one click |
| Cold start | 3.84 MB JS transferred, entry chunk **3.04 MB min / 886 KB gzip** |
| `/api/flight_data` (2,080 pts) | ~880 KB **uncompressed** JSON, ~423 B/point, 70–175 ms localhost |
| `/api/overview` | 65–82 ms localhost; underlying aggregate queries 18 ms @ 590k rows |
| Import | 3,360 pts / 940 KB CSV in 0.57s (~5,900 pts/s) — healthy |

---

## P1 — user-visible, fix first

### 1. Replay saturates the main thread; map sync makes it ~50% worse

**Measured:** during replay, ~14–21 long tasks per 5s wall-clock window (individual tasks 80–1300 ms). With `mapSyncEnabled` the blocked time exceeds the window (5.4s per 5s) — effective replay rate is ~4 fps with dropped frames on this hardware.

**Why, two compounding causes:**

- `FlightMap.tsx` runs a `requestAnimationFrame` loop (lines ~562–587) that calls `setReplayProgress` per frame. When map sync is on, an effect (lines ~607–612) pushes every frame into the Zustand store via `setMapReplayProgress`. Zustand `set()` notifies all listeners; **10 components subscribe to the entire store** with no selector (`useFlightStore()` — see finding 4), so every frame re-renders `FlightList` (4,836-line component), `SettingsModal` (always mounted, `Dashboard.tsx:246`), `App`, `FlightStats`, `Dashboard`, etc., at ~60 fps.
- Even without map sync, `FlightMap` re-renders itself per frame and rebuilds deck.gl layers each render (3.6s blocked).

**Fix direction:** keep replay progress out of the global store — store it in a ref/external store with `subscribeWithSelector`, or emit it via a transient subscription (`useFlightStore.subscribe`) only to the axis-pointer handler. Throttle the store write to ~10 Hz if it must stay. Convert all `useFlightStore()` call sites to per-field selectors (biggest wins: `FlightList`, `SettingsModal`, `Dashboard`, `App`). Memoize deck.gl layer construction (`useMemo` on data, not per-render).

**Effort:** M (half a session for the selector conversions + replay progress ref; the map layer memoization is the fiddly part).

### 2. Opening a flight blocks the UI for ~7 seconds

**Measured:** clicking a flight → **18 long tasks totaling ~7.2s** (prod), 6.6s (dev), before the detail view is interactive. Only 7 React commits — this is not a render-count problem, it's synchronous work: `TelemetryCharts` mounts **~10 `ReactECharts` instances at once** (lines ~1241–1452), each processing thousands of points with `smooth: true` (per-series bezier path generation) and `bridgeShortNullGaps` preprocessing, plus deck.gl/MapLibre track render.

**Compounding UX issues:**

- `Dashboard.tsx:558` gates the *entire* main panel on `isLoading`, so selection blanks everything to a spinner instead of keeping the map/stats visible.
- `flightStore.ts:484` sleeps **120 ms on cache hits** "so user sees click feedback" — a deliberate 120 ms blank-screen penalty on every re-select.
- No progressive disclosure: all 10 charts initialize before first paint of the panel.

**Fix direction:** (a) stop blanking the panel — render the new flight's shell immediately, keep prior data or per-section skeletons; (b) drop the artificial 120 ms delay; (c) defer off-screen charts (IntersectionObserver or mount-on-scroll / tabbed chart groups) so first paint doesn't wait for all 10; (d) turn on ECharts `sampling: 'lttb'` + `large: true` for the big series and drop `smooth: true` on multi-thousand-point series (smooth forces expensive path math per point); (e) consider `progressive` rendering for the densest charts. `notMerge={true}` on every chart also forces full option re-diff on updates — prefer targeted `setOption` merges.

**Effort:** M–L. (a)+(b)+(d) are small, ~1 session; (c)/(e) need design decisions about which charts are above the fold.

### 3. Monolithic 3 MB entry bundle — nothing is lazy that could be

**Measured `npm run build:web` output:**

- `index-*.js`: **3,037 KB minified / 886 KB gzip** — single entry chunk, no `manualChunks`, zero `React.lazy`/`import()` in `src/`.
- Contents proven by inspection: **full ECharts suite** (`echarts-for-react`'s default import does `import * as echarts from 'echarts'` — `node_modules/echarts/dist/echarts.min.js` = 1.01 MB; the tree-shakeable `echarts-for-react/core` + `echarts/core` entry is unused), **all 13 i18n locales statically imported** in `src/i18n/index.ts` (~460 KB of JSON inlined as JS), app + deps.
- `maplibre-gl-*.js` (803 KB / 218 KB gz) and `html2canvas` (202 KB) *are* separate lazy chunks — but the Overview view mounts a MapLibre map immediately, so **maplibre is fetched at startup anyway** (measured 3.84 MB JS transferred on cold load).
- `index.html:10–12` loads Inter from Google Fonts as a **render-blocking** stylesheet.

**Fix direction:** switch `TelemetryCharts`/`Overview` to `echarts-for-react/core` with explicit `echarts/core` imports for the used charts/features (Line/Bar/Pie + Canvas renderer ≈ −600–700 KB); lazy-load locale JSONs (keep `en` eager, `i18next` backend or dynamic `import()` per language); split the entry with `manualChunks` (vendor/react/echarts/i18n) so app code and deps cache independently; `React.lazy` the Overview tab and SettingsModal; `font-display: swap` + `media="print" onload=` trick (or self-host) for fonts. Keep `echarts-for-react` — just its `/core` entry.

**Effort:** M (~1 session; the echarts/core migration is mechanical, the risky bit is enumerating every used chart type/feature).

---

## P2 — real, smaller blast radius

### 4. Whole-store Zustand subscriptions — every `set()` re-renders 10 components

`useFlightStore()` with no selector returns the whole store; in Zustand v5 any state change re-renders all these call sites:

`App.tsx:13` and `:358`, `Dashboard.tsx:40`, `FlightList.tsx:262`, `FlightMap.tsx:415`, `SettingsModal.tsx:103`, `FlightStats.tsx:34`, `ProfileSelector.tsx:23`, `ManualEntryModal.tsx:81`, `FlightImporter.tsx:289`.

The store is written constantly: `isLoading` flips on every fetch, `loadFlights` on every mutation, `mapReplayProgress` per frame during replay (finding 1). `SettingsModal` is mounted even when closed (`Dashboard.tsx:246`), so a closed modal re-renders at 60 fps during map-synced replay. Dev-mode measurement: one flight selection = **120 commits**.

**Fix direction:** convert each call site to `useFlightStore((s) => s.field)` selectors (the codebase already does this correctly in `Overview.tsx:59–78` — copy that pattern); mount `SettingsModal` only when open.

**Effort:** S–M (mechanical; ~half session).

### 5. Telemetry API responses are large and uncompressed

**Measured:** `GET /api/flight_data?flight_id=…&max_points=5000` on a 2,080-point flight → **880 KB**, ~423 B/point, 70–175 ms on localhost. The response is columnar JSON (~33 `Vec` columns in `TelemetryData`, `models.rs:281`) — verbose keys repeated per array don't compress because there's **no compression middleware on the Axum router** (no `CompressionLayer` in `server.rs`). On LAN/mobile links this is the dominant per-flight cost; `JSON.parse` of ~1 MB also lands on the main thread.

Secondary: `get_flight_telemetry` (`database.rs:1233`) already knows `known_point_count` but still runs `SELECT COUNT(*) FROM telemetry WHERE flight_id=?` (lines ~1263–1284) before choosing the downsample path — minor waste.

`/api/flights` returns all flights with no pagination (3.5 KB @ 6 flights → **[scaling]** ~3 MB @ 5k flights, re-fetched whole after each mutation).

**Fix direction:** add `tower_http::compression::CompressionLayer` (gzip/br) to the Axum router — one line, ~8–10× on this payload. Optionally binary encoding (DuckDB can emit Arrow; the frontend already handles columnar data). Drop the redundant `COUNT(*)` when the count is known. Add `limit`/`offset` or cursor params to `/api/flights` before fleet scale.

**Effort:** S for compression + COUNT fix (hours); M for pagination (needs frontend list changes).

### 6. Overview does sequential per-battery API calls (N+1)

`Overview.tsx:1707–1739`: a `for` loop `await`s `GET /api/battery_capacity_history?battery_serial=…` **once per battery, serially**. Measured **6 calls at startup for 3 batteries** (effect also ran twice). At N batteries the chart waits N sequential round-trips.

**Fix direction:** batch endpoint (`?serials=a,b,c` → one query with `WHERE battery_serial IN (...)`) or `Promise.all` at minimum; dedupe the double effect run.

**Effort:** S (hours — endpoint exists, just needs multi-serial support or parallel calls).

### 7. `get_overview_stats` does unbounded full-table analytics

`database.rs:1615–1861`: `top_distance_flights` LEFT JOINs **all telemetry rows to themselves' neighbors** computing haversine distance per row, with no LIMIT pushdown; battery-health JOIN similar; `flights_by_date` pulls every `start_time` and string-parses dates in Rust. Measured on a scaled-up DB (205 flights / 590k telemetry rows): haversine join 18.2 ms, battery join 7.7 ms — **fine today, linear growth**; the aggregate endpoint measured 65–82 ms at current scale. **[scaling]**

**Fix direction:** SQL-side `LIMIT` on top-N queries; precompute per-flight totals at import time (a `flight_stats` table updated once per import) so Overview reads are O(#flights) not O(#telemetry); parse dates in SQL (`strftime`) not in Rust.

**Effort:** M (~1 session; the precompute table is the right long-term fix, LIMITs are quick wins).

---

## P3 — latent / low impact today

### 8. `FlightList` is not virtualized

`FlightList.tsx:4159` renders `sortedFlights.map(...)` unconditionally; no `react-window`/`react-virtual` in deps. ~13 DOM nodes/row → ~65k nodes at 5k flights; fine at current scale, scroll/layout jank at fleet scale. The `useMemo`s for filter/sort (lines ~1265, ~1448) are already in place.

**Fix direction:** `@tanstack/react-virtual` (small, tree-shakeable) on the `divide-y` scroll container. Don't do it pre-emptively below ~1k flights — the row markup is compact.

**Effort:** M (row heights, expanded-row state, keyboard nav make it non-trivial).

### 9. Render-blocking font CDN

`index.html:10–12`: Google Fonts CSS for Inter is render-blocking. First paint measured fine locally (208 ms) but a slow CDN stalls text paint; the inline dark background mitigates white-flash only. Also note product docs name Geist Sans/Mono as the candidate typeface — whichever wins, self-host or use `font-display: swap` + preload.

**Effort:** S.

### 10. Minor housekeeping

- `selectFlight` sets `isLoading` even when the flight is already selected-then-cached — combined with finding 2's panel gate this flickers the whole view.
- Dev-mode duplicate init calls (`/api/profiles` ×4, `/api/config` ×2, `/api/tags` ×2) are mostly React StrictMode double-mount + `InitializationOverlay`'s own `loadProfiles`; in prod `/api/profiles` still fired twice — worth a quick dedupe but low value.

---

## Healthy parts — do not "fix" these

- **Telemetry downsampling is real and correct:** `query_downsampled_telemetry` (`database.rs:1425–1546`) uses time-bucket `GROUP BY` + `AVG`, honoring `max_points`; the frontend contract caps at 5,000 points and `extract_track(2000)` downsamples the map track server-side.
- **Import pipeline is fast:** DuckDB `Appender` bulk insert (`database.rs:984–1059`); measured ~5,900 pts/s end-to-end including parse + post-import tag steps; file-hash dedup works (re-imports return instantly).
- **No N+1 in `get_all_flights`:** tags fetched in a single batched query (`get_all_flight_tags_with_conn`).
- **ECharts baseline config is right:** `animation: false`, canvas renderer, `symbol: 'none'` — the problem is data volume per series and chart count, not the library config.
- **Selector usage where it matters most:** `Overview.tsx:59–78` uses per-field selectors; `TelemetryCharts.tsx:790` subscribes to `mapReplayProgress` alone.
- **maplibre-gl and html2canvas are lazy chunks** — the mechanism is correct; fix is making the Overview map not need it at t=0 (finding 3), not restructuring the split.
- **Flight data cache** (10-entry Map, `flightStore.ts:496–503`) — good; just remove the artificial 120 ms delay.
- **API surface is quick at current scale:** `/api/flights` ~10 ms, `/api/overview` ~70 ms localhost.

## Suggested fix order

1. **Store selectors + replay-progress isolation** (findings 1, 4) — cheapest, biggest render win.
2. **Compression middleware** (finding 5) — one-line backend change, ~10× payload cut.
3. **echarts/core migration + manualChunks + lazy locales** (finding 3) — ~⅓–½ off the entry bundle.
4. **Chart mount deferral + `sampling:'lttb'` + remove panel-blank + 120 ms delay** (finding 2) — flight-open TTI.
5. **Battery-history batch endpoint** (finding 6), then the scaling items (7, 8) as data grows.
