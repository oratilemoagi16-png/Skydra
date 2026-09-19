#!/usr/bin/env node
/**
 * Collects the third-party license inventory for the About → Licenses surface.
 *
 * Sources:
 *   - package.json + package-lock.json (+ installed package.json fallback)
 *     → production JavaScript dependencies (dev-only entries excluded)
 *   - cargo metadata (src-tauri/Cargo.toml + Cargo.lock)
 *     → resolved Rust crates with license fields
 *   - docs/legal/attribution.json — curated overlay for things manifests can't
 *     express (upstream attribution, font licenses, map data providers, license
 *     corrections)
 *
 * Outputs:
 *   - src/generated/licenses.json
 *   - public/LICENSE.txt (verbatim copy of the repo LICENSE)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outJson = path.join(root, 'src/generated/licenses.json');
const overlayPath = path.join(root, 'docs/legal/attribution.json');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function normalizeLicense(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.type) return value.type; // legacy {type,url}
  if (Array.isArray(value)) return value.map(normalizeLicense).filter(Boolean).join(' OR ');
  return null;
}

// --- JavaScript dependencies (production closure from the lockfile) -----------
function collectNpm() {
  const lockPath = path.join(root, 'package-lock.json');
  if (!fs.existsSync(lockPath)) return { entries: [], warning: 'package-lock.json missing' };
  const lock = readJson(lockPath);
  const packages = lock.packages ?? {};
  const byName = new Map();

  for (const [pkgPath, meta] of Object.entries(packages)) {
    if (!pkgPath.startsWith('node_modules/')) continue;
    if (meta.dev) continue; // dev-only dependency — not shipped
    const name = pkgPath.slice(pkgPath.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (!name || name.startsWith('.')) continue;

    let license = normalizeLicense(meta.license);
    if (!license) {
      const nmPkg = path.join(root, pkgPath, 'package.json');
      if (fs.existsSync(nmPkg)) {
        try {
          const p = readJson(nmPkg);
          license = normalizeLicense(p.license) ?? normalizeLicense(p.licenses);
        } catch { /* keep null */ }
      }
    }
    const existing = byName.get(name);
    const entry = { name, version: meta.version ?? null, license };
    // Prefer the shallowest (first-hoisted) copy when duplicates exist
    if (!existing || pkgPath.split('node_modules/').length < existing.depth) {
      byName.set(name, { ...entry, depth: pkgPath.split('node_modules/').length });
    }
  }

  return {
    entries: [...byName.values()]
      .map(({ depth, ...e }) => e)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// --- Rust crates ---------------------------------------------------------------
function collectCargo() {
  try {
    const out = execFileSync(
      'cargo',
      ['metadata', '--format-version', '1', '--manifest-path', path.join(root, 'src-tauri/Cargo.toml')],
      { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const meta = JSON.parse(out.toString('utf8'));
    const workspace = new Set(meta.workspace_members ?? []);
    const seen = new Set();
    const entries = [];
    for (const p of meta.packages ?? []) {
      const id = `${p.name}#${p.version}`;
      if (workspace.has(p.id) || seen.has(id)) continue;
      seen.add(id);
      entries.push({ name: p.name, version: p.version ?? null, license: p.license ?? null });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name) || (a.version ?? '').localeCompare(b.version ?? ''));
    return { entries };
  } catch (err) {
    return collectCargoFromLock(err);
  }
}

// Fallback when cargo is unavailable (e.g. web-only build hosts): names+versions
// from Cargo.lock, licenses best-effort from the local registry cache.
function collectCargoFromLock(cause) {
  const lockPath = path.join(root, 'src-tauri/Cargo.lock');
  if (!fs.existsSync(lockPath)) {
    return { entries: [], warning: `cargo metadata failed and Cargo.lock missing (${cause.message})` };
  }
  const toml = fs.readFileSync(lockPath, 'utf8');
  const entries = [];
  const re = /\[\[package\]\]\s*\n(?:.*\n)*?\s*name\s*=\s*"([^"]+)"\s*\n\s*version\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(toml))) {
    entries.push({ name: m[1], version: m[2], license: lookupRegistryLicense(m[1], m[2]) });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return { entries, warning: `cargo metadata unavailable (${cause.message}); used Cargo.lock` };
}

function lookupRegistryLicense(name, version) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const registrySrc = path.join(home, '.cargo/registry/src');
  try {
    for (const registry of fs.readdirSync(registrySrc)) {
      const tomlPath = path.join(registrySrc, registry, `${name}-${version}/Cargo.toml`);
      if (!fs.existsSync(tomlPath)) continue;
      const match = /^license\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(tomlPath, 'utf8'));
      if (match) return match[1];
    }
  } catch { /* no registry cache */ }
  return null;
}

// --- Overlay merge -------------------------------------------------------------
function applyOverlay(groups, overlay) {
  const overrides = overlay.dependencyOverrides ?? {};
  for (const group of groups) {
    for (const entry of group.entries) {
      const o = overrides[entry.name];
      if (o) Object.assign(entry, { ...entry, ...o });
    }
  }
  const byId = new Map(groups.map((g) => [g.id, g]));
  const curated = [];
  for (const extra of overlay.groups ?? []) {
    const target = byId.get(extra.id);
    if (!target) {
      curated.push(extra); // curated groups (notices, fonts, map data) lead
      continue;
    }
    const byName = new Map(target.entries.map((e) => [e.name, e]));
    for (const e of extra.entries) {
      const existing = byName.get(e.name);
      if (existing) Object.assign(existing, e);
      else target.entries.push(e);
    }
  }
  return [...curated, ...groups];
}

// --- Main ----------------------------------------------------------------------
const pkg = readJson(path.join(root, 'package.json'));
const npm = collectNpm();
const cargo = collectCargo();

let groups = [
  { id: 'javascript', title: 'JavaScript dependencies', entries: npm.entries },
  { id: 'rust', title: 'Rust crates', entries: cargo.entries },
];

let overlayWarnings = [];
if (fs.existsSync(overlayPath)) {
  groups = applyOverlay(groups, readJson(overlayPath));
} else {
  overlayWarnings.push('docs/legal/attribution.json missing — emitted manifest inventory only');
}

const document_ = {
  appVersion: pkg.version,
  generatedAt: new Date().toISOString(),
  groups,
};

// Skip rewriting when only the timestamp would change — keeps the checked-in
// snapshot stable across builds.
const contentOf = (doc) => JSON.stringify({ appVersion: doc.appVersion, groups: doc.groups });
let existing = null;
try {
  existing = readJson(outJson);
} catch { /* first run */ }

fs.mkdirSync(path.dirname(outJson), { recursive: true });
if (!existing || contentOf(existing) !== contentOf(document_)) {
  fs.writeFileSync(outJson, `${JSON.stringify(document_, null, 2)}\n`);
}

// Bundle the product license so it is reachable without network (AGPL §5/§13).
const licenseSrc = path.join(root, 'LICENSE');
const licenseDest = path.join(root, 'public/LICENSE.txt');
if (fs.existsSync(licenseSrc)) {
  fs.copyFileSync(licenseSrc, licenseDest);
}

const counts = Object.fromEntries(groups.map((g) => [g.id, g.entries.length]));
for (const w of [npm.warning, cargo.warning, ...overlayWarnings].filter(Boolean)) {
  console.warn(`licenses:collect warning: ${w}`);
}
console.log(`licenses:collect → ${path.relative(root, outJson)} ${JSON.stringify(counts)}`);
