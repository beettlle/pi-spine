# Task: TP-023 — Dashboard server + SSE snapshot API (Phase 5a)

**Created:** 2026-06-01
**Size:** L

## Review Level: 2 (Plan and Code)

**Assessment:** New localhost HTTP server and SSE transport; must reuse reconciliation (NFR-OBS-04) and bind loopback only (SEC-04).
**Score:** 5/8

## Mission

Implement the **backend** for PRD §16 dashboard v1 (panels ship in TP-025):

1. **`buildDashboardSnapshot(projectRoot)`** — single JSON snapshot from `reconcileBatch()` plus batch-state fields, lane rows (§16.2), active gate summary, last 20 journal events, wave progress from batch-state `wavePlan` / `currentWaveIndex`.
2. **HTTP server** — bind **`127.0.0.1` only**, default port **8109** (configurable via `spine-config.json` or `--port`).
3. **Routes:**
   - `GET /` — minimal placeholder HTML (“pi-spine dashboard”; TP-025 replaces UI)
   - `GET /api/snapshot` — JSON snapshot (same shape the UI will consume)
   - `GET /api/events` — **SSE** stream; push full snapshot on connect and on change (poll reconciliation every **2s** default, NFR-OBS-02 target <500ms handler time per tick)
4. **`spine dashboard`** CLI — start server, print URL, block until SIGINT; flags `--port`, `--json` (one-shot snapshot to stdout, no server).
5. **Tests** — snapshot includes `diagnosis` + `suggestedCommand` from reconciliation; server refuses `0.0.0.0` bind; SSE emits valid `data:` frames.

**Out of scope:** Rich HTML panels (TP-025); slash command (TP-026); executing dismiss/integrate from browser.

**Success:** `spine dashboard --json` matches `spine status --diagnose --json` diagnosis fields; `curl localhost:8109/api/snapshot` works; **140+** tests.

## Dependencies

- **TP-024** — pending scope on `main`

## Context to Read First

- `docs/PRD.md` — §16 Dashboard, NFR-OBS-02/04, SEC-04, `spine dashboard` in §15.2
- `src/batch/reconcile.mjs` — `reconcileBatch()`
- `bin/spine-status.mjs` — status JSON shape
- `src/batch/journal.mjs`, `src/batch/readers/spine-state.mjs`
- `src/batch/evidence.mjs` or gate reader if gate.json exists under `.spine/runtime/{batchId}/`

## File Scope

- `src/dashboard/snapshot.mjs` (new)
- `src/dashboard/server.mjs` (new)
- `src/dashboard/sse.mjs` (new) — optional helper for SSE framing
- `bin/spine-dashboard.mjs` (new)
- `bin/spine.mjs` — register `dashboard` subcommand
- `.spine/spine-config.json` example / schema comment for `dashboard.port`
- `tests/dashboard/snapshot.test.mjs` (new)
- `tests/dashboard/server.test.mjs` (new)

## Steps

### Step 0: Preflight
- [ ] Read §16.1–16.3; confirm `reconcileBatch` output fields for UI contract

### Step 1: Snapshot builder
> **Plan-review checkpoint** — JSON schema for `/api/snapshot`
- [ ] `buildDashboardSnapshot()` — diagnosis, headline, suggestedCommand, alternatives, batchId, phase, lanes[], gate, journalTail[], waves
- [ ] Unit tests vs fixture batch-state + reconcile mocks

### Step 2: Server + SSE + CLI
- [ ] Loopback-only HTTP server; `/api/snapshot`, `/api/events`
- [ ] `spine dashboard` / `spine dashboard --json`
- [ ] Integration test: spawn server, fetch snapshot, one SSE event

### Step 3: Docs stub
- [ ] README one-line under dashboard (full docs in TP-026); `npm test`

## Completion Criteria

- [ ] `spine dashboard --json` diagnosis matches CLI reconcile path
- [ ] Server binds 127.0.0.1:8109 only
- [ ] Tests pass (**140+**)

## Must Update

- `README.md` (minimal dashboard mention)

## Check If Affected

- `bin/spine-config.mjs`

## Git Commit Convention

- `feat(TP-023): complete Step N — description`

## Do NOT

- Full UI (TP-025); remote bind; execute lifecycle actions from HTTP

---

## Amendments (Added During Execution)
