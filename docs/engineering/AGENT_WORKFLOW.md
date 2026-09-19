# Skydra autonomous-agent workflow

## Goal

Use autonomous coding agents as parallel engineering capacity without creating branch drift, duplicated redesigns, or merge-heavy rework.

## Core rule: one canonical integration base

At any moment there must be one branch/commit designated as the base for new product work. Agents must record that base commit when starting.

Do not start new UI work from a stale `main` merely because another thread is still implementing a foundational branch. Either wait for the dependency to merge or explicitly stack the new thread on the dependency branch.

## Workstream ownership

Each thread owns one coherent outcome and should avoid broad drive-by refactors.

Good parallel workstreams have low file overlap and no hidden dependency, for example:

- legal/source-attribution analysis
- test/QA harness improvements
- isolated parser compatibility tests
- design research that produces recommendations rather than touching shared shell code

Bad parallel workstreams include:

- app shell and Overview redesign when both modify `Dashboard.tsx`, root layout, global tokens, and responsive behavior
- global design-token migration and independent page redesigns based on old tokens
- settings architecture and app-shell navigation if both independently change how Settings is mounted

## Dependency/merge order

For the current Skydra transformation:

1. foundation instructions and canonical product direction
2. reconcile/review the rebrand and compatibility choices
3. shared design tokens/primitives and app shell/navigation
4. Overview
5. Flights workspace
6. Settings migration
7. cross-product QA/accessibility/performance/legal-source review

Flights and Settings can become parallel after the shell/tokens are stable if their ownership boundaries are explicit.

## Starting a task

The agent should:

1. read root `AGENTS.md` and relevant linked docs
2. inspect current code before proposing implementation details
3. report the current branch and base commit in its work log/PR
4. identify upstream dependencies and overlapping active workstreams
5. sync/rebase to the designated integration base before implementation
6. inspect the running app before a large UI change when the environment permits

Prompts should state mission, product context, ownership, important constraints, and definition of done. Do not prescribe line-by-line implementation unless a specific implementation is required.

## During the task

- Prefer small coherent commits.
- Keep behavior-preserving refactors separate from product/visual changes where practical.
- Do not rename persisted/internal compatibility identifiers as part of cosmetic rebranding.
- Do not upgrade major frameworks to unblock optional UI components.
- If a foundational assumption proves wrong, stop polishing and fix or escalate the foundation first.
- If the integration base moves materially while the task is running, rebase/sync before final visual QA.

## Definition of done

A code-producing agent must provide:

- concise implementation summary
- exact files/areas materially changed
- tests/checks actually run and results
- screenshot/video evidence for meaningful UI work when possible
- known issues or unverified modes
- migration/compatibility implications
- the final branch/head commit or PR

UI work additionally requires inspection of the running application, not only static source review.

## Review gates

Foundation/shared-shell PRs should be reviewed before downstream polish begins.

Do not merge simply because an agent says tests passed. Verify that:

- the branch is based on the expected integration base
- changed files match the stated ownership
- compatibility-sensitive changes are intentional
- CI/checks are actually present or independently reproducible
- product IA and component policy are respected
- the visual result was inspected in real context

## Rebase and reconciliation

When two isolated threads touch overlapping files:

- choose the branch representing the newer product foundation as the reconciliation base
- rebase or recreate the dependent work against that base
- preserve the intent of the dependent work, not necessarily its exact patch
- rerun verification after reconciliation

Do not mechanically merge conflict markers in UI/layout files when both branches independently changed architecture. Recompose the intended result against the new base.

## Expensive-agent discipline

Before spending a long autonomous run, ask whether the task depends on an unsettled decision in any of these areas:

- branding/compatibility
- root navigation/IA
- design tokens/typography
- shared shell/layout
- routing/state architecture
- legal/source attribution

If yes, resolve the dependency first. Use cheaper/shorter analysis runs for audits and research before long implementation/polish runs.

## Verification matrix

Baseline frontend:

- `npm ci`
- `npm run build`
- `npm run build:web` for web-affecting changes

Context changes:

- `npm run context:check`

Rust/backend:

- `cargo check --no-default-features --features web`
- `cargo test --no-default-features --features web`

UI smoke matrix when relevant:

- dark mode
- light mode
- desktop around 1200px+
- 420px-class mobile layout
- empty/no-flight state
- populated/selected-flight state
- import flow if touched
- map/replay if touched
- print/report/image export if styling could affect it
- Tauri/native file behavior if file controls are touched

## Context hygiene

The repository already contains machine-readable context under `context/`. It is useful only if it is current.

- Code remains authority for current implementation.
- Curated product docs remain authority for intended Skydra direction.
- Generated context must be regenerated, not hand-edited.
- Curated context metadata should be updated when its claims become stale.
- Schema validation alone does not prove semantic freshness. Version, ownership, and product-name drift must be reviewed.
