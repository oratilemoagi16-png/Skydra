# Skydra legal & attribution requirements

Audit of AGPL obligations and the merged rebrand (pre-rebrand base `d8c00eb` → `skydra/main`). Product doc reference: `docs/product/SKYDRA_PRODUCT.md` (rebrand policy, open-source/legal surface).

## 1. AGPL-3.0 obligations for Skydra

Skydra is a modified version of Open DroneLog (upstream: `github.com/arpanghosh8453/open-dronelog`), licensed AGPL-3.0-only. Two clauses matter operationally:

**§5 — notices.** Every file/conveyance must retain existing copyright and license notices and carry "prominent notices stating that you modified it, and giving a relevant date". Practical meaning for us:

- `LICENSE` must remain verbatim AGPL-3.0 — ✅ currently intact, including upstream `Copyright (c) 2026 Arpan Ghosh` grant paragraph.
- Source file copyright headers must NOT be removed. ✅ No source-file copyright headers were stripped (the codebase carries almost none; the few notices that exist survive — e.g. `src/lib/mapStyles.ts` attribution comments).
- "Modified" notice: recommended (not strictly machine-enforced) — a visible line such as `Skydra, based on Open DroneLog` plus the LICENSE pointer satisfies the spirit; put it in the About surface and in README.

**§13 — remote network interaction.** Because the modified program runs on a server (Axum web backend) and users interact with it remotely, Skydra "must prominently offer all users" an opportunity to receive the Corresponding Source of the *modified* version. In practice:

- A persistent, discoverable in-product affordance — e.g. "Source" inside Settings → About — linking to the Skydra source repository (this repo), satisfying the offer-of-source requirement as long as the repo is publicly accessible.
- If Skydra is ever deployed without a public repo, §13 requires serving source another way (download tarball endpoint). Keep the repo public and this stays a link.
- Removing the affordance while keeping network deployment = non-compliance.

Trademarks: keep the README disclaimer block (DJI / DroneLogbook / Litchi / Airdata are third-party marks, unaffiliated). The rebrand README should retain it — verified present on `skydra/main` README? See finding F4.

## 2. In-product "About / Licenses / Source" surface spec

Belongs in the Settings destination (first-class, per product doc), not operational workflows. Proposed structure — a single "About" group with three blocks:

**About Skydra**
- `Skydra <version>` (from `__APP_VERSION__`), build/commit if available
- One-line product description: "Drone flight operations and log analysis."
- "Skydra is based on Open DroneLog (AGPL-3.0). Copyright © 2026 Arpan Ghosh and contributors; Skydra modifications © 2026 Oratile Moagi." — satisfy §5 prominently.
- Link: upstream `github.com/arpanghosh8453/open-dronelog` (as attribution, not promotion).

**Licenses**
- AGPL-3.0 badge/link → local `LICENSE` copy (bundle `LICENSE.txt` into `public/` or render inline — do not link to GitHub raw as the only access; web deployments may be offline/self-hosted).
- Third-party license list (see §3 — generate from package.json + Cargo.toml at build time or maintain a curated list).

**Source code**
- "Skydra is free software under AGPL-3.0. The complete source for this version is at github.com/oratilemoagi16-png/Skydra" + link.
- Optional: `GET /api/source` or static file serving a source tarball if the repo is ever private — not required while public.

## 3. Rebrand audit findings

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| F1 | Backend retains dead upstream supporter machinery: `/api/supporter/verify`, `/status`, `/remove`, `/donation` routes + `SUPPORTER_HASH` (upstream author's personal donation code) in `server.rs` ~2181–2270, plus `donation_acknowledged`/`supporter_badge_active` settings keys | medium | Remove routes + store accessor on frontend (`loadSupporterStatus`/`supporterBadgeActive`); keep DB settings keys harmless (deleting them is cosmetic, not compat). Reconcile child owns UI; backend route removal is a follow-up PR |
| F2 | i18n still ships donation/banner/supporter keys (`app.bannerText`, `app.bannerBy`, `app.bannerSupport`, `app.dismissBanner`, `overview.donationNote*`, `settings.donationStatus`, `settings.supporterDescription`) rebranded to solicit donations *for Skydra* | high | Remove keys + all rendering — covered by reconcile workstream |
| F3 | Persisted identifiers correctly preserved: tauri `identifier: com.drone-logbook`, package/bundle ids, DB paths, storage keys (`sidebarWidth` etc.) untouched | — | verified, no action |
| F4 | README.md on `skydra/main` still shows upstream badges/logo/trademark disclaimer and "Open DroneLog" framing — public-facing surface, not in-app | low | Rewrite README for Skydra when the product settles; keep the trademark disclaimer and AGPL/license section verbatim |
| F5 | Upstream GitHub workflows still present: `android.yml`, `build.yml`, `docker.yml`, `nightly-build.yml`, `nightly-docker.yml`, `publish-play-store.yml`. They reference upstream secrets (absent here → fail/no-op) but `publish-play-store.yml` + release workflows are dead weight and can create noise releases/tags if triggered | medium | Strip publish/release/codeberg-style workflows not applicable to this repo; replace `build.yml` later with a minimal Skydra CI (typecheck + build + cargo check) — product decision, don't silently delete |
| F6 | `docs/manual.md`, `docs/api-guide.md`, `docs/custom_parsers.md` still upstream-branded | low | fold into docs pass during Settings/About work |
| F7 | `getBackupFilename()` now produces `*_Skydra.db.backup` — old `*_Open_Dronelog.db.backup` files still restore (filter is extension-based) | — | verified compatible, no action |

## 4. Third-party license hygiene (spot check)

- All major deps are permissive (MIT/Apache-2.0/BSD): React, Vite, Tailwind, Zustand, ECharts (Apache-2.0), MapLibre GL (BSD-3), deck.gl (MIT), react-icons (MIT), i18next (MIT), axum/tokio/serde/reqwest (MIT), duckdb-rs (MIT), arrow (Apache-2.0), argon2 (MIT/Apache), `dji-log-parser` (verify — MIT), `reverse_geocoder`, `tauri-plugin-android-fs-api` (verify).
- **Fonts:** Inter is OFL-1.1 — self-host + include OFL license text in Licenses surface if bundled. If Geist is adopted (also OFL-1.1 via Vercel), same rule.
- **Map tiles:** CARTO basemaps + Esri World Imagery + OSM require on-map attribution — ✅ already rendered via MapLibre attribution control. Keep it visible; don't hide it during any map restyle.
- **Fonts/CDN:** index.html currently loads Inter from Google Fonts CDN — when typography lands, self-host (also removes a privacy/CSP concern).
- No GPL/copyleft conflicts found among runtime deps; AGPL stays the product license.

## 5. Prioritized actions

1. Reconcile child: remove donation/supporter UI + i18n keys (in flight).
2. Follow-up: remove `/api/supporter/*` backend routes + frontend store accessors; leave DB keys dormant.
3. When Settings migrates: implement About / Licenses / Source per §2 — this is the §13 offer-of-source for web deployments.
4. Strip dead upstream publish/release workflows; add minimal Skydra CI (build + typecheck + cargo check + context:check).
5. Bundle `LICENSE` into the web build (`public/`) and self-host fonts.
6. Rewrite README for Skydra (keep trademark disclaimer + license section).
