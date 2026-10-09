# SP-817: Replace micromatch with picomatch — Status

**Current Step:** Step 1: Swap dependency + call sites
**Status:** 🟡 In Progress
**Last Updated:** 2026-10-09
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Audit baseline recorded
- [x] Call sites listed
- [x] Dependencies satisfied

### Step 1: Swap dependency + call sites
**Status:** ⬜ Not Started

- [ ] Dependency + lockfile
- [ ] Call sites; contract-exec.mjs at 500
- [ ] Types

### Step 2: Regression test
**Status:** ⬜ Not Started

- [ ] Matcher cases

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] Audit 0 high
- [ ] Full suite
- [ ] Coverage gate
- [ ] Fix all failures

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | Baseline `npm audit --omit=dev`: 2 high — `braces *` (stack-exhaustion DoS, GHSA-vfj7-8cjw-p6xm) via `micromatch >=0.2.0`. |
| 2 | 7 `micromatch.isMatch` call sites confirmed via rg (contract-exec, file-scope ×4, validate-contract ×2, contract-prelanded, discover, match-globs ×2, contract-parse). |
| 3 | Plan (Review Level 1): swap dep in package.json, npm install, rewrite each `micromatch.isMatch(s, p, opts)` as `picomatch(p, opts)(s)` keeping `{ dot: true }` explicit, new `types/picomatch.d.ts` ambient module declaration, delete `types/micromatch.d.ts`, update tsconfig.batch.json, add regression cases to file-scope-overlap test. contract-exec.mjs net line change 0. |

## Blockers

_None._
