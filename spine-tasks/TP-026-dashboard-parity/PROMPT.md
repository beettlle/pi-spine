# Task: TP-026 — Dashboard parity + slash + GAP-UX-03 (Phase 5c)

**Created:** 2026-06-01
**Size:** M

## Review Level: 2 (Plan and Code)

**Assessment:** Closes observability gap; regression test that dashboard and CLI share one reconcile path (NFR-OBS-04).
**Score:** 4/8

## Mission

Finish dashboard operator UX and **close GAP-UX-03**:

1. **Parity test** — `buildDashboardSnapshot()` and `reconcileBatch()` return same `diagnosis`, `headline`, `suggestedCommand` for shared fixtures (active, failed, needs_integrate, idle, limbo).
2. **Diagnosis action chips** — banner shows primary + `alternatives[]` as copyable CLI commands (Dismiss, Complete, Integrate, Retry, Resume per §16.1 labels); **do not** execute HTTP mutations (operator runs CLI).
3. **`/spine-dashboard`** slash command — starts or documents `spine dashboard` (spawn detached or print URL + instructions).
4. **`spine init` / config** — document `dashboard.port` default 8109 in README and example config.
5. **Gap list + CONTEXT** — GAP-UX-03 → **Closed**; Phase 5 dashboard row Done; note NFR-OBS-02 satisfied by server poll interval + benchmark note in test or README.

**Out of scope:** Supervisor mail; remote dashboard; MCP status adapter (future).

**Success:** GAP-UX-03 closed; **150+** tests; wave 18.

## Dependencies

- **TP-025** — UI panels on `main`

## Context to Read First

- `docs/compatibility/taskplane-gap-list.md` — GAP-UX-03
- `docs/PRD.md` — NFR-OBS-04, AC-7.3, §15.1 slash table
- `extensions/spine/slash-commands.ts`

## File Scope

- `tests/dashboard/parity.test.mjs` (new)
- `src/dashboard/public/dashboard.js` — action chips
- `extensions/spine/slash-commands.ts`
- `docs/compatibility/taskplane-gap-list.md`
- `taskplane-tasks/CONTEXT.md`
- `README.md`

## Steps

### Step 0: Preflight
- [ ] GAP-UX-03 acceptance criteria; TP-025 merged

### Step 1: Parity regression tests
- [ ] Fixture matrix: idle, running, needs_integrate, needs_retry, failed, completed
- [ ] Assert CLI JSON === dashboard snapshot diagnosis fields

### Step 2: Slash + action chips + docs
- [ ] `/spine-dashboard`; README dashboard section; gap list; CONTEXT Phase 5 complete

### Step 3: Verification
- [ ] Full `npm test`; manual smoke checklist in STATUS

## Completion Criteria

- [ ] GAP-UX-03 closed in gap list
- [ ] Parity tests green; tests **150+**

## Must Update

- `docs/compatibility/taskplane-gap-list.md`
- `taskplane-tasks/CONTEXT.md`
- `README.md`

## Git Commit Convention

- `feat(TP-026): complete Step N — description`

## Do NOT

- HTTP POST for dismiss/integrate; Taskplane dashboard parity

---

## Amendments (Added During Execution)
