# UI component landscape for Skydra

Research workstream output. Surveys the approved component pool in `docs/design/SKYDRA_DESIGN.md` plus the wider ecosystem, and turns it into concrete adopt/adapt/reject decisions for Skydra's actual needs.

**Constraints applied** (from `AGENTS.md` / `SKYDRA_DESIGN.md`): React 18.3, Vite 6, Tailwind CSS 3.4, Zustand 5, no shadcn/`components.json` today, no React Router, no animation library today, AGPL-3.0-only repo. No framework upgrades to consume a component. Every external item is source-to-port, never a blind drop-in.

## TL;DR verdict table — approved pool

| Source | Stack req. (verified) | License | Install | Verdict |
|---|---|---|---|---|
| ui.watermelon.sh | React 19 + Tailwind v4 + Motion + Radix | MIT | shadcn registry / copy | **Adapt selectively** — mine simple primitives as reference; TW4 token names must be remapped |
| reui.io | Registry README: React 18+ / Tailwind 3+; current items styled for TW4 | MIT (free tier); Pro gated | shadcn registry / copy | **Adapt selectively** — data-grid (built on TanStack Table) is the best dense-table reference in the pool |
| efferd.com | shadcn (Radix or Base UI), Tailwind | MIT per repo README | shadcn registry / copy | **Weak fit** — mostly marketing blocks; app-shell/drawer/popover blocks usable as reference only |
| amicro.vercel.app | React 19 + Tailwind v4 + Motion | MIT | CLI / shadcn | **Reject** — hard version floor, decorative card/motion toys |
| transitions.dev | Framework-agnostic CSS snippets | Free set copyable; Pro commercial | copy CSS | **Adopt (free set)** — self-contained `t-*` transition classes with reduced-motion guards; no dep |
| motion-primitives.com | Motion + Tailwind + lucide; confirmed working on TW3.4 | MIT | copy / shadcn | **Adapt selectively** — most items are text-effect/decorative; a few (animated number, disclosure) usable if `motion` is adopted |
| smoothui.dev | React 19 + Tailwind v4 + Motion 12 (hard floor in docs) | MIT | shadcn CLI | **Reject** — version floor |
| tailark.com | shadcn, Tailwind (Mist/Dusk/Veil free; Quartz paid) | MIT (OSS kits) | shadcn registry | **Reject** — marketing-site blocks, no app value |
| kokonutui.com | React 19 + Tailwind v4 + Motion | MIT | shadcn / copy | **Reject** — version floor + strong decorative personality |
| cult-ui.com | Tailwind v4 + Framer Motion | MIT | copy / shadcn | **Reject** — design-engineer showcase animations, wrong personality, motion dep for little gain |
| originkit.dev | React/Next/Vite source via CLI | Per-item; account/API-key gated | originkit CLI | **Reject** — auth-gated registry, art/marketing animations |
| mapcn.vercel.app | React 18+, Tailwind (v4-flavored source), MapLibre GL | MIT | shadcn / copy | **Adopt selectively** — MapLibre-based marker/popup/control/loading patterns; Skydra already ships MapLibre + react-map-gl |
| evilcharts.com | shadcn + Recharts or ECharts variants + Motion | MIT | shadcn / npm per-chart | **Reference only** — keep plain ECharts; borrow gradient/label styling ideas. Decoration exceeds design restraint |
| beautiful-ui-five.vercel.app (→ beautifului.dev) | Showcase only — no repo, CLI, or registry | MIT (site) | none — reimplement | **Reject** — AI-chat primitives (thinking traces, tool chips); wrong domain |
| patterncraft.fun | Pure CSS/Tailwind snippets, zero deps | MIT (repo) | copy CSS | **Adopt selectively** — grid/dot/crosshair/circuit patterns fit the instrument brief; empty states, auth/login, About surfaces |
| canvasui.dev | WebGL/WebGPU, experimental html-in-canvas | MIT | shadcn / copy | **Reject** — decorative shader effects; "minimal decoration" forbids it; experimental APIs |
| beam.jakubantalik.com (`border-beam` npm) | React component | MIT | npm | **Reject** — animated border beams are exactly the decorative chrome the design bans |
| metal.jakubantalik.com (`metal-fx`) | React + WebGL | MIT | npm | **Reject** — liquid-metal shader, decorative |
| orbs.jakubantalik.com (`thinking-orbs`) | React + canvas | MIT | npm | **Reject** — AI-agent status orbs; wrong domain |
| agentation.com | Not a component library — annotation/layout tool for agents | — | n/a | **Reject** — dev tool, not UI source |
| aicss.dev | AI-conversation components (React/Vue/Svelte) | MIT | npm `@aicss/react` / shadcn | **Reject** — AI-chat domain (thinking states, streaming text) |
| Disarto icons (`disarto-icons` npm) | Framework-agnostic icon data (574 icons, 24×24) | MIT (artwork; Brands excluded) | npm / copy SVG | **Optional** — consistent set but thin coverage vs react-icons' aggregated families; keep react-icons primary |
| beui.dev | React 19 + Tailwind v4 + Motion | MIT | shadcn `@beui/...` | **Reject** — version floor |

**Pattern across the pool:** most 2025-era registries have moved to React 19 + Tailwind 4 + Motion + shadcn tokens. None of that is adoptable as-is. The pool's real value to Skydra is *source to mine* (mapcn, reui data-grid, efferd overlays) and *framework-agnostic CSS* (transitions.dev, patterncraft) — not drop-in components.

## Ecosystem supplements (verified)

| Package | License | React 18 / TW3 | Role |
|---|---|---|---|
| `@tanstack/react-table` (v8/v9) | MIT | ✅ React 16.8–19 | Headless table engine: sorting, filtering, pinning, selection |
| `@tanstack/react-virtual` | MIT | ✅ | Windowing for dense flight lists |
| `radix-ui` (per-primitive pkgs) | MIT | ✅ React 16.8–19 (verified peer range) | Dialog, Popover, Tooltip, Select, Switch, Slider, DropdownMenu, Tabs, Toolbar |
| `react-aria-components` | Apache-2.0 | ✅ React 16.8+; TW3 via `tailwindcss-react-aria-components@1.x` or native `data-[*]` variants | Alternative primitive base — strongest keyboard/focus/select/slider behavior |
| `cmdk` | MIT | ✅ React 18 | Unstyled ⌘K command palette |
| `sonner` | MIT | ✅ React 18/19 (verified peer range) | Toasts |
| `vaul` | MIT | ✅ React 18/19 | Bottom-sheet drawer (built on radix-dialog) — mobile/Android surfaces |
| `@floating-ui/react` | MIT | ✅ | Anchored positioning if Radix/RAC isn't used for a given overlay |
| `tailwindcss-animate` | MIT | ✅ TW3-native (what TW4-era registries replace with `tw-animate-css`) | enter/exit animation utilities |
| `motion` (motion.dev) | MIT | ✅ React 18+ | Only if a spring/layout animation genuinely needs it — gate per use |
| `lucide-react` | ISC | ✅ | Single consistent icon family option (also reachable via react-icons' `Lu`) |
| `clsx` + `tailwind-merge` (+ optional `class-variance-authority`) | MIT | ✅ | `cn()` foundation for all ported source |

Note on shadcn: the CLI still detects a Tailwind 3 config and scaffolds TW3-compatible base (hsl CSS vars + `tailwindcss-animate`). But initializing full shadcn injects a second token system (`--background`/`--foreground`/…) — the design doc explicitly forbids a second styling system. **Recommendation: do not initialize shadcn. Port chosen components onto `--drone-*`-derived tokens.**

## Per-area recommendations

### 1. Floating bottom dock (Overview / Import / Flights / Settings)

**Build it ourselves on Skydra tokens.** This is the product's signature surface; every pool dock (kokonut's dock, watermelon nav items) is TW4/React-19 source with social-app energy the design doc explicitly warns against.

- Base: semantic `<nav>` + button semantics; Radix `Toolbar`/`Tabs` only if its keyboard model pays off (arrow-key roving).
- Motion: `transitions.dev` free CSS snippets (badge pop, icon swap) — zero deps, `prefers-reduced-motion` guarded. Add `motion` only if layout-spring physics on the centered Import action proves worth the ~30 kB.
- Centered Import = action (opens existing import flow), not a route — matches product invariants.
- Must handle: `env(safe-area-inset-bottom)` (already a `useSafeAreaInsets` hook), dock over map canvas (elevation token), 420px layout, keyboard focus ring tokens.

### 2. Data tables / dense flight lists

**Adopt `@tanstack/react-table` + `@tanstack/react-virtual` (MIT, npm).** Headless — zero token conflicts, works on React 18, and matches the "high-quality tables, dense where useful" brief. Replaces the hand-rolled `FlightList` row virtualization/sort logic rather than fighting it.

- **Reference donor:** ReUI `data-grid` (`@reui/data-grid`, MIT free tier) — it's literally a TanStack Table v9 wrapper with sorting/filtering/pinning/virtual-scroll/selection UX solved. Port interaction *patterns* (sticky header, column controls, dense row affordances), not the files verbatim — its source is TW4-token-flavored.
- AG Grid: not needed; heavier than the need. Recharts/ReUI charts: irrelevant — ECharts stays.

### 3. Settings form controls (selects, toggles, sliders, inputs)

**Adopt a headless primitive base; style on our tokens. Two viable picks:**

- **Radix primitives** (recommended): Select, Switch, Slider, Toggle, Checkbox, RadioGroup — MIT, React 18, and every pool registry (reui, efferd, watermelon) ships Radix variants, so ported source needs the least surgery.
- **React Aria Components** (equal alternative): better select/slider interaction fidelity and i18n; TW3 via `tailwindcss-react-aria-components@1.x` or plain `data-[selected]`/`data-[disabled]` variants. Slightly more porting since pool sources are Radix/Base-UI-flavored.
- Pick **one** base — don't mix.
- Replaces `src/components/ui/Select.tsx` (hand-rolled combobox), raw `<input>` styling, bespoke toggles. Keep `react-day-picker` (already installed) for the date range picker.

### 4. Command palette / quick actions

**Adopt `cmdk` (MIT, npm).** Unstyled, composable, the de-facto ⌘K for React; pair with a Radix `Dialog` shell styled on tokens. Natural fit for "jump to flight / toggle theme / run import / change profile" quick actions. No pool equivalent exists.

### 5. Drawers / panels / popovers / tooltips

- **Popovers/tooltips/dropdowns/dialogs:** Radix primitives (same base as #3) or `@floating-ui/react` if a custom non-focus-trapping anchor is ever needed.
- **Mobile bottom sheets:** `vaul` (MIT) — swipeable snap-point drawer, React 18; fits Android Tauri + mobile web. Efferd's drawer/popover blocks are usable as styling reference only.
- **Flight detail side panels:** custom resizable panes on tokens; do not import a split-pane library unless the resize math gets genuinely hard.

### 6. Toasts, empty states, skeletons

- **Toasts:** `sonner` (MIT, React 18) — style via its `toastOptions`/`classNames` onto our tokens; it takes over the ad-hoc alert flows. Watermelon/reui toast items are just restyled sonner wrappers anyway.
- **Skeletons:** build on tokens — `animate-pulse` + token-colored divs; a shimmer variant is ~15 lines of CSS. No library.
- **Empty states:** build on tokens; a patterncraft grid/dot background snippet can add quiet instrument texture to empty Flights/import states.

### 7. Iconography

**Keep `react-icons` (already shipped) and standardize on families:** Lucide (`Lu*`) as the UI family — clean 24px strokes fit the instrument look — and Game Icons (`Gi*`, e.g. quadcopter/drone glyphs) or `Md*flight*` for aviation-specific concepts Lucide lacks. One import, already bundled, zero new deps.

- **Disarto** (`disarto-icons`, MIT, framework-agnostic ESM): attractive consistency, but 574 icons is thin vs Skydra's domain glyphs (drone, propeller, battery cell, antenna). Revisit only if the icon set visibly clashes after standardizing.
- lucide-react direct (ISC) is equivalent — no reason to add it alongside react-icons.

### 8. Subtle technical/instrument treatments

This is where the pool earns its keep — cheap, compatible, on-brief:

- **patterncraft.fun** (MIT, copy CSS): fine grids, dot matrices, crosshair/circuit patterns — physically resembles chart paper and panel silk-screening. Use sparingly: empty states, auth/import hero, About surface. Never behind data-dense panes.
- **transitions.dev** (free set): CSS-only micro-transitions with `prefers-reduced-motion` guards — hover swaps, panel reveals, badge pops. The right amount of polish for an ops tool.
- **tailwindcss-animate** (MIT): enter/exit utility vocabulary for overlays/dock without taking on `motion`.
- **Geist Mono** (already the candidate) on serials/coords/timestamps + tabular numerals — the cheapest "instrumentation" signal available.
- ECharts stays; borrow restraint-consistent styling cues (gradient restraint, label ticks) from evilcharts' ECharts variants *by eye*, not by install.

## Explicit rejects — with reasons

| Item | Why rejected |
|---|---|
| kokonutui, smoothui, amicro, beui | Hard React 19 + Tailwind v4 floors; Motion-dependent; decorative personalities that conflict with "minimal decoration" |
| watermelon | TW4-first registry; can donate small primitive markup but never as a platform |
| cult-ui | TW4 + Framer Motion; design-engineer showcase animations (navbars, gooey, shaders) — wrong product personality |
| tailark | Marketing-site blocks (hero/pricing/logo-cloud); Skydra has no marketing surface in-app |
| originkit | Auth/API-key-gated CLI; art-site animations (black holes, scramble text) |
| beautiful-ui, aicss | AI-agent-chat primitives (thinking traces, tool-call chips, streaming text) — wrong domain |
| agentation | Not a component library — an annotation/layout dev tool for agents |
| canvasui | WebGL/WebGPU decorative effects + experimental html-in-canvas API (Chrome-flag); violates minimal-decoration and compatibility guardrails |
| beam/metal/orbs (jakubantalik) | Border beams, liquid metal, AI orbs — pure decorative chrome the design doc bans |
| evilcharts (as dep) | Wrapper on Recharts/ECharts + Motion for maximal-chart-decoration look; design wants restrained ECharts — keep reference-only |
| Disarto (as primary set) | 574-icon set too small for aviation domain coverage; keep react-icons |
| Tailark/Efferd marketing blocks | Pricing/CTA/footer blocks are not app surfaces |
| shadcn init (whole system) | Would plant a second token system (`--background`/`--muted`…) next to `--drone-*`; forbidden by design doc's "no second styling system" |

## Suggested adoption manifest

```text
# primitives + behavior
radix-ui primitives needed (select, switch, slider, checkbox,
  radio-group, dialog, popover, tooltip, dropdown-menu, tabs, toolbar)
@tanstack/react-table      # flight list + dense tables
@tanstack/react-virtual    # long-list windowing
cmdk                       # command palette
sonner                     # toasts
vaul                       # mobile bottom sheets
clsx + tailwind-merge      # cn() for ported source
tailwindcss-animate        # enter/exit animations (TW3-native)
# optional, gate per use:
motion                     # only if dock/overlay springs need it
# copy-in (no deps):
transitions.dev free snippets, patterncraft grid/dot snippets
```

## Adoption order (sequencing-safe)

1. `cn()` util + token mapping (`--drone-*` → semantic tokens) — prerequisite for all ported source.
2. Primitive base (Radix) + form controls for Settings.
3. TanStack Table + Virtual behind Flights.
4. cmdk palette (uses Dialog primitive).
5. sonner (replaces ad-hoc alerts as surfaces migrate).
6. Dock — custom build, last, once tokens/primitives exist.
7. Selective ports (mapcn patterns, reui grid patterns, transitions/patterns) as surfaces land.

## Risks / caveats

- **TW4 source drift:** every pool registry is trending TW4-only. Any paste-in must be audited for `@theme`/oklch/`tw-animate-css`/`size-*`-and-newer utilities. TW3.4 does support `size-*` and `starting:` but not `@theme` or `tw-animate-css`.
- **ReUI dual signal:** repo README claims React 18+/Tailwind 3+ while current docs say "built on React 19 + Tailwind v4" — treat each item's fetched source as the truth; the data-grid's value is its TanStack-based architecture even if markup needs token surgery.
- **License surface:** all adopted npm deps are MIT/Apache-2.0/ISC — AGPL-compatible. Pro/gated tiers (reui Pro, tailark Quartz, efferd paid blocks, transitions Pro, originkit) are excluded; don't configure their auth registries.
- **Agent rule reminder:** any ported component gets the AGENTS.md treatment — adapt tokens/typography/radius, run the real app, check dark/light + 420px, drop it if it's worse in context.
