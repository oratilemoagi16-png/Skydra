# Skydra design direction

## Product character

Skydra should feel like professional drone operations software, not a generic SaaS dashboard and not a reskinned open-source utility.

Core direction:

- dark/light capable
- charcoal / off-white foundation
- restrained orange accent
- thin borders
- strong typography
- dense where operationally useful
- quiet elsewhere
- high-quality tables
- maps and telemetry should carry visual importance
- minimal decoration
- subtle instrument/technical details

Avoid:

- purple gradient SaaS styling
- glassmorphism everywhere
- generic AI dashboard cards
- excessive rounded nested containers
- random colors
- fake enterprise metrics
- decorative chrome that competes with flight data

## Typography

Current candidate:

- Geist Sans for product UI
- Geist Mono selectively for telemetry, identifiers, coordinates, timestamps, serials, and technical values

This is a candidate, not a permanent lock. Before adopting it globally, compare it in the running app against the existing Inter setup across:

- flight list density and wrapping
- selected-flight stat rows
- telemetry labels and chart legends
- map controls/tooltips
- Overview cards/tables
- Settings forms
- 420px-class mobile layout
- generated reports and image exports where the visible app font affects layout

Do not load fonts from an external CDN if a self-hosted/open-source package or checked-in webfont approach is practical and compatible with product CSP requirements.

## Design-system migration

The current application uses Tailwind 3 utilities plus a large global CSS file and `--drone-*` variables. Do not replace the entire styling substrate in one change.

Recommended approach:

1. define semantic Skydra tokens for background, surface, elevated surface, text, muted text, border, accent, danger, warning, success, focus, and map/chart-adjacent states
2. map existing legacy tokens/classes to those semantics during migration
3. migrate shared shell/primitives first
4. migrate feature surfaces incrementally
5. remove legacy overrides only when their usages are gone

Avoid introducing a second full styling system.

## Component policy

Priority:

1. existing Open DroneLog / Skydra component and logic
2. refactor/recompose existing component
3. approved free/open-source/free-tier component source
4. new custom component only when needed

Approved sources:

- https://ui.watermelon.sh/
- https://reui.io/
- https://efferd.com/
- https://amicro.vercel.app/
- https://transitions.dev/
- https://motion-primitives.com/
- https://smoothui.dev/
- https://tailark.com/
- https://kokonutui.com/
- https://cult-ui.com/
- https://originkit.dev/
- https://mapcn.vercel.app/
- https://evilcharts.com/
- https://beautiful-ui-five.vercel.app/
- https://patterncraft.fun/
- https://canvasui.dev/
- https://beam.jakubantalik.com/
- https://metal.jakubantalik.com/
- https://orbs.jakubantalik.com/
- https://agentation.com/
- https://aicss.dev/
- https://github.com/Disarto/disarto-icons

Do not search random UI libraries unless these sources cannot satisfy a real technical need.

When considering an external component:

- inspect the rendered example, not only its source
- identify the specific usability or visual problem it solves
- inspect license and dependency implications
- avoid framework upgrades solely to consume it
- adapt tokens, spacing, typography, radius, interaction, and responsiveness to Skydra
- run the real application
- inspect dark/light and relevant responsive states
- remove or revise it if it is worse in context

Skydra should not inherit a component library's personality.

## Navigation shell

Current direction is a premium floating bottom dock containing:

- Overview
- Flights
- centered Import action
- Settings

The dock should feel deliberate and professional, not like a mobile-social-app nav bar enlarged for desktop. It must coexist with dense flight workflows, maps, native mobile safe areas, and keyboard/accessibility requirements.

Import launches the existing import capability rather than becoming its own destination.

## Data visualization

Reuse ECharts, MapLibre, and deck.gl unless a product requirement cannot be met.

- Keep map canvas area generous in flight investigation views.
- Chart decoration should be restrained.
- Technical values can use mono typography selectively.
- Avoid chart palettes with unrelated decorative colors.
- Preserve replay, hover, selection, and map control usability in both themes.

## Shape, spacing, and elevation

- Prefer modest radii rather than pillifying the whole interface.
- Avoid card-inside-card-inside-card structure.
- Use borders and spacing before shadows.
- Reserve stronger elevation for overlays, dock, popovers, and important floating controls.
- Dense operational panes can use tighter spacing than Overview/Settings.

## Visual verification

A UI task is not complete from source inspection or a successful build alone. Inspect the real app after integration, including data-populated states where possible. Compare screenshots before/after for hierarchy, density, clipping, contrast, map sizing, and responsive behavior.
