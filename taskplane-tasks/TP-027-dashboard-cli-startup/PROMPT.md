# Task: TP-027 — Dashboard CLI startup operator messaging

**Created:** 2026-06-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Small CLI UX fix in one module plus tests; no auth or data model risk. Primary risk is regressing server listen/shutdown behavior.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Canonical Task Folder

```
taskplane-tasks/TP-027-dashboard-cli-startup/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Operators running `spine dashboard` today get **no useful guidance at startup**: the formatted banner is only returned **after** the server shuts down (Ctrl+C), because `runSpineDashboard()` builds `lines` then awaits SIGINT before `spine.mjs` writes `result.output`. Taskplane prints the **URL, port, and what to do** as soon as the dashboard is listening.

Make pi-spine match that expectation: print a clear, Taskplane-style startup block **immediately** when the server is ready, so users know exactly where to point the browser and how to use the dashboard alongside batch commands.

## Dependencies

- **None** (dashboard stack is on `main` from TP-023–TP-026)

## Context to Read First

**Tier 2:**
- `taskplane-tasks/CONTEXT.md` — Phase 5 dashboard complete

**Tier 3:**
- `bin/spine-dashboard.mjs` — current listen/shutdown flow (bug: output after await)
- `bin/spine.mjs` — `cmdDashboard` writes `result.output` once at return
- `bin/spine-status.mjs` — human output pattern (`→` suggested command, alternatives)
- `extensions/spine/slash-commands.ts` — `/spine-dashboard` notify text (keep consistent)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (loopback HTTP only in tests)

## File Scope

- `bin/spine-dashboard.mjs`
- `tests/dashboard/cli-startup.test.mjs` (new)
- `README.md` (dashboard section — one short note on startup banner)
- `extensions/spine/slash-commands.ts` (only if reusing shared formatter for notify URL block)

## Steps

### Step 0: Preflight

- [ ] Reproduce: `node bin/spine.mjs dashboard` shows no URL until Ctrl+C
- [ ] Confirm `listenDashboardServer` returns `url` before blocking

### Step 1: Startup banner + immediate stdout

- [ ] Add exported `formatDashboardStartupMessage({ url, host, port, projectRoot })` in `bin/spine-dashboard.mjs` (testable, no side effects)
- [ ] Message MUST include at minimum:
  - **Open in browser:** full `url` (e.g. `http://127.0.0.1:8109/`)
  - **Listen:** `host` and `port` (and note if port came from `--port` vs `dashboard.port` in config when detectable)
  - **While running:** keep this terminal open; dashboard updates via SSE (~2s)
  - **In another terminal:** `spine status` / `spine batch start …` to drive batch work
  - **API:** `{url}/api/snapshot`, `{url}/api/events`
  - **Stop:** Ctrl+C
- [ ] After `listenDashboardServer`, **write startup message to stdout immediately** (`process.stdout.write`); do not defer to post-shutdown `return.output`
- [ ] On shutdown, optional one-line `Dashboard stopped.` (no duplicate full banner)
- [ ] Align tone/layout with `spine status` (blank line, title, indented fields, `→` for primary action)

**Artifacts:**
- `bin/spine-dashboard.mjs` (modified)

### Step 2: Tests + slash notify alignment

- [ ] `tests/dashboard/cli-startup.test.mjs`: unit tests for `formatDashboardStartupMessage` (URL, port, browser hint, `spine status` mention)
- [ ] Regression: mock or short-lived listen test proving startup text is emitted **before** server close (not only in final return payload)
- [ ] `/spine-dashboard` notification uses the same URL/port resolution; if helpful, import/reuse formatter for the “open this URL” line (no behavior change to detached spawn)

**Artifacts:**
- `tests/dashboard/cli-startup.test.mjs` (new)
- `extensions/spine/slash-commands.ts` (optional touch)

### Step 3: Testing & verification

- [ ] Run targeted: `node --test tests/dashboard/cli-startup.test.mjs`
- [ ] Run FULL suite: `npm test`
- [ ] Run: `npm run typecheck`
- [ ] Manual: start dashboard, confirm URL visible without pressing Ctrl+C

### Step 4: Documentation & delivery

- [ ] README dashboard subsection: startup prints URL and operator hints
- [ ] CONTEXT.md: TP-027 row + test count if changed
- [ ] STATUS.md discoveries if any

## Documentation Requirements

**Must Update:**
- `README.md` — dashboard CLI startup behavior
- `taskplane-tasks/CONTEXT.md` — TP-027 status

**Check If Affected:**
- `bin/spine.mjs` — help text for `dashboard` subcommand (only if examples need updating)

## Completion Criteria

- [ ] `spine dashboard` prints actionable URL/port/guidance **before** blocking
- [ ] New tests green; full `npm test` green
- [ ] `/spine-dashboard` notify URL still matches resolved port

## Git Commit Convention

- `feat(TP-027): complete Step N — description`

## Do NOT

- Change dashboard HTTP API, SSE interval, or snapshot schema
- Add remote bind / non-loopback hosts
- Duplicate Taskplane port 8099 — keep default 8109

---

## Amendments (Added During Execution)
