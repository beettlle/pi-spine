# SP-870: Dashboard: Host allowlist, snapshot error handling, injected buildSnapshot, bound SSE — Status

**Current Step:** Step 2: Tests
**Status:** 🟡 In Progress
**Last Updated:** 2026-11-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm bind-loopback vs request-Host gap; list current `/api/snapshot` and SSE attach paths
- [x] GitNexus impact on `createDashboardServer`; report in STATUS

---

### Step 1: Host + snapshot + SSE bounds
**Status:** ✅ Complete

- [x] Host header allowlist
- [x] try/catch snapshot builds
- [x] honor injected `buildSnapshot` on `/api/snapshot`
- [x] cap SSE clients

---

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Cover Host reject, injection, throw resilience, SSE cap

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [ ] Fix all failures

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-870-dashboard-host-sse-bounds/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Bind-host gap confirmed: `assertLoopbackHost` guards bind host only (`createDashboardServer` ~L213, `listenDashboardServer` ~L277); request handler never checks `req.headers.host` — DNS-rebinding Host reads snapshots. | Addressed in Step 1 | `src/dashboard/server.mjs` |
| `/api/snapshot` (L232) hard-codes `buildDashboardSnapshot(projectRoot)`, ignoring injected `buildSnapshot`; no try/catch — a throw inside the request listener is uncaught and kills the process. | Addressed in Step 1 | `src/dashboard/server.mjs` |
| SSE paths unprotected: `/api/events` (L239) builds snapshot after `writeSseHeaders`; poll-hub `tick` (L146) calls `refreshSharedSnapshot` inside `setInterval` — throw = uncaught crash. `sseClients` Set is unbounded. | Addressed in Step 1 | `src/dashboard/server.mjs` |
| GitNexus MCP `impact`/`context` on `createDashboardServer` returned UNKNOWN — index stale for this worktree (no `.gitnexus/run.cjs`; CLI fallback unavailable). Text-search blast radius: `bin/spine-dashboard.mjs:162` (prod caller), `tests/dashboard/{server,shared-snapshot,ui-contract}.test.mjs`. Risk LOW; UNKNOWN resolved per standing orders. | Acknowledged | STATUS Discoveries |
| Empirical (scratch node script): after `writeHead` (i.e. `writeSseHeaders`), `res.headersSent` is already true and a second `writeHead(500)` throws `ERR_HTTP_HEADERS_SENT` — SSE 500 requires building the initial snapshot BEFORE writing SSE headers. | Shapes Step 1 design | `src/dashboard/server.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
