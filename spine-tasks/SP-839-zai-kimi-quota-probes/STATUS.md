# SP-839: Z.ai and Kimi Coding quota probes parse real responses — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `runQuotaProbes`, `probeZai`, `probeKimi`, `extractNumber`, `extractLimit`
- [ ] Note SP-837 also edits `quota-snapshot.mjs` (different function); keep edits local to probe handling

### Step 1: Parsing
**Status:** ⬜ Not Started

- [ ] Numeric-string coercion
- [ ] Z.ai `data.limits[]` windows; Kimi `/coding/v1/usages` windows
- [ ] `unparsed` source

### Step 2: Rendering
**Status:** ⬜ Not Started

- [ ] Human and JSON output show windows; snapshot handles `unparsed`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Replace flat mocks with the real response bodies from #351
- [ ] HTTP 200 with unknown shape → `unparsed`
- [ ] Moonshot URL no longer called for `kimi-coding`

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-839-zai-kimi-quota-probes/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
