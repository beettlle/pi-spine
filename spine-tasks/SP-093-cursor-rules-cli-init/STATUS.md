# SP-093: Cursor rules CLI — Status

**Current Step:** 1
**Status:** 🟡 In Progress
**Last Updated:** 2026-06-04
**Review Level:** 1
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-091 complete (`selectRulesForWorker` + glob match landed)

### Step 1: spine rules commands
**Status:** ✅ Complete

- [x] `discover [--json]`, `select --task`, `sync`
- [x] `spine_review_step` after step

### Step 2: Init + doctor
**Status:** ⬜ Pending

- [ ] init copies profile; discover; `standards: []` default
- [ ] doctor RULES_MANIFEST_MISSING / STALE
- [ ] manifest not gitignored

### Step 3: Testing & Verification
**Status:** ⬜ Pending

- [ ] CLI tests + coverage ≥77%

### Step 4: Documentation & Delivery
**Status:** ⬜ Pending

- [ ] `spine rules --help`
- [ ] Discoveries logged in STATUS.md
