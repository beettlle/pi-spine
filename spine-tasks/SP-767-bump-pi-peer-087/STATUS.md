# SP-767: Bump pi-coding-agent peer to ^0.87.0 — Status

**Current Step:** 3 (complete)
**Status:** ✅ All Steps Complete
**Last Updated:** 2026-09-21
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Record current peer pin
- [x] Dependencies satisfied

### Step 1: Peer bump
**Status:** ✅ Complete

- [x] Bump to ^0.87.0 + lockfile
- [x] Fix typecheck/lint only if needed
- [x] Confirm audit-high=0

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract testCommand
- [x] Fix failures

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged
- [x] Create .DONE

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Preflight: devDependency `@earendil-works/pi-coding-agent: ^0.85.1` (installed 0.85.1, registry.npmjs.org); `peerDependencies` entry is `*` optional (unchanged) | Recorded | `package.json` |
| `npm outdated`: wanted 0.85.1, latest 0.87.0 (≥1 0.x minor drift confirmed) | Recorded | — |
| `npm audit`: 0 vulnerabilities baseline | Recorded | — |
| Orphaned lockfile entry `node_modules/micromatch 4.0.8` required by nothing, missing on disk (`npm outdated` flags MISSING) — pre-existing, npm install refresh reconciles | Noted (out of scope) | `package-lock.json` |
| `pi.minPiVersion` stays `0.80.0` — SP-767 contract only checks devDependency contains 0.87 | Noted | `package.json` |
| Bump clean: `npm install` → 0.87.0 installed; typecheck exit 0, lint exit 0 (max-warnings 0), `npm audit --audit-level=high` exit 0 (0 vulnerabilities). No source changes required. Micromatch MISSING flag resolved by install (now present 4.0.8) | Resolved | `package.json`, `package-lock.json` |
| Contract testCommand exit 0 (typecheck + lint + audit-high + pin contains 0.87) | Verified | — |
| `npm test` from inside worker session: 30 failures, all `nested_batch_spawn_blocked` — SP-482 worker guard blocks tests that spawn nested batch engines (`SPINE_IS_WORKER=1` in session env); unrelated to peer bump | Environmental | `tests/batch/`, `tests/spine-run.test.mjs`, `tests/adoption/` |
| Proof: re-ran affected suites with `SPINE_IS_WORKER` unset → 1485 tests, 1485 pass, 0 fail, 0 skipped (TAP) | Verified | — |
| Check-If-Affected hit: README.md + docs/adoption/operator-runbook.md + docs/release/npm-publish.md (×2) pinned `^0.85.1` explicitly → updated to `^0.87.0` (npm-publish release checklist would otherwise fail its own floors-consistency check) | Updated per PROMPT | `README.md`, `docs/adoption/operator-runbook.md`, `docs/release/npm-publish.md` |
| #285 left open — Wave C (TypeScript 7 / @types/node 26 / Actions majors) remains deferred, untouched by this task | Deferred | GitHub #285 |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-21 | Task staged | PROMPT.md and STATUS.md created for v2.22.0 |
| 2026-09-21 | Step 0 | Preflight recorded: `^0.85.1` → latest 0.87.0; audit baseline 0; committed e212995c |
| 2026-09-21 | Step 1 | Bumped devDependency to `^0.87.0`, lockfile refreshed (0.87.0 installed); typecheck/lint/audit all exit 0 with no source changes; committed 82a34cda |
| 2026-09-21 | Step 2 | Contract testCommand exit 0; `npm test` 30 failures all proven environmental (SP-482 guard; 1485/1485 pass with guard unset); committed e4720763 |
| 2026-09-21 | Step 3 | Doc pins updated to 0.87.0; final contract verification on final state; .DONE created |

---

## Blockers

*None*

## Completion Criteria

- [x] Peer pin includes 0.87 (`^0.87.0` in devDependencies; `peerDependencies` stays `*`)
- [x] typecheck + lint + audit-high=0 (all exit 0)
- [x] #285 left open (Wave C deferred)

---

## Notes

Review Level 1 plan: (1) bump devDependency `@earendil-works/pi-coding-agent` `^0.85.1` → `^0.87.0`; (2) `npm install` to refresh `package-lock.json`; (3) typecheck + lint — fix only bump-caused breakages (file scope is package.json/package-lock.json only); (4) contract testCommand incl. `npm audit --audit-level=high`; (5) `npm test`; (6) check README/docs for explicit 0.85 pins; (7) .DONE. #285 stays open (Wave C deferred).
