# SP-676: Run-metrics usage fields — Status

**Current Step:** 3
**Status:** 🟡 In Progress
**Last Updated:** 2026-07-20
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Current metric shape mapped
- [x] Redaction risk confirmed: `REDACT_KEY_PATTERN = /key|token|secret|password|prompt/i` matches `tokensIn`/`tokensOut`

### Step 1: Schema + redaction
**Status:** ✅ Complete

- [x] Usage fields + redaction tests

### Step 2: Wire capture when available
**Status:** ✅ Complete

- [x] Capture wired: `buildTaskMetricRecord` carries usage fields when present on task; omitted when absent.

### Step 3: Testing & Verification
**Status:** 🟡 In Progress

- [ ] Scoped contract passing

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] `.DONE` created

## Notes

- `src/batch/metrics.mjs` redaction pattern kept broad, but `USAGE_KEYS` allow-list protects `tokensIn`, `tokensOut`, `estimatedUsd`.
- `buildTaskMetricRecord` adds `tokensIn`, `tokensOut`, `estimatedUsd`, `role` only when present on task.
- No existing source populates these fields yet, so records omit them when absent (no fake costs).
- No docs updates required (must-update: none).
(worker discoveries)
