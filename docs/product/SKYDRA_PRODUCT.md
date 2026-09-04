# Skydra product direction

## Product definition

Skydra is a professional web-first drone flight operations and analysis product built from the Open DroneLog codebase. The transformation should preserve mature log-processing and flight-analysis capabilities while replacing open-source-project framing with a coherent product experience.

## What is already valuable

Preserve and improve, rather than rewrite:

- drone log imports and parsers
- flight history and search/filtering
- telemetry
- maps and replay
- analytics
- batteries
- maintenance
- weather
- reports and exports
- profiles/settings

## Initial information architecture

Primary destinations:

- Overview
- Flights
- Settings

Primary action:

- Import

Import is an action, not a destination. It should be prominent and globally reachable, including from the navigation shell, but should not create a fourth content section.

Do not create Jobs, Fleet, Batteries, Maintenance, Reports, or other top-level destinations until a product decision explicitly adds them.

## Overview

Overview is the high-signal operational summary. It may combine the existing aggregate data, batteries, maintenance, recent/important flights, and useful map/analytics context.

It should answer questions such as:

- What has happened recently?
- Is anything requiring attention?
- What is the current battery/maintenance health?
- What flight activity or geography is notable?

Avoid generic KPI-card dashboards. Every metric must derive from real data and support an operator decision.

## Flights

Flights is the product's strongest and most important workspace. Preserve the functional relationship between:

- browsing, filtering, and selecting flights
- flight stats and metadata
- map and replay
- telemetry charts
- messages/events
- weather
- exports and reports

Do not split this into many disconnected pages simply to make the IA look larger. The user should be able to move from flight discovery to investigation without losing selection/context.

## Settings

Settings should become a first-class destination instead of a giant legacy modal, but the transformation must preserve existing settings/profile behavior and cross-platform constraints.

Settings should use normal product grouping and progressive disclosure. Do not expose community/support/donation surfaces in normal settings. Required license/source information belongs in About/Licenses/Source.

## Rebrand policy

Remove normal-workflow references to:

- Open DroneLog branding where not required for compatibility/legal attribution
- Ko-fi/donation prompts
- supporter promotion and badges
- upstream GitHub/Discord/community promotion
- legacy project terminology

Do not blindly rename internal identifiers. Persisted data paths, parser compatibility markers, package/application IDs, schema keys, export compatibility, and platform identifiers require migration analysis before changes.

## Open-source/legal surface

Skydra derives from AGPL-licensed software. Preserve required license/copyright notices and provide required source access to users of deployed modified network versions. Put product-facing legal/source access in a discoverable About/Licenses/Source surface rather than operational workflows.

## Product sequencing

Foundation before polish:

1. establish the canonical integration base and product/agent instructions
2. reconcile the rebrand without compatibility regressions
3. establish navigation shell and design tokens/primitives
4. reshape Overview on that foundation
5. reshape Flights while preserving its strong information relationships
6. migrate Settings from the legacy modal
7. perform cross-mode QA, accessibility, performance, and legal/source-surface review

Avoid simultaneously redesigning shell, Overview, Flights, and Settings in isolated branches. Shared shell/tokens create unnecessary collision and rework if they are not merged first.
