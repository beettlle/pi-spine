# Task: SP-227 — Preflight git-clean rules-manifest drift

**Created:** 2026-06-12
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Operator wedge — `spine preflight` fails `git-clean` when only `.spine/rules-manifest.json` `generatedAt` drifted; integrate path already auto-resolves (SP-201).
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Close the **preflight gap** left by SP-201: when the working tree is dirty **only** because `.spine/rules-manifest.json` differs by `generatedAt` (rules[] fingerprint identical), `spine preflight` must not fail `git-clean` and block the next wave.

**Incidents (SP-205–225 stress test):**
- After Wave 0 land loop, Wave 1 `batch start` failed `preflight_failed` with `git-clean: working tree has 1 uncommitted change(s)` — sole diff was `generatedAt` on `.spine/rules-manifest.json`.
- Operator workaround: `git checkout -- .spine/rules-manifest.json` before each wave.

**Required behavior:**
1. Reuse existing manifest fingerprint helpers (`fingerprintRulesManifest`, `resolveRulesManifestIntegrateDrift` or equivalent) in the preflight `git-clean` check.
2. Treat generatedAt-only drift as **clean for preflight** (pass `git-clean`), optionally with a **warning** check or headline hint naming the file.
3. Fail `git-clean` when rules[] content differs or any other path is dirty.
4. Do **not** silently discard operator edits to non-manifest files.

## Dependencies

- **Task:** SP-201
- **Task:** SP-090

## Context to Read First

**Tier 3:**
- `bin/spine-preflight.mjs` — `git-clean` check (~lines 125–157)
- `src/config/cursor-rules/discover.mjs` — `fingerprintRulesManifest`, `resolveRulesManifestIntegrateDrift`
- `src/batch/integrate.mjs` — integrate drift policy (mirror, do not diverge)
- `tests/spine-preflight.test.mjs`
- `tests/batch/integrate-rules-manifest.test.mjs` — existing drift fixtures

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `bin/spine-preflight.mjs`
- `src/config/cursor-rules/discover.mjs` (extract shared helper only if needed)
- `tests/spine-preflight.test.mjs`
- `docs/adoption/operator-runbook.md` (preflight troubleshooting — optional)
- `spine-tasks/_explore/reliability-epic/findings.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `bin/spine-preflight.mjs`, `tests/spine-preflight.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Reproduce: dirty only `.spine/rules-manifest.json` `generatedAt`; confirm preflight fails today
- [ ] Document chosen policy (pass with warning vs silent pass) — align with SP-201 integrate policy

### Step 1: git-clean manifest exemption

> **Plan-review checkpoint**

- [ ] Implement generatedAt-only exemption in preflight `git-clean`
- [ ] Shared helper with integrate drift logic (no duplicate fingerprint rules)

### Step 2: Testing & Verification

- [ ] Unit test: generatedAt-only → preflight passes `git-clean`
- [ ] Unit test: rules[] diff or other dirty path → preflight still fails
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

### Step 3: Documentation & Delivery

- [ ] Runbook note under preflight / git-clean (remove `checkout --` workaround if obsolete)
- [ ] Append resolved entry to `findings.md`
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Back-to-back waves no longer blocked by manifest timestamp refresh alone
- [ ] Preflight and integrate share one manifest drift policy
- [ ] Tests green

## Git Commit Convention

- `feat(SP-227): complete Step N — description`

## Do NOT

- Auto-resolve when rules[] content differs
- Ignore dirty files outside `.spine/rules-manifest.json`
- Commit operator-unrelated working tree changes

---

## Amendments (Added During Execution)
