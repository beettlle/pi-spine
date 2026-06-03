# Task: TP-025 — Dashboard UI panels (Phase 5b)

**Created:** 2026-06-01
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** Operator-facing UI; must render **diagnosis** not raw `phase` for banner color and primary action (PRD §16.1, AC-7.3).
**Score:** 5/8

## Mission

Build the **browser UI** for pi-spine dashboard v1, consuming TP-023 SSE/API:

1. **Static client** under `src/dashboard/public/` — served by TP-023 server at `GET /`.
2. **Panels (§16.1):**
   - Batch summary (batchId, phase, started/ended, task counts)
   - **Diagnosis banner** — headline, `suggestedCommand`, badge color from **`diagnosis`** (not `phase`)
   - Wave progress — `currentWaveIndex` / `totalWaves` + wave plan task IDs
   - Lane table (§16.2): laneId, status, tasks, heartbeat age, truncated worktree path
   - Active integrate gate — status from snapshot `gate` block
   - Journal tail — last 20 events (type, time, summary)
3. **Live updates** — subscribe to `/api/events` SSE; re-render on each snapshot (no separate polling in browser).
4. **Idle state** — when no active batch, show reconcile idle headline (“ready to plan or start”) matching CLI.
5. **Accessibility** — readable in terminal-adjacent environments; no external CDN deps (bundle minimal vanilla JS or small inline).

**Out of scope:** Server-side action POSTs; Taskplane parity; remote access; historical analytics (§16.3).

**Success:** Manual smoke: run batch + `spine dashboard`, panels update within 2s; banner shows `needs_integrate` not green “running” when phase is `completed`.

## Dependencies

- **TP-023** — dashboard server + `/api/snapshot` + SSE on `main`

## Context to Read First

- `docs/PRD.md` — §16.1–16.3, AC-7.3
- `src/dashboard/snapshot.mjs` — snapshot JSON contract from TP-023
- `src/batch/diagnosis.mjs` — diagnosis taxonomy colors/labels if useful

## File Scope

- `src/dashboard/public/index.html` (new)
- `src/dashboard/public/dashboard.css` (new)
- `src/dashboard/public/dashboard.js` (new)
- `src/dashboard/server.mjs` — serve static assets from `public/`
- `tests/dashboard/ui-contract.test.mjs` (new) — parse snapshot fixtures into DOM expectations (jsdom or structural JSON asserts)

## Steps

### Step 0: Preflight
- [ ] Confirm TP-023 snapshot schema stable; sample `spine dashboard --json` output

### Step 1: Layout + diagnosis banner
> **Plan-review checkpoint** — panel wireframe vs §16.1
- [ ] HTML/CSS shell; diagnosis-driven banner styling
- [ ] Idle vs active batch layouts

### Step 2: Lane table + waves + gate + journal
- [ ] Render all §16.1 panels from snapshot
- [ ] SSE client reconnect on error

### Step 3: Smoke + tests
- [ ] UI contract tests; README cross-link; `npm test`

## Completion Criteria

- [ ] All §16.1 panels render from live SSE snapshots
- [ ] Banner uses `diagnosis` for color/label, not `phase` alone
- [ ] Tests pass (**145+**)

## Must Update

- `README.md` — dashboard screenshot or ASCII wireframe optional

## Git Commit Convention

- `feat(TP-025): complete Step N — description`

## Do NOT

- Change reconcile logic; add npm frontend framework; bind non-loopback

---

## Amendments (Added During Execution)
