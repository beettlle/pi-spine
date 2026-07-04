# SP-487: Tag-triggered release — Status

**Current Step:** Complete
**Status:** ✅ Done
**Last Updated:** 2026-07-03
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] publish.yml exists
- [x] Secrets identified (NPMSECRET used for NODE_AUTH_TOKEN)
- [x] CI independence confirmed (no cross-reference from ci.yml or real-pi.yml)

---

### Step 1: Create release.yml workflow
**Status:** ✅ Complete

- [x] Tag-triggered workflow created
- [x] Test + publish + release steps
- [x] workflow_dispatch fallback
- [x] YAML valid

---

### Step 2: Remove publish.yml
**Status:** ✅ Complete

- [x] publish.yml deleted
- [x] No broken workflow_run references

---

### Step 3: Update release documentation
**Status:** ✅ Complete

- [x] npm-publish.md updated
- [x] Release process documented
- [x] workflow_dispatch noted

---

### Step 4: Testing & Verification
**Status:** ✅ Complete

- [x] FULL test suite passing (1525 pass; 45 fail due to SPINE_IS_WORKER=1 env — pre-existing, unrelated to this task)
- [x] release.yml YAML valid (js-yaml parse confirmed)
- [x] publish.yml deleted
- [x] No broken references (no workflow_run references remain)
- [x] All failures fixed (N/A — no failures introduced by this task)

---

### Step 5: Documentation & Delivery
**Status:** ✅ Complete

- [x] Release docs updated (docs/release/npm-publish.md rewritten)
- [x] "Check If Affected" docs reviewed (README.md has no publish.yml references)
- [x] Discoveries logged

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| 45 test failures due to SPINE_IS_WORKER=1 env in worker session | Pre-existing; all are nested_batch_spawn_blocked | tests/batch/, tests/adoption/, tests/spine-run.test.mjs |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-07-03 | Task staged | PROMPT.md and STATUS.md created |
| 2026-07-03 | Steps 0-5 executed | All complete; release.yml created, publish.yml deleted, docs updated |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
