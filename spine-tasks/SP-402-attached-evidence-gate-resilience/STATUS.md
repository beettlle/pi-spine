# SP-402: Attached evidence gate resilience — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-07-01
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Re-read issue #70 and partial evidence recovery path
- [ ] Trace gate open vs evidence collection order

---

### Step 1: Split evidence collection
**Status:** ⬜ Not Started

- [ ] `collectCoreEvidenceBundle` / `collectExtendedEvidenceBundle` / `finalizeEvidenceBundleComplete`

---

### Step 2: Gate opens before extended evidence
**Status:** ⬜ Not Started

- [ ] Persist gate after core evidence; extended collection non-blocking for gate open
- [ ] Evidence journal milestones on attached land loop

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] `evidence-gate-resilience.test.mjs`
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — ≥77% line coverage

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Close issue #70
- [ ] Create `.DONE`

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
| 2026-07-01 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
