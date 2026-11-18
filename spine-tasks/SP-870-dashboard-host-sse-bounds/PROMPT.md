# Task: SP-870 — Dashboard: Host allowlist, snapshot error handling, injected buildSnapshot, bound SSE

**Created:** 2026-11-18
**Size:** S
**Type:** llm

## Review Level: 1 (Plan Only)

**Risk:** DNS-rebinding Host headers can read batch snapshots; snapshot throws crash the server; unbounded SSE can exhaust FDs.
**Score:** 5/8 — Blast radius: 2, Pattern novelty: 1, Security: 2, Reversibility: 0
**Problem theory:** Bind host is already loopback-checked (`assertLoopbackHost`), but request `Host` is unchecked. `/api/snapshot` calls `buildDashboardSnapshot` instead of the injected `buildSnapshot`. Snapshot builds are not try/caught. SSE clients are unbounded.

## Mission

Closes #316 — Harden the loopback dashboard server:

1. **Host allowlist** — Reject requests whose `Host` is not `127.0.0.1`, `localhost`, or `localhost:<port` / `127.0.0.1:<port` matching the listen port (400 + plain body). Cover both `/api/snapshot` and `/api/events` (and static if served).
2. **Snapshot errors** — Wrap snapshot builds so a throw returns 500 JSON/text and keeps the server alive (SSE path included).
3. **Injected `buildSnapshot`** — `/api/snapshot` must use the same injected `buildSnapshot` as the SSE poll hub (not a hard-coded `buildDashboardSnapshot`).
4. **Bound SSE** — Cap concurrent SSE clients (constant, e.g. 32); refuse new clients with 503 when full; ensure close removes the client.
5. **Tests** — Host rejection, injected snapshot used, throwing snapshot does not kill server, SSE cap.

## Dependencies

- **None**

## Context to Read First

- GitHub #316
- `src/dashboard/server.mjs`, `src/dashboard/sse.mjs`
- `tests/dashboard/server.test.mjs`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None
- **Tests:** run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `src/dashboard/server.mjs`
- `src/dashboard/sse.mjs`
- `tests/dashboard/server.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/dashboard/server.test.mjs tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` |
| reviewCommand | `bash scripts/spine-stet-contract-run.sh default SP-870` |
| fileScopeMustChange | `src/dashboard/server.mjs`, `tests/dashboard/server.test.mjs` |
| fileScopeMustNotChange | `.review/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm bind-loopback vs request-Host gap; list current `/api/snapshot` and SSE attach paths
- [ ] GitNexus impact on `createDashboardServer`; report in STATUS

### Step 1: Host + snapshot + SSE bounds

- [ ] Host header allowlist
- [ ] try/catch snapshot builds
- [ ] honor injected `buildSnapshot` on `/api/snapshot`
- [ ] cap SSE clients

### Step 2: Tests

- [ ] Cover Host reject, injection, throw resilience, SSE cap

### Step 3: Testing & Verification

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-870-dashboard-host-sse-bounds/.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `docs/adoption/operator-runbook.md` — dashboard section only if Host/SSE behavior needs a sentence (prefer Discoveries)

## Completion Criteria

- [ ] Evil Host rejected
- [ ] `/api/snapshot` uses injected builder
- [ ] Throwing snapshot does not crash server
- [ ] SSE client cap enforced
- [ ] Contract `testCommand` exits 0

## Git Commit Convention

- `fix(SP-870): dashboard Host allowlist, snapshot errors, SSE cap (#316)`

## Do NOT

- Bind off-loopback
- Remove existing `assertLoopbackHost` bind checks
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
