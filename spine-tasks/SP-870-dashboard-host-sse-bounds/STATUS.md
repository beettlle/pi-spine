# SP-870: Dashboard: Host allowlist, snapshot error handling, injected buildSnapshot, bound SSE — Status

**Current Step:** Complete
**Status:** ✅ Done
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
**Status:** ✅ Complete

- [x] Cover Host reject, injection, throw resilience, SSE cap

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`; engine runs stet `reviewCommand` (advisory)
- [x] Fix all failures

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `spine-tasks/SP-870-dashboard-host-sse-bounds/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand failed (exit 1): 1aa2818  src/dashboard/server.mjs:107  WARNING  The regex /^(.+):(\d+)$/ is greedy and will incorrectly parse IPv6 literal hostna | advisory — noted, not blocking | contract review step |
| reviewCommand failed (exit 2): Warning: proceeding with uncommitted changes; review scope may be unclear stet: rule budget of 1000 tokens dropped 207 rule secti | advisory — noted, not blocking | contract review step |
| Bind-host gap confirmed: `assertLoopbackHost` guards bind host only (`createDashboardServer` ~L213, `listenDashboardServer` ~L277); request handler never checks `req.headers.host` — DNS-rebinding Host reads snapshots. | Addressed in Step 1 | `src/dashboard/server.mjs` |
| `/api/snapshot` (L232) hard-codes `buildDashboardSnapshot(projectRoot)`, ignoring injected `buildSnapshot`; no try/catch — a throw inside the request listener is uncaught and kills the process. | Addressed in Step 1 | `src/dashboard/server.mjs` |
| SSE paths unprotected: `/api/events` (L239) builds snapshot after `writeSseHeaders`; poll-hub `tick` (L146) calls `refreshSharedSnapshot` inside `setInterval` — throw = uncaught crash. `sseClients` Set is unbounded. | Addressed in Step 1 | `src/dashboard/server.mjs` |
| GitNexus MCP `impact`/`context` on `createDashboardServer` returned UNKNOWN — index stale for this worktree (no `.gitnexus/run.cjs`; CLI fallback unavailable). Text-search blast radius: `bin/spine-dashboard.mjs:162` (prod caller), `tests/dashboard/{server,shared-snapshot,ui-contract}.test.mjs`. Risk LOW; UNKNOWN resolved per standing orders. | Acknowledged | STATUS Discoveries |
| Empirical (scratch node script): after `writeHead` (i.e. `writeSseHeaders`), `res.headersSent` is already true and a second `writeHead(500)` throws `ERR_HTTP_HEADERS_SENT` — SSE 500 requires building the initial snapshot BEFORE writing SSE headers. | Shapes Step 1 design | `src/dashboard/server.mjs` |
| SSE 503 overflow added (`MAX_DASHBOARD_SSE_CLIENTS = 32` exported; hub `hasSseCapacity()` + `attachSseClient` null-return; handler 503s before committing SSE headers). | Implemented | `src/dashboard/server.mjs` |
| `isAllowedRequestHost(hostHeader, listenPort)` uses `req.socket.localPort ?? port` so port-0 binds compare against the resolved listen port. | Implemented | `src/dashboard/server.mjs` |
| Runbook §7 got one sentence for operator-visible behavior (400 on non-loopback Host, 503 SSE overflow); everything else unchanged. | Done | `docs/adoption/operator-runbook.md` |
| Contract `testCommand` exit 0: `npm run lint` ✓, `npm run typecheck` ✓, `node --test` (server + phase23-exit-verify + ts-nocheck-guard) exit 0. | Verified | STATUS Execution Log |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-18 | Task staged | PROMPT.md and STATUS.md created |
| 2026-11-18 | Step 0 preflight | Gap confirmed; GitNexus UNKNOWN resolved via text search (blast radius: 1 prod caller + 3 test files) |
| 2026-11-18 | Step 1 implemented | Host allowlist, try/catch snapshot builds (snapshot/events/tick), injected `buildSnapshot`, SSE cap 32 + 503 |
| 2026-11-18 | Step 2 tests | 12 tests in `server.test.mjs` (8 new: unit allowlist ×2, HTTP host reject, injected builder, throw resilience ×2, hub cap, HTTP 503 cap) — all pass |
| 2026-11-18 | Step 3 contract | `npm run lint && npm run typecheck && node --test …` exit 0 |
| 2026-11-18 | Step 4 delivery | Runbook §7 sentence added; STATUS finalized; `.DONE` created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
