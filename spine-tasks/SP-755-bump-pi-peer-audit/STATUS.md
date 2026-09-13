# SP-755: Wave A peer bump + audit clear — Status

**Current Step:** Complete
**Status:** ✅ All steps complete — ready for engine review
**Last Updated:** 2026-09-13
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Capture `npm audit` high/critical counts and `npm outdated` for pi-coding-agent
- [x] Record current pins in STATUS.md
- [x] Dependencies satisfied

---

### Step 1: Peer, engines, minPiVersion
**Status:** ✅ Complete

- [x] Bump `@earendil-works/pi-coding-agent` to `^0.85.1` and refresh lockfile
- [x] Align `typebox` to 1.3.x; fix extension schemas only if needed
- [x] Set `engines.node` to `>=22.19.0` and `pi.minPiVersion` to `0.80.0`
- [x] Update CI/release pi stubs below the new floor
- [x] Re-run `npm audit` — 0 high

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand` (`release:check`)
- [x] Fix all failures from the peer/typebox bump
- [x] Confirm `npm audit` high=0

---

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged (before/after audit counts)
- [x] Check If Affected: `docs/release/npm-publish.md` — no engines/node wording present, not affected
- [x] Check If Affected: extension registration tests — no typebox schema drift (typecheck + full suite green)
- [x] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Before: npm audit = 3 high (brace-expansion, js-yaml, undici), 2 moderate, 0 critical | Baseline recorded | npm audit --json |
| Registry: pi-coding-agent 0.85.1 exists; typebox latest = 1.3.30 | Confirms PROMPT targets | npm view |
| CI stubs mock pi --version as 0.78.0 (< new 0.80.0 floor) — must bump in ci.yml + release.yml | Planned in Step 1 | .github/workflows/ci.yml:72, release.yml:115 |
| real-pi.yml has no pi version stub (uses real runner pi, skips if absent) | No change needed | .github/workflows/real-pi.yml |
| Doctor minPiVersion check emits warning (ok:true) below floor, does not fail | Read-only confirm | src/doctor/run-doctor-checks.mjs:311-335 |
| typebox imported only via `Type` in extensions/spine/worker-tools.ts | Align dep version; schemas only if typecheck fails | extensions/spine/worker-tools.ts |
| `0.60.0` also in docs/release/v1.0-checklist.md (historical doc; SP-757 owns docs) | Out of File Scope — left as-is | docs/release/v1.0-checklist.md:123 |
| node_modules not installed in fresh worktree (micromatch MISSING) | npm install as part of lockfile refresh | repo root |
| `npm audit fix` (non-force) cleared remaining brace-expansion + js-yaml highs; final audit = 0 vulnerabilities (no --force needed) | Resolved | npm audit |
| typebox schemas needed no fixes after 1.1→1.3 bump (typecheck pending Step 2) | Verified in Step 2 | extensions/spine/worker-tools.ts |
| `tests/spine-run.test.mjs` + startBatch spawn tests fail inside worker session: children inherit SPINE_IS_WORKER=1 → nested_batch_spawn_blocked (SP-482 guard). Reproduced identically at base commit bdf00479 (2/2 fail) — pre-existing env artifact, NOT a bump regression. Engine's own `buildContractTestEnv` strips SPINE_IS_WORKER before contract runs; ran contract with `env -u SPINE_IS_WORKER` to reproduce CI conditions | Documented; contract run uses engine-sanctioned env | tests/spine-run.test.mjs, src/batch/contract-verify.mjs, tests/batch/contract-verify-nested-spawn.test.mjs |
| Full contract with engine-sanctioned env: 2612/2612 tests pass, 0 fail; line coverage 89.50% (threshold 77%); release:check exit=0 | Verification evidence | /tmp/sp755-contract.log |
| docs/release/npm-publish.md contains no engines/node version wording — SP-757 unaffected by engines change there | Not affected | docs/release/npm-publish.md |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |
| 2026-09-13 | Step 0 preflight | audit=3H/2M/0C baseline; pins recorded; stub locations found |
| 2026-09-13 | Step 1 peer bump | pi ^0.85.1, typebox 1.3.30, engines >=22.19.0, minPi 0.80.0, stubs 0.78.0→0.85.1; audit 0 vulns |
| 2026-09-13 | Step 2 verification | lint clean; release:check exit=0 (env -u SPINE_IS_WORKER, engine-sanctioned); 2612/2612 pass; coverage 89.50%; audit 0 vulns |
| 2026-09-13 | Step 3 delivery | Affected-docs checked (none affected); .DONE created |

---

## Blockers

*None*

---

## Completion Criteria

- [x] Peer at ^0.85.1; minPiVersion 0.80.0; engines.node ≥22.19.0
- [x] `npm audit` high=0 (0 vulnerabilities total)
- [x] `npm run release:check` green (exit 0; 2612/2612 tests; coverage 89.50% ≥ 77)
- [x] Partial #285 Wave A

## Notes

*Reserved for execution notes*
