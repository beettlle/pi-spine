# SP-341: Worker timeout heartbeat slide — Status

**Current Step:** Step 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-30
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Issue #32 reviewed
- [x] File scope modules read

**Notes:** Stall deadline used fixed `startedAt + stallTimeoutMs`; `worker_alive` in `pi` phase did not slide anchor. Fix: `lastAliveAt` / `stallAnchorAt` in `computeStallDeadline` + slide on `worker_alive`.

---

### Step 1: Slide timeout on worker_alive
**Status:** 🟡 In Progress

- [x] `computeStallDeadline` accepts `lastAliveAt` for silent-stall anchor
- [x] `engine-lanes/watch.mjs` slide helpers
- [x] `worker-host.mjs` updates `stallAnchorAt` on pi `worker_alive`

---

### Step 2: Tests + delivery
**Status:** ⬜ Not Started

- [ ] Regression test file created

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract test passes
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Close issue #32 (`gh issue close 32`)
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| `engine-lanes/watch.mjs` did not exist | Created with stall-anchor slide helpers | `src/batch/engine-lanes/watch.mjs` |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-28 | Task staged | PROMPT.md and STATUS.md created for GitHub #32 |
| 2026-06-30 | Step 0 preflight | Traced stall vs heartbeat; identified fixed `startedAt` anchor |
| 2026-06-30 | Step 1 implementation | Slide on pi `worker_alive`; `computeStallDeadline` uses `lastAliveAt` |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
