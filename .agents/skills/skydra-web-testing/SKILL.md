---
name: skydra-web-testing
description: How to run and test the Skydra app in web mode — backend/frontend startup, demo-data seeding, opening Settings/overlays, exact-viewport mobile emulation, and focus-trap verification technique.
---

# Testing Skydra in web mode

## Run the app

- Terminal 1 (backend, Axum on :3001; first `cargo run` compiles a ~13G target dir — can take several minutes; a cached `target/debug/skydra` binary makes later runs fast):
  `cd ~/repos/Skydra/src-tauri && cargo run --no-default-features --features web`
- Terminal 2 (Vite on :1420):
  `cd ~/repos/Skydra && source ~/.nvm/nvm.sh && VITE_BACKEND=web npm run dev`
- Verify backend: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/flights` → `200` when up.
- Seed demo data (5 Johannesburg flights, Litchi-format CSVs): `python3 scripts/dev/seed_demo_data.py` (posts to `http://localhost:3001` by default; override via `SKYDRA_API`).

## Web-mode expectations

- Web mode intentionally hides Tauri-only settings (keep-uploaded-files, auto-logout "Lock on exit", log location). Their absence is correct, not a bug.
- Do NOT submit a profile password or DJI API key while testing — it persists against the seeded profile. Type into the inputs, then navigate away without submitting.

## Mobile-width testing

Chrome on this box clamps its minimum window width to ~532px (`wmctrl`/`xdotool windowsize` can't go below it). For an exact mobile viewport (e.g. 420px), use DevTools device toolbar instead: `F12` → `Ctrl+Shift+M` → set the width field in the toolbar (it may be hidden when the docked panel is narrow — widen the window first). Then `Ctrl+Shift+P` → "Capture screenshot" saves a clean PNG of just the emulated viewport (2x DPR) to `~/Downloads`.

## Proving focus traps / keyboard nav

Real `key Tab`/`shift+Tab` presses move focus; log every landing with a capture-phase `focusin` listener installed via browser console:

```js
window.__focusLog=[]; document.addEventListener('focusin', e=>{const el=e.target; window.__focusLog.push({tag:el.tagName,text:(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,45),inDlg:!!el.closest('[role=dialog]')})}, true);
```

Then dump `window.__focusLog` after N keypresses — entries with `inDlg:false` are escapes. To attribute unexpected focus moves to a caller, monkey-patch `HTMLElement.prototype.focus` to push `new Error().stack` — dev-mode Vite serves unminified sources so frames like `Modal.tsx:90` resolve to real files. Note `npm run dev` runs React 18 StrictMode: effects double-invoke on mount and some focus churn can be dev-amplified — verify conclusions against code deps, not just counts.

## Screenshots for PRs

`scrot -u <file.png>` captures the focused window (good for desktop-view shots); DevTools "Capture screenshot" is better for emulated mobile viewports. Window-frame chrome is included by `scrot -u`.
