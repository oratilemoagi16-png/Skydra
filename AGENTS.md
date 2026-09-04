# Skydra agent instructions

This file is the control plane for autonomous coding agents. Keep it short. Read the linked source-of-truth docs before making product or UI decisions.

## Mission

Skydra is a professional web-first drone flight operations and analysis product built from Open DroneLog. Preserve the mature flight-log functionality and transform the product around it. Do not rewrite working parsers, telemetry, maps, replay, analytics, batteries, maintenance, weather, reports, exports, profiles, or settings logic unless a task requires a targeted change.

## Read first

- Product direction and information architecture: `docs/product/SKYDRA_PRODUCT.md`
- Visual system and component policy: `docs/design/SKYDRA_DESIGN.md`
- Agent, branch, integration, and verification workflow: `docs/engineering/AGENT_WORKFLOW.md`
- Existing architecture/runtime context: `context/README.md`, `context/domains/*.json`
- User-facing behavior and legacy feature inventory: `docs/manual.md`

Treat code as the authority for current implementation. Treat the Skydra docs above as the authority for target product behavior. If curated `context/` metadata disagrees with code, report the drift and fix it in-scope rather than trusting stale metadata.

## Product invariants

- Primary destinations are `Overview`, `Flights`, and `Settings`.
- `Import` is a prominent action, not a destination.
- Do not invent Jobs, Fleet, Batteries, Maintenance, Reports, or other top-level destinations without an explicit product decision.
- Battery health and maintenance belong inside Overview for now.
- Flights is the core operational workspace. Preserve the relationship between browsing/selection, stats, map/replay, telemetry, messages, weather, and exports/reports.
- Required open-source/legal information belongs in an appropriate About/Licenses/Source surface, not normal operational workflows.

## Architecture and compatibility guardrails

Current stack: React 18 + TypeScript + Vite 6, Zustand 5, Tailwind 3, ECharts, MapLibre/deck.gl, Rust/Tauri v2, Axum web backend, DuckDB.

- The application supports web/Docker, desktop Tauri, and Android Tauri. Do not optimize one mode by silently breaking the others.
- The frontend currently uses a state-driven single-page shell, not React Router. Do not introduce a router solely for visual navigation.
- Preserve existing database paths, schemas, profile data, import compatibility, exported data compatibility, Tauri identifiers, Android bundle identifiers, and other persisted/internal identifiers unless the task includes an explicit migration plan.
- Do not perform major React, Tailwind, Tauri, Rust, map, or charting upgrades to enable a UI component.
- Be careful with global CSS, fixed-height root layout, safe-area handling, MapLibre controls, report/print output, HTML canvas exports, and native file pickers.

## Component policy

Use this order:

1. Existing Open DroneLog / Skydra component and logic.
2. Refactor or recompose an existing component.
3. Adapt a free/open-source/free-tier component from the approved sources in `docs/design/SKYDRA_DESIGN.md`.
4. Build new only when necessary.

Never paste an external component blindly. Inspect its rendered example, understand the value it adds, adapt it to Skydra, run the real app, visually inspect it in context, and remove or revise it if it does not improve the product.

## UI direction

Professional drone operations software. Dark/light capable. Charcoal and off-white foundation, thin borders, restrained orange accent, strong typography, operational density where useful, quiet surfaces elsewhere, high-quality tables, and visually important maps/telemetry.

Avoid purple-gradient SaaS styling, glassmorphism everywhere, generic AI dashboard cards, excessive nested rounded containers, random colors, fake enterprise metrics, and decorative UI that competes with flight data.

Typography is not permanently locked until verified in the real app. Geist Sans + Geist Mono is the current candidate. If adopted, test metric-sensitive layouts, charts, maps, mobile, reports, and exports.

## Agent workflow

- One thread owns one coherent workstream.
- Record the branch/base commit at the start of a task.
- Hoplite threads are isolated sandboxes. Never assume another thread's unmerged files exist.
- Parallelize independent work only. If work depends on shell, tokens, shared types, or another branch's component structure, wait for that dependency to merge or explicitly stack on that branch.
- Before substantive work, sync/rebase onto the designated integration base if it changed.
- Keep diffs focused and reviewable. Do not opportunistically redesign unrelated screens.
- For large UI changes, first inspect and plan, then implement. Do not spend a long run polishing a screen built on an unsettled shell/design system.
- Report discovered architectural, licensing, migration, accessibility, or workflow risks instead of silently working around them.

## Required verification

For code changes, run the relevant checks after the final edit. Baseline commands include:

- `npm ci`
- `npm run build`
- `npm run build:web` when web behavior changes
- `npm run context:check` when context/source metadata changes
- `cargo check --no-default-features --features web` for Rust/backend-affecting work
- `cargo test --no-default-features --features web` for Rust/backend-affecting work

User-facing UI work is not done after a successful build. Start the real application and visually inspect the changed flow. At minimum verify dark and light modes, a desktop viewport around 1200px or wider, and the 420px-class mobile layout when the touched surface is responsive. Check empty/no-flight state and populated/selected-flight state when relevant. Capture fresh screenshot/video evidence in the agent run or PR.

Do not claim a check passed if it was not run. State environment blockers explicitly.

## Licensing

This repository is AGPL-3.0-only. Preserve the license, existing copyright notices, and required legal notices. A deployed modified network version must provide users the required source-code access. Product rebranding must not remove obligations that attach to the covered work. Keep legal/source access discoverable through an appropriate product surface.
