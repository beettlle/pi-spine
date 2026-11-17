# SP-864: deps pi-coding-agent 1.5.2 — Status

**Current Step:** Complete — all steps done
**Status:** ✅ Complete — awaiting engine reviews
**Last Updated:** 2026-11-16
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Record `npm audit` summary and `npm outdated` before changes in STATUS Discoveries
- [x] `npm view @earendil-works/pi-coding-agent@1.5.2 version`

### Step 1: Bump
**Status:** ✅ Complete

- [x] Install pi-coding-agent ^1.5.2 (+ optional eslint 10.15)
- [x] Confirm lockfile 1.5.2; audit high exits 0

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Contract `testCommand` passing
- [x] All failures fixed

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Preflight `npm audit`: 0 high/critical, 4 moderate — all via minimatch GHSA-g3hv-75wg-m249 in pi-coding-agent ≤1.4.0, eslint 10.0–10.14, @eslint/config-array 0.23.0–0.23.5 | Info — both bump targets are in the vulnerable ranges; audit exit 0 at --audit-level=high | STATUS Discoveries |
| Preflight `npm outdated`: picomatch MISSING (node_modules absent in fresh worktree); registry confirms pi-coding-agent@1.5.2 exists (`npm view` → 1.5.2) | Info — npm install will populate node_modules for contract testCommand | STATUS Discoveries |
| Before/after: pi-coding-agent devDep ^1.4.0→^1.5.2 (lock 1.4.0→1.5.2); eslint ^10.14.0→^10.15.0 (lock 10.14.0→10.15.0, optional bump taken — latest stable, clears moderate range) | Done | package.json, package-lock.json |
| Remaining moderates: none — post-bump `npm audit` reports 0 vulnerabilities (minimatch GHSA-g3hv-75wg-m249 fully resolved) | Info | STATUS Discoveries |
| README.md:52 still says peer "developed and tested against `^1.0.1`" — now stale (devDep is ^1.5.2). Per PROMPT: recorded only, no edit; peer note owned by SP-858 | Deferred — do not edit | README.md:52 (untouched) |
| TypeScript 7 / @types/node 26 / typebox 1.4 remain deferred per PROMPT (untouched: typescript 6.0.3, @types/node 22.20.4, typebox 1.3.34) | Out of scope | STATUS Discoveries |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |
| 2026-11-16 | Step 0 preflight | audit 4 moderate/0 high; registry 1.5.2 confirmed; node_modules absent |
| 2026-11-16 | Step 1 bump | pi-coding-agent 1.4.0→1.5.2, eslint 10.14.0→10.15.0; npm audit now 0 vulnerabilities; lockfile diff only pkg+lock |
| 2026-11-16 | Step 2 verify | Contract testCommand exit 0 (lint+typecheck+audit+25 dots); no src/ changes needed under 1.5.2 |
| 2026-11-16 | Step 3 delivery | README:52 peer note stale (recorded, untouched); .DONE created |

## Blockers

*None*
