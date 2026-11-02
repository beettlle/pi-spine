# SP-853: `worker.rules_selected` reports what actually loaded — Status

**Current Step:** Step 0
**Status:** 🔵 Not Started
**Last Updated:** 2026-11-01
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `buildWorkerContextAsync`; report the blast radius in STATUS
- [ ] `rg -n "worker.rules_selected" src tests` — list consumers; confirm the change is additive for each

### Step 1: Post-load journal
**Status:** ⬜ Not Started

- [ ] Event emitted after loading with `bytesUsed`, `byteCap`, `truncated`, `skipped`

### Step 2: Tests
**Status:** ⬜ Not Started

- [ ] Over-cap selection journals truncation and the skipped path

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run Contract `testCommand`; the engine then runs the stet `reviewCommand`
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-853-worker-rules-journal-post-load/.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |

## Blockers

*None*
