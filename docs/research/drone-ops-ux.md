# Drone-ops UX research — what makes it feel professional

Workstream: product/UX research for the Skydra rebuild. Research-only; no product code touched.

Base: `skydra/main` @ `d07f195cbcb2b596e0d6405bf57e79f17e662e9e`. Read alongside `docs/product/SKYDRA_PRODUCT.md` and `docs/design/SKYDRA_DESIGN.md` — this document extends, not replaces, both.

Question answered: *what makes professional drone/aviation software feel professional, and what should Skydra's Overview and Flights surfaces look like because of it.*

Sources surveyed: DJI FlightHub 2 (docs, release notes, Virtual Cockpit), Airdata UAV (feature docs, help wiki, reviews), DroneDeploy (fleet/ops docs), FlytBase (docs + published design system), Autel SkyCommand, Skydio Cloud Fleet Manager, PIX4Dcloud, ForeFlight Logbook, QGroundControl/UgCS (ground-control-station conventions), and aviation display standards (EASA ETSO-C113 / SAE AS8034C color-coding, FAA flight-deck human-factors guidance). Links at the end.

---

## 1. Executive summary

Professional ops tools share one structural idea: **a dominant working surface (map or telemetry) with dense, de-emphasized instrument furniture around it — and everything reachable without page-switching.** The "professional" quality does not come from decoration; it comes from density that is *earned* (every element is real data or a real control), operational color semantics (red/amber/green mean things; the brand color never fights them), consistent geometry (1px borders, restrained radii, aligned baselines, mono numerals), and triage-first composition (attention items before statistics).

For Skydra this means:

- **Overview** should lead with an attention/triage strip (maintenance due, battery drift, recent warning events), then a real-data activity summary and the flight-locations map — not a wall of KPI cards.
- **Flights** should be a three-zone master-detail workspace — filter/list rail, dominant map+replay, shared-cursor telemetry — where selection never leaves context.
- Adopt aviation display color semantics as the status layer; keep the restrained orange strictly as the *brand/interaction* accent (FlytBase separates these two layers explicitly — so should we).
- Mono type is a signal, not a style: serials, timestamps, coordinates, voltages, and durations in Geist Mono read as instruments; prose in mono reads as cosplay.

---

## 2. Pattern catalog by product

Steal = adopt for Skydra. Avoid = what professional reviewers/users find dated or what would violate Skydra's design direction.

### DJI FlightHub 2 — live fleet ops, map-first

**What it is:** cloud fleet command center. Live ops, docked drones, mission planning, media library. The reference for "ops room" feel.

**Steal:**

- **Map as the working surface.** Project view and Virtual Cockpit are both built around a large map canvas; panels dock to its edges rather than competing with it. Virtual Cockpit = map window (left, dominant) + livestream (top-right) + flight dashboard strip — one screen, no navigation away mid-task.
- **Edge-furniture layout.** Device lists, annotations, and controls live in rails/docks at the canvas perimeter; the map owns the center. QGroundControl formalizes the same rule — its `toolInsets` system makes every edge widget report its footprint so the map auto-pans before the aircraft disappears under UI.
- **Spatial state on the map itself.** Camera orientation drawn as a dotted view-cone on the map; flight path as a green line; annotations rendered as map layers. State is *shown where it happened*, not tabulated in a side table.
- **Keyboard-first density.** Single-key actions (speed switch `X`, camera `1/2/3`, photo `F`) in the live console — professionals reward discoverable shortcuts for repeat actions.
- **Audible event prompts** for return-to-home, low battery, photo — acknowledge that operators aren't always looking at the screen. (For Skydra, a log-analysis product, the equivalent is *visual* event prominence: warnings on the replay timeline.)

**Avoid:**

- Live-ops furniture that doesn't apply to log analysis (drone control sliders, takeoff buttons). Skydra is post-flight; don't cosplay a cockpit.
- The heavy chrome of enterprise multi-tenant shells (org switchers, project trees) — Skydra's IA is deliberately narrower.

### Airdata UAV — flight-log management; Skydra's closest analog

**What it is:** the incumbent in exactly Skydra's category: log import → flight list → telemetry replay → battery health → maintenance → reports. Its conventions define what experienced drone operators *expect* the screens to contain.

**Steal:**

- **Dense flight list as the spine.** `My Logs → Flights` is a real table: date, aircraft, battery, duration, distance, max altitude, warning counts — scan-able rows, not cards. Filters (pilot/drone/battery/period/keyword/radius/app/tag) sit directly above the list, always visible, never hidden behind a modal.
- **Master-detail without navigation.** Selecting a flight swaps the detail pane in place; the list and its filter state survive. Discovery → investigation is continuous.
- **Replay with synchronized surfaces.** 3D Player: map + telemetry table + configurable columns; the flight path itself is **color-coded by a chosen metric** (altitude AGL, battery charge, distance-from-home, signal strength, GPS sats) — the path becomes a chart, not just a line.
- **Instrument events on the timeline.** Warnings and mode changes are marked along the playback scrubber, not only in a log tab.
- **Battery health as first-class equipment state.** Per-cell voltage deviation, degradation trend lines, "this pack is drifting" alerts *before* failure — Airdata's signature value and the reason fleets pay for it. Skydra already stores per-battery history; surface it.
- **Maintenance as thresholds + countdowns.** Service intervals tracked in flights/hours/calendar with explicit progress ("32/100 flights, 6.2/50 h") — ODL already models this exactly; keep and elevate it.

**Avoid:**

- Airdata's dated surface treatment: boxy light-theme tables, small type, generous whitespace where density was promised. The *information architecture* is right; the *visual execution* is what Skydra should beat.
- Tab sprawl — Airdata splits Flights/Batteries/Drones/Maintenance/Reports/Alerts into six top-level tabs. Skydra's fixed IA (Overview/Flights/Settings) deliberately collapses these; the lesson is to make Overview and Flights carry that collapsed content well.

### DroneDeploy — fleet & site ops, status-first lists

**What it is:** enterprise ops + mapping. Fleet dashboard and project views are the relevant parts.

**Steal:**

- **Equipment rows with answerable status.** Fleet dashboard rows answer "is it working, when did it last fly, who/where is it" in one line — status dot + name + last activity + assignment. Skydra's equipment rail should answer the same for aircraft and batteries.
- **List/Grid/Map view toggle** on collections — one dataset, three presentations, user's choice. For Skydra Flights: table rows vs. compact cards vs. map view of all flight locations is a legitimate toggle, not IA fragmentation.
- **"Quick Access" recency logic.** At the office → most recent; in the field → nearest. Skydra analog: Overview's recent flights sorted by recency; Flights defaulting to the same.

**Avoid:**

- Folder/project-tree apparatus — DroneDeploy's org/team layer is real but Skydra's is profiles; don't mimic the hierarchy chrome.

### FlytBase — autonomous dock ops; the design-system reference

**What it is:** drone-in-a-box autonomy console. Most useful to Skydra because it *published its design system* (FlytBase-26) — a concrete, validated spec for exactly the aesthetic SKYDRA_DESIGN.md describes.

**Steal (all directly verified in their spec):**

- **Charcoal dark as canonical theme.** Page `#1A1A1A`, surface `#242424`, elevated `#2E2E2E`, border `#3D3D3D` — near-identical territory to Skydra's "charcoal/off-white" direction, with proven contrast math.
- **Separate status layer from brand accent.** Their rule: one brand accent (signal orange `#D95B28` — uncannily close to Skydra's orange direction) + a distinct functional status set (success eucalyptus, warning, danger). *Brand colors express identity; status colors are usability signals — never mix them.*
- **Sharp corners, 1px borders, no decorative shadows.** `border-radius: 0` baseline; roundness reserved for status dots. Borders and spacing before elevation.
- **Muted-text floor for WCAG AA.** No text darker than `#8A8A8A` on the dark base; dimmer tokens are borders/decoration only. Gives Skydra a concrete accessibility rule for the muted palette.
- **Mono for metadata.** "Signed telemetry," monospace identifiers; eyebrow labels in mono caps. Matches Geist Sans + Geist Mono intent.
- **Operator voice in copy.** "Short sentences, declarative, specific numbers" — e.g. a label reads "3 batteries over threshold," not "Fleet health summary."
- **Left nav drawer + top bar** for a console product (Operations, Drones, …; notification center top-right). Skydra's floating dock is a deliberate divergence — fine for 3 destinations + 1 action, but *notifications/alerts still need a home* somewhere in the shell.

**Avoid:** nothing structural. The caveat is the opposite — don't copy their brand layer (Lora italic display, green success branding) wholesale; borrow the *rules*, not the identity.

### Autel SkyCommand — multi-role command center

**What it is:** DJI FlightHub-class console for EVO fleets + EVO Nest docks.

**Steal:**

- **Equipment management = usage time + maintenance progress per aircraft *and* per battery**, in the same table. Confirms the Skydra Overview equipment rail should treat aircraft and batteries as one comparable list, not separate silos.
- **Role/authority tiering** (admin/pilot) — relevant only if Skydra ever goes multi-user; note for later, don't build.

**Avoid:** broadcast/livestream grid framing (32 simultaneous streams) — pure live-ops; irrelevant to log analysis.

### Skydio Cloud Fleet Manager — flight-history replay UX

**Steal:**

- **Filter-first flight history:** date, duration, pilot, vehicle filters produce a *summary view* (duration totals, averages, distribution) — filtering isn't just narrowing, it re-answers the aggregate question. Skydra's Flights stats strip should recompute against the active filter set (ODL already does this — preserve it).
- **Replay = PiP map + telemetry strip.** Satellite/street toggle, position marker, speed/distance-from-launch readout scrubbed in sync.
- **Per-pilot / per-vehicle usage rollups** in Reports — aggregated accountability, not raw tables.

**Avoid:** nothing distinctive; its limitation is *shallowness* — thin detail vs. Airdata. Skydra should beat it on detail depth.

### ForeFlight / Garmin (aviation EFB) — logbook & moving-map conventions

**What it is:** the actual aviation analog. ForeFlight Logbook + aeronautical moving maps are what GA pilots call professional.

**Steal:**

- **Sidebar + detail split for logbook.** Entries list on the left, entry detail on the right; the list is filterable in place; selecting never navigates.
- **Entry summaries as scannable rows** — route, aircraft, times, PIC in one line; signatures/attachments as small glyphs, not columns.
- **Separate map theme per app theme.** ForeFlight lets the aeronautical map invert independently of the app chrome (light UI + dark map, and vice versa), plus "invert plates/charts." For Skydra: map tiles (dark Positron-style vs satellite) should be independently controllable from app dark/light.
- **Times section = labeled value grid**, not sentences. Aviation shows data as aligned label:value pairs — this is where mono type earns its place.
- **Drafts/attention queue** — ForeFlight surfaces draft logbook entries needing action at the top of the list. Skydra analog: flights with unreviewed warnings or pending naming.

**Avoid:** skeuomorphic cockpit instruments (artificial-horizon widgets) as decoration — a tilt indicator in a log-analysis app is theme-park, not professional.

### PIX4Dcloud — geospatial work management

**Steal:**

- **Map View as the default dashboard.** Datasets and sites as pins on a map; Drive panel on the left; selecting a map marker highlights the list item and vice versa — two views of one selection state.
- **Zoom-to-all control** — one button frames everything on the map. Cheap, high-value; Skydra's flight-locations map needs it.
- **2D/3D view switcher** for dataset detail.

**Avoid:** upload/processing-progress chrome aimed at photogrammetry pipelines; Skydra's import is lighter-weight.

### QGroundControl / UgCS — ground control stations

**Steal:**

- **Inset-aware canvas.** Widgets report edge occupancy (`toolInsets`) so the map autonomously keeps the aircraft visible — the generalizable rule: *floating UI must never cover the working surface's critical content*; apply it to Skydra's dock over maps.
- **Confirmation slider for destructive ops** — slide-to-confirm on arm/disarm/stop; the professional version of a confirm dialog. Relevant for Skydra's destructive actions (delete flight, clear data).
- **Configurable instrument panel** — operators choose which telemetry values ride the main view. Skydra: let the stats strip / HUD readouts be configurable per user.

**Avoid:** GCS control surfaces (virtual joysticks, guided-mode commands) — again, live-ops chrome for a post-flight product.

### Aviation display standards (EASA ETSO-C113 / SAE AS8034C; FAA flight-deck HF guidance)

Not a product — the reason professional aviation displays look the way they do.

- **Semantic color is codified:** red = warning; amber/yellow = caution; green = engaged modes/normal/safe operation; cyan/blue = sky; white = scales/figures. Operator populations are trained on this — borrowing it is borrowing decades of muscle memory.
- **Consistency across displays is a safety requirement** — same symbol, same color, same position, everywhere. In Skydra terms: one status system reused in Overview, Flights, battery health, and messages; not per-page palettes.
- **Day/night brightness tracking** — dark mode isn't aesthetic in aviation; it's preserving relative luminance so color separation survives ambient changes. Dark theme must preserve status-color distinction at lower luminance.
- **"Other information should not be located where primary flight information is normally presented"** — a zoning rule: promotional/decorative content never occupies the operational surface. For Skydra: no community/donation/marketing content in operational views (already in the product doc's rebrand policy — now it has an aviation precedent).

---

## 3. Cross-product conventions (the distilled pattern)

| Dimension | Professional convention | Examples |
|---|---|---|
| **Working surface** | One dominant canvas — map for ops, chart for analysis — ≥50% of the view | FlightHub 2 Virtual Cockpit, QGC Fly View, Skydio flight screen |
| **Furniture placement** | Rails/docks at canvas edges; selection rails left; actions top-right; status persistent | FlightHub device rail, ForeFlight sidebar, Airdata filter bar |
| **Navigation** | Shallow: master-detail in place, not page hops; tabs only within a selected object | Airdata My Logs, ForeFlight logbook, DroneDeploy project view |
| **Flight list** | Dense table: row = date, aircraft, battery, duration, distance, max alt, warning badge | Airdata flights, Skydio reports |
| **Replay** | Scrubber drives map marker + chart cursor + OSD readouts simultaneously | DJI Fly record, Airdata 3D player, Skydio flight screen |
| **Telemetry charts** | Stacked panels sharing one time axis; mono numerals; restrained palette; per-metric series toggles | ODL's existing TelemetryCharts already does the structural part; Airdata adds metric-coded paths |
| **Status semantics** | Red/amber/green caution-warning-normal layer, separate from brand color | EASA/SAE standards, FlytBase status layer |
| **Equipment health** | Progress-vs-threshold bars (flights, hours, cycles); sorted by attention-needed | Airdata batteries, Autel UAV mgmt, DroneDeploy fleet |
| **Dark mode** | Dark is primary/canonical for ops tools; map theme independent of chrome theme | FlytBase (dark-only canonical), ForeFlight (independent map theme), FlightHub (dark) |
| **Typography** | Sans UI + mono for instruments; labels small, numerals tabular | FlytBase Geist/Geist Mono spec |
| **Voice** | Declarative, numeric, short. "3 batteries over threshold" | FlytBase copy rules |
| **Decoration** | Sharp-to-modest radii, 1px borders, no decorative shadows | FlytBase spec, EASA "non-operational content away from primary info" |

---

## 4. Skydra: Overview — recommended composition

Constraints from `SKYDRA_PRODUCT.md`: answers "what happened recently / what needs attention / health state / notable activity"; every metric derived from real data; no generic KPI-card wall; battery + maintenance live here.

Recommended composition, top-to-bottom (desktop; collapses to a single column on mobile). Named zones so designers and agents can reference them:

```
┌──────────────────────────────────────────────────────────────────────┐
│ A. ATTENTION STRIP — only rows that need action                       │
│   • "Battery TB30-… cell drift 0.18V"        amber    → Flights/equip │
│   • "DJI Mini 4K maintenance due (50/50 h)"  amber    → maintenance   │
│   • "2 flights with warning events this week" amber   → filtered list │
│   (empty state → single quiet line: "No items need attention")        │
├───────────────────────────────┬──────────────────────────────────────┤
│ B. ACTIVITY SUMMARY (text-stats row, not cards)                        │
│   "12 flights · 3h 41m · 27.5 km in the last 30 days"                  │
│   "Last flight: 2026-09-17, DJI Mini 5 Pro, 24m 31s"                   │
├───────────────────────────────┴──────────────────────────────────────┤
│ C. MAP (dominant, ~55-60% width)          │ D. RECENT FLIGHTS          │
│   Flight locations; clusters; zoom-to-all  │ 5-8 dense rows: date,    │
│   + independent map theme toggle           │ aircraft, dur/dist/alt,  │
│                                            │ warning dot → open in    │
│                                            │ Flights                  │
├───────────────────────────────────────────┼──────────────────────────┤
│ E. EQUIPMENT RAIL (aircraft + batteries, one sorted list)              │
│   name · type chip · flights · airtime · threshold progress bar        │
│   sorted: overdue → approaching → healthy; bar color = status layer    │
├──────────────────────────────────────────────────────────────────────┤
│ F. SECONDARY ANALYTICS (collapsed/subordinate, opt-in)                 │
│   activity heatmap · duration/distance trend · top flights             │
└──────────────────────────────────────────────────────────────────────┘
```

Decisions embedded:

- **Attention before statistics.** Every product studied surfaces actionable state first (Airdata alerts, DroneDeploy repair status, ForeFlight drafts). Zone A is derived from data Skydra already has: `flight_messages` warnings, battery cell health history, maintenance thresholds vs. flight/airtime counters.
- **Kill the KPI-card grid, keep the facts.** ODL's current 9-card stat wall becomes zone B — one or two text rows. The numbers stay (they're real), the card chrome goes.
- **Map carries visual importance.** Zone C is the largest single element. This is the PIX4Dcloud/FlightHub "map is the product" pattern — flight locations are the most spatially meaningful aggregate Skydra owns.
- **Recent flights ≠ full list.** Zone D is 5–8 rows linking into Flights; it previews the workspace, doesn't duplicate it.
- **Equipment as one comparable rail.** Aircraft and batteries in a single attention-sorted list (Autel/DroneDeploy pattern). Progress bars against maintenance thresholds reuse ODL's existing threshold model; bar color comes from the status layer, not the accent.
- **Secondary analytics demoted, not deleted.** Donut charts ("flights by drone/battery/duration") are honest data but low decision-value — they move below the fold or behind an expandable, or get cut. The GitHub-style activity heatmap can stay as a compact strip if it fits the aesthetic; it's real activity data.
- **Vanity metrics removed.** "Total data points" is not an operator decision — drop it.

Data availability check (against `context/generated/db-schema.json` + api routes): everything above is computable today from `flights`, `telemetry`, `flight_messages`, `battery_pairs`, equipment thresholds, and `/api/overview` — no new backend required for v1.

## 5. Skydra: Flights — recommended workspace composition

Constraint: one workspace preserving browse/select → stats → map/replay → telemetry → messages → weather → exports, without fragmentation.

```
┌─ FILTER BAR (always visible, collapsible to a summary line) ───────────┐
│ date range · aircraft · battery · tag · keyword · "3 filters active"   │
├───────────────┬────────────────────────────────────────────────────────┤
│ LIST RAIL     │  WORKSPACE (selected flight)                           │
│ (~320-380px,  │  ┌──────────────────────────────────────────────────┐  │
│ collapsible)  │  │ HEADER STRIP: name · date · aircraft · duration  │  │
│               │  │ dist · maxAlt · actions (rename/tag/export/…)    │  │
│ dense rows:   │  ├──────────────────────────────┬───────────────────┤  │
│ ┌───────────┐ │  │ MAP + REPLAY (dominant ~60%) │ RIGHT RAIL/tabs:  │  │
│ │◦ Sep 17   │ │  │ path (metric-colorable),    │ Stats · Messages  │  │
│ │Mini 5 Pro │ │  │ event markers on scrubber,  │ · Weather · Notes │  │
│ │24m·5.6km  │ │  │ home point, aircraft marker │                   │  │
│ │⚠          │ │  ├──────────────────────────────┴───────────────────┤  │
│ └───────────┘ │  │ TELEMETRY: stacked chart panels sharing x-axis   │  │
│ ...           │  │ with the map scrubber — one cursor across all    │  │
│               │  └──────────────────────────────────────────────────┘  │
├───────────────┴────────────────────────────────────────────────────────┤
│ (selection state + filters persist while map/charts swap content)      │
└────────────────────────────────────────────────────────────────────────┘
```

Decisions embedded:

- **Master-detail, not detail-page.** Airdata and ForeFlight both keep the list alive beside the detail; Skydra's product doc demands the same continuity. The list rail filters/sorts in place; selection highlights in both rail and workspace; browser-back isn't the nav model (state-driven shell stays).
- **Filter state drives the stats.** Skydio/Airdata both recompute aggregates on the filtered set — keep ODL's existing behavior of the stats strip reflecting the active filters.
- **Flight row contents:** color chip (existing `color` column), date + name, aircraft, duration/distance/max-alt microstats in mono, warning badge, tag chips. Dense (~56-64px rows) — table-like, not card-like.
- **Map dominates the detail view** (~60% of workspace): the path, event markers, home point, position marker during replay. Right rail holds Stats/Messages/Weather/Notes as tabs or a compact accordion — present but subordinate, per the FAA zoning rule.
- **One cursor, three surfaces.** Replay scrubber, map position marker, and chart crosshair are one shared timestamp (DJI Fly/Airdata/Skydio all do this; it's the single highest-impact "professional" mechanic Skydra can ship). Hover on a chart moves the map marker; scrub the map and the charts follow.
- **Metric-coded path.** Follow Airdata's 3D player: let the user color the flight path by altitude/speed/battery/signal — the map doubles as a chart.
- **Mobile (~420px):** rail becomes the full view; selecting a flight pushes the workspace with map → stats → telemetry stacked vertically; dock stays reachable. This is a stack, not a fragmentation of the IA.

## 6. Making maps and telemetry "carry visual importance"

Concrete treatments, in priority order:

1. **Give them area.** Map ≥55-60% of detail-view area; telemetry panels get real height (~160-220px each), not squashed strips. Importance is allocated in pixels before it's painted.
2. **De-chrome the canvas.** Map controls in one quiet cluster, floating with a real (small) elevation over the canvas — the only place elevation is earned (per design doc). No card frames *around* the map; the map meets the panel edges directly.
3. **Independent map theme.** Dark/light basemap + satellite toggle regardless of app theme (ForeFlight pattern). Dark ops theme + dark tiles = coherence; satellite stays available.
4. **Mono readouts, tabular figures.** Coordinates, altitude, speed, voltages, timestamps in Geist Mono with tabular numerals so scrubbing doesn't jitter the layout — this is the "instrument" feel.
5. **Events on the timeline.** `flight_messages` (warnings, mode changes) rendered as marks on the replay scrubber — the timeline becomes an index into the flight's story.
6. **Restrained chart palette.** Per-series colors from a fixed semantic set (altitude family, battery family, attitude family); never decorative rainbow. Chart gridlines at ~8-12% luminance of foreground; axis labels muted; current values emphasized.
7. **Synchronized hover.** One crosshair across all chart panels + map (see §5). Cheap to add with ECharts `connect`; it's the difference between "dashboard charts" and "flight recorder."

## 7. Status & alert semantics

Adopt the aviation/ops three-state layer, kept separate from the brand accent:

| State | Meaning | Use for |
|---|---|---|
| **Danger (red)** | Needs immediate attention; safety/critical | critical flight messages, maintenance overdue, battery cell failure risk, destructive confirmations |
| **Caution (amber/yellow)** | Attention soon; degraded | maintenance approaching threshold, battery drift/temp warnings, GPS/signal warnings in replay |
| **Normal (green)** | Confirmed healthy / completed | maintenance "done" state, healthy batteries, sync success |
| **Neutral (surface/muted)** | Informational | everything else |

- **Orange stays the brand/interaction accent** — links, focus rings, active selection, primary buttons — and is *not* a status color. This is exactly FlytBase's rule and it prevents the accent from crying wolf.
- **Status colors work on both themes** with adjusted luminance (EASA day/night tracking principle); test danger/amber on charcoal and off-white.
- **Alert copy is declarative and numeric** — "Battery TB30-… cell drift 0.18V" over "Battery health warning detected."
- **Alert ordering:** severity first, then recency. The attention strip shows at most ~3 items + "N more" — triage, not a feed.

## 8. Typography & theme notes

- **Geist Sans + Geist Mono is corroborated** — FlytBase's shipped ops-console spec uses the same pairing (Geist UI, Geist Mono metadata). Confidence: the pairing is proven in this exact product category. Still verify per the design doc's checklist in the running app.
- **Mono = instruments only.** Timestamps, durations, serials, coordinates, telemetry values, hash/IDs, table numerals. Never body copy, never headings.
- **Tabular figures for counters** — any value that animates or scrubs must not reflow.
- **Dark theme as the ops primary.** FlytBase ships dark-canonical; FlightHub/Skydio/QGC are dark-first. Skydra stays dual (design doc mandates both), but dark should be *designed* (charcoal surfaces, AA-compliant muted floor ≥ ~#8A8A8A-equivalent on the dark base) rather than an inverted light theme.
- **Density rhythm:** dense zones (flight list, stats, telemetry) at tighter spacing; quiet zones (Overview prose, Settings) at normal — the FlytBase "dense where useful, quiet elsewhere" rule is already in our design doc and matches the field.

## 9. "What professional feels like" — review rubric

Use this to gate UI PRs. Each line is checkable.

**Composition**
- [ ] One dominant working surface per view (map in Flights detail; map+attention in Overview); ≥50% of the area to the surface, not its furniture.
- [ ] Attention items precede statistics; nothing decorative sits on the operational surface.
- [ ] Selection/filter state survives every interaction; no page-hop resets.
- [ ] Every metric traces to a real query against stored data (no "uptime," "engagement," vanity numbers).

**Density & hierarchy**
- [ ] Lists/tables are scannable rows with aligned columns and mono numerals — not card grids.
- [ ] Labels are short, declarative, numeric ("3 batteries over threshold").
- [ ] Secondary analytics are visibly subordinate (below fold, collapsible, or smaller scale).

**Color & state**
- [ ] Status uses only the danger/caution/normal layer; the orange accent never carries status meaning.
- [ ] Status colors distinguishable in both themes (luminance-adjusted, AA-checked).
- [ ] Warnings visible in list rows, on the replay timeline, and in the attention strip — same event, same color, three surfaces.

**Instruments & interaction**
- [ ] Replay scrubber, map marker, and chart crosshair share one timestamp.
- [ ] Telemetry values in mono tabular type; no jitter while scrubbing.
- [ ] Destructive actions use deliberate confirmation (slider or typed/held confirm, not a bare button).
- [ ] Map theme is independently switchable (dark/satellite) from app theme.

**Craft**
- [ ] 1px borders and spacing before shadows; elevation reserved for floating overlays/dock.
- [ ] Modest radii; no nested-card stacks more than one deep in operational views.
- [ ] Empty states are quiet and instructive ("No items need attention"), not illustrated filler.
- [ ] Works at ~1200px desktop and ~420px mobile without losing the dominant surface.

## 10. Hermes / Photon HQ — ecosystem check

The brief flagged "Hermes" and "Photon HQ" as modern ecosystems to check. Both turned out to be **agent-infrastructure projects, not drone or aviation products** — they belong to the same category as this multi-agent build's own tooling, not to Skydra's UX reference set.

- **Hermes** — Nous Research's open-source personal agent framework (`hermes-agent.nousresearch.com`). Its **Skills Hub** indexes ~90k skills across 11 registries using the `agentskills.io` `SKILL.md` standard; skills live in `~/.hermes/skills/`, install with security scanning, and double as slash commands. *Relevance to Skydra:* none product-side. Workflow-side, it's a data point that the SKILL.md-knowledge convention this build already uses (`.agents/skills/`, curated `context/`, `AGENTS.md`) is an emerging industry standard — our repo's agent-harness approach is aligned with where the ecosystem is going.
- **Photon HQ** — the company behind **Spectrum** (`photon.codes`, GitHub `photon-hq/spectrum-ts`): an open-source SDK + cloud for running AI agents over real messaging channels (iMessage, SMS, WhatsApp, Slack, Discord, voice). *Relevance to Skydra:* not relevant as a UX reference — it's plumbing for agent delivery, not an operator console. The only speculative intersection: if Skydra ever wanted alert delivery into messaging apps, a channel framework like this is the shape of that integration — but that's a product decision far outside current scope.

**Verdict:** neither belongs in the UX pattern catalog. Hermes marginally validates the agent-native repo conventions Skydra already adopted; Photon/Spectrum is out of scope. Recommendation: keep them noted here and move on — no follow-up research warranted.

## 11. Sources

- DJI FlightHub 2 — Virtual Cockpit release: https://enterprise-insights.dji.com/blog/dji-flighthub-2-virtual-cockpit-now-available ; multisource streaming & nav updates: https://enterprise-insights.dji.com/blog/flighthub-2-new-functions ; user guide: https://device.report/m/dd9b8d4b0aa43422208839d3a7770aa2e5c9eaaf7e8d08c6373eb7295cc9ded5_optim.pdf
- Airdata — features: https://airdata.com/features ; 3D Flight Player: https://app.airdata.com/wiki/Help/3D+Flight+Player ; filtering: https://app.airdata.com/wiki/Help/Filtering+flights ; advanced search params: https://app.airdata.com/flight/7 ; third-party review: https://dronebundle.com/blog/airdata
- DroneDeploy — fleet/equipment mgmt: https://help.dronedeploy.com/hc/en-us/articles/1500004861301-Equipment-Pilot-Management ; project view list/map toggle: https://help.dronedeploy.com/hc/en-us/articles/1500004860621-Navigating-the-Project-View ; ops management: https://help.dronedeploy.com/hc/en-us/articles/1500004861321-Drone-Operations-Management-Overview
- FlytBase — platform nav: https://docs.flytbase.com/navigating-flytbase/navigating-your-flytbase-platform ; design system (FlytBase-26): https://designmd.ai/dhirenvalecha/flytbase-26-design-system
- Autel SkyCommand: https://www.autelrobotics.com/productdetail/autel-integrated-command-system/ ; https://auteldronesbaltic.com/en/autel-skycommand-center-en/autel-skycommand-center/
- Skydio Cloud Fleet Manager: https://support.skydio.com/hc/en-us/articles/4402745384475-How-to-use-Fleet-Manager-in-Skydio-Cloud
- ForeFlight Logbook guide: https://www.foreflight.com/logbook-guide ; theme independence: https://blog.foreflight.com/2019/11/18/ios-system-theme-support-add-track-logs-to-logbook-entries-and-more-in-foreflight-11-10/
- PIX4Dcloud Map View: https://support.pix4d.com/hc/map-view-pix4dcloud
- QGroundControl Fly View (toolInsets, instrument panel, confirm slider): https://docs.qgroundcontrol.com/Stable_V5.0/en/qgc-dev-guide/custom_build/fly_view.html
- Aviation display standards — EASA ETSO-C113 color coding (red/amber/green/magenta semantics): https://www.easa.europa.eu/download/etso/ETSO-C113b.pdf ; FAA flight-deck HF guidance (consistency, zoning, day/night): https://hfcc.dot.gov/publications/docs/GeneralGuidance/zz_FAA_GeneralGuidanceDoc_Chapter_03_Section_01.pdf
- Hermes Agent skills/hub: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills ; https://www.agent37.com/blog/hermes-skills-hub
- Photon / Spectrum: https://photon.codes/ ; https://github.com/photon-hq/spectrum-ts
