# Task: SP-201 — Integrate auto-resolves rules-manifest on main

**Created:** 2026-06-11
**Size:** S

## Review Level: 2 (Plan and Code)

**Assessment:** Land-loop friction — `spine integrate` failed when `.spine/rules-manifest.json` had a dirty `generatedAt` on `main`; operator had to stash/merge manually.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Extend **rules-manifest merge conflict auto-resolution** (already used for lane→orch merges in `src/batch/engine-lanes.mjs`) to **`spine integrate` orch→main**, and prevent evidence collection from leaving a dirty manifest that blocks integrate.

**Incident:** Batch `20260611T225006` land loop — `spine integrate` aborted:
```
Your local changes to the following files would be overwritten by merge:
  .spine/rules-manifest.json
```
Only `generatedAt` differed (evidence collection refreshed manifest on `main` while orch carried batch commit version). Operator stashed, integrated, then manually merged timestamps (`36c58fa`).

**Existing helpers:**
- `resolveRulesManifestGeneratedAtMerge()` — `src/config/cursor-rules/discover.mjs`
- `tryAutoResolveRulesManifestMergeConflict()` — `src/batch/engine-lanes.mjs` (git merge stages :2/:3)

**Required behavior:**
1. Before `git merge` orch→main in integrate, if working tree has **only** `generatedAt` drift on `.spine/rules-manifest.json`, auto-resolve (newest timestamp or orch/main merge policy — document choice).
2. If integrate merge hits rules-manifest conflict, reuse stage-2/3 auto-resolve (same as lane merge).
3. Optionally: evidence bundle collection should not dirty the manifest on `main` without committing (configurable or write to evidence dir only).
4. Regression test: simulate orch/main manifest timestamp skew; integrate succeeds without manual stash.

## Dependencies

- **Task:** SP-193

## Context to Read First

**Tier 3:**
- `src/config/cursor-rules/discover.mjs` — `resolveRulesManifestGeneratedAtMerge`
- `src/batch/engine-lanes.mjs` — `tryAutoResolveRulesManifestMergeConflict`
- `bin/spine-integrate.mjs` / integrate module (orch→main merge path)
- `src/batch/evidence.mjs` — rules sync side effects during gate evidence
- Commit `36c58fa` (manual merge workaround)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/engine-lanes.mjs` (extract shared manifest merge helper if needed)
- `src/batch/integrate.mjs` or `bin/spine-integrate.mjs`
- `src/config/cursor-rules/discover.mjs`
- `tests/batch/integrate-rules-manifest.test.mjs` (new)
- `docs/adoption/operator-runbook.md` (integrate troubleshooting — optional)

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/engine-lanes.mjs`, `src/batch/integrate.mjs`, `tests/batch/integrate-rules-manifest.test.mjs` |
| fileScopeMustNotChange | |
| minLineCoverage | 77 |
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Trace integrate merge path and reproduce timestamp-only dirty manifest failure
- [ ] Read `tryAutoResolveRulesManifestMergeConflict` lane merge flow

### Step 1: Integrate pre-merge + conflict auto-resolve

> **Plan-review checkpoint**

- [ ] Apply generatedAt merge before/at orch→main integrate
- [ ] Extract shared helper if duplicate logic would otherwise land

### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Git fixture test: integrate with skewed rules-manifest timestamps
- [ ] Run: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run: `npm run coverage:check` — ≥77%

### Step 3: Documentation & Delivery

- [ ] Note in `findings.md`; update runbook if operator workaround no longer needed
- [ ] Create `.DONE` when complete

## Testing

- `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- `npm run coverage:check` — ≥77%

## Completion Criteria

- [ ] `spine integrate` succeeds when only rules-manifest `generatedAt` differs
- [ ] Lane and integrate paths share one manifest merge policy
- [ ] Tests green

## Git Commit Convention

- `feat(SP-201): complete Step N — description`

## Do NOT

- Auto-resolve when rules[] content actually differs
- Force-commit operator dirty files unrelated to rules-manifest
