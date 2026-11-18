# SP-870: Dashboard: Host allowlist, snapshot error handling, injected buildSnapshot, bound SSE — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-11-18
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm bind-loopback vs request-Host gap; list current `/api/snapshot` and SSE attach paths
- [ ] GitNexus impact on `createDashboardServer`; report in STATUS

---

### Step 1: Host + snapshot + SSE bounds
**Status:** ⬜ Not Started

- [ ] Host header allowlist
- [ ] try/catch snapshot builds
- [ ] honor injected `buildSnapshot` on `/api/snapshot`
- [ ] cap SSE clients

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
