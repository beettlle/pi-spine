# SP-778: Same-major dev dependency hygiene — Status

**Current Step:** Step 4 — Documentation & Delivery
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-27
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Record npm outdated
- [x] Confirm latest same-major versions
- [x] Dependencies satisfied

### Step 1: Bump dev dependencies
**Status:** ✅ Complete

- [x] Edit devDependencies
- [x] npm install (lockfile)
- [x] npm audit 0 high/critical
- [x] lint + typecheck clean

### Step 2: Update version-pin docs
**Status:** ✅ Complete

- [x] README / npm-publish / operator-runbook pin
- [x] No stale `^0.87.0`

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] lint + Contract testCommand (33/33 pass, exit 0)
- [x] Full suite (worker env unset): 2651/2651 pass, exit 0
- [x] Coverage gate ≥77%: 89.68% line (in-scope), exit 0
- [x] Fix failures (none needed)

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| Worktree had no `node_modules`; `npm outdated` returned empty (exit 0) against nothing installed | Ran registry `npm view` directly to confirm latest versions; first `npm install` in Step 1 populates `node_modules` |
| Registry latest: pi-coding-agent 0.87.1, eslint 10.11.0, typebox 1.3.34, @types/node@22 22.20.4 — all match Mission table exactly | Bumped to these versions; @types/node stays on major 22 as required |
| Lockfile diff scoped to the 4 targets only (+ pi-coding-agent internal `^0.87.1` sub-deps; one nested `@types/node@22.19.19` remains under `@google/genai`/`protobufjs` — transitive, untouched) | Accepted; top-level tree is on targets. `npm ls --depth=0` confirms 0.87.1 / 22.20.4 / 10.11.0 / 1.3.34 |
| No `CHANGELOG.md` exists in the repo ("Check If Affected" item) | Not affected; skipped per PROMPT condition |
| npm install warned about 3 uncovered install scripts (@google/genai preinstall no-op, esbuild, protobufjs) | Pre-existing allowScripts gate behavior; informational only, not a vulnerability (audit = 0) |

## Completion Criteria

- [x] Dev deps bumped; lockfile refreshed
- [x] Docs match pin
- [x] Four dev deps on latest same-major versions; lockfile refreshed (`npm audit`: 0 vulnerabilities; `npm outdated` clean post-bump)
- [x] `npm audit` 0 high/critical (0 total)
- [x] Docs match the new pi-coding-agent dev pin (`rg '\^0\.87\.0'` over README+docs: no matches)
- [x] Contract green (lint + typecheck + tests/extensions + ts-nocheck-guard, exit 0)

## Blockers

_None._
