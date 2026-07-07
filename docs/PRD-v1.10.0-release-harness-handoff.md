# pi-spine v1.10.0 — Release Harness Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 1.10.0 Release Harness  
**Last updated:** 2026-07-07  
**Status:** Ready for `create-spine-tasks` decomposition  

**Epic alias:** Phase 61 — SP-HARNESS (SP-530+)

**Prerequisite:** v1.8.1 **and** v1.9.0 exit criteria met.

**Release profile:** minor — 10–15 tasks; harness + lifecycle fixes.

---

## 1. Executive summary

pi-spine has sequence runner primitives (SP-387–392) and release operator skills, but releases still require heavy manual intervention:

- No enforced `npm run release:check` before version bump ([#175](https://github.com/beettlle/pi-spine/issues/175))
- Tags not gated on release-safe CI ([#156](https://github.com/beettlle/pi-spine/issues/156))
- `batch complete` archives state while next-wave engine runs ([#173](https://github.com/beettlle/pi-spine/issues/173))
- Concurrent `resume --force` engines not fail-fast ([#167](https://github.com/beettlle/pi-spine/issues/167))
- Lane worktrees not auto-cleaned on abort/dismiss ([#169](https://github.com/beettlle/pi-spine/issues/169))
- Operators use `--attached` from short-lived shells ([#185](https://github.com/beettlle/pi-spine/issues/185))

**v1.10.0** wires a **release harness** so `spine run sequence` can drive patch releases with human **gate approvals only**.

**Tagline:** *The release operator becomes a gate approver.*

---

## 2. Scope lock

### In scope (Phase 61 — SP-HARNESS)

| FR | Description |
|----|-------------|
| FR-STA-20 | Enforce `npm run release:check` in release-operator skill before `npm version` |
| FR-STA-21 | Tag creation gated on release-safe CI profile |
| FR-STA-22 | `batch complete` waits for engine terminal; no archive while engine running |
| FR-STA-23 | Concurrent `resume --force` fail-fast with clear diagnosis |
| FR-STA-24 | Auto worktree cleanup on abort/dismiss; doctor stale-worktrees ([#169](https://github.com/beettlle/pi-spine/issues/169), SP-350–351) |
| FR-STA-25 | Release sequence profile: manifest format + `spine run sequence --auto-approve-gate` |
| FR-STA-26 | Detached-first policy in autonomous-operator + release-operator skills ([#185](https://github.com/beettlle/pi-spine/issues/185)) |
| FR-STA-27 | Operator watch/wait CLI for unattended monitoring (SP-360, SP-362) |

### Deferred (v2.0.0)

- Full gates-only proof release — v2.0.0 handoff
- Gate maturity epics ([#120](https://github.com/beettlle/pi-spine/issues/120)–[#123](https://github.com/beettlle/pi-spine/issues/123))
- v2.3 module split ([#117](https://github.com/beettlle/pi-spine/issues/117))

### Non-goals

- npm publish automation without operator approval
- Supervisor autonomous agent ([#71](https://github.com/beettlle/pi-spine/issues/71) — partial SP-440 only)
- Cross-repo release orchestration

---

## 3. Baseline — already landed

| Work | Reference | Gap |
|------|-----------|-----|
| Sequence runner core | SP-387, SP-431 (#79), SP-437 (#82) | SP-388–392 staged; not release-wired |
| Worktree cleanup tasks | SP-350, SP-351 staged | Not landed |
| Watch/wait CLI | SP-360, SP-362 staged | Phase 46 |
| Attached engine lock | SP-434, #89 | Concurrent resume #167 |
| release:check script | `package.json` scripts | Not enforced in skill #175 |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| Sequence runner | `src/batch/sequence-runner.mjs`, `bin/spine-run.mjs` |
| Batch complete | `src/batch/batch-complete.mjs`, `src/batch/lifecycle.mjs` |
| Resume | `src/batch/resume-multi.mjs`, `src/batch/detached-start.mjs` |
| Worktree cleanup | `src/batch/worktree.mjs`, `src/doctor/worktree-health.mjs` |
| Release operator skill | `skills/spine-release-operator/SKILL.md` |
| Autonomous operator skill | `skills/spine-autonomous-operator/SKILL.md` |
| CI / release | `.github/workflows/release.yml`, `package.json` |
| Watch/wait | `src/cli/watch.mjs`, `src/cli/wait.mjs` (or planned paths) |

---

## 5. GitHub issue intake

| Issue | Closes / Partial | Assigned task |
|-------|------------------|---------------|
| [#175](https://github.com/beettlle/pi-spine/issues/175) | Closes | SP-530 (new) |
| [#156](https://github.com/beettlle/pi-spine/issues/156) | Closes | SP-531 (new) |
| [#173](https://github.com/beettlle/pi-spine/issues/173) | Closes | SP-532 (new) |
| [#167](https://github.com/beettlle/pi-spine/issues/167) | Closes | SP-533 (new) |
| [#169](https://github.com/beettlle/pi-spine/issues/169) | Closes | SP-350, SP-351 |
| [#185](https://github.com/beettlle/pi-spine/issues/185) | Closes | SP-534 (new) |
| [#54](https://github.com/beettlle/pi-spine/issues/54) | Partial | SP-388–392, SP-535 (new) |
| [#44](https://github.com/beettlle/pi-spine/issues/44), [#46](https://github.com/beettlle/pi-spine/issues/46) | Partial | SP-360, SP-362 |

---

## 6. Existing staged tasks

| SP-ID | Slug | Size | Status | Issue |
|-------|------|------|--------|-------|
| SP-350 | worktree-cleanup-complete-dismiss | S | Staged | #26/#169 |
| SP-351 | doctor-stale-worktrees | S | Staged | #26 |
| SP-360 | spine-watch | S | Staged | #44 |
| SP-362 | spine-wait | S | Staged | #46 |
| SP-388 | spine-run-sequence-cli | S | Staged | #54 |
| SP-389 | sequence-state-persistence | S | Staged | #54 |
| SP-390 | sequence-auto-approve-safety | S | Done | #79 |
| SP-391 | sequence-journal-events | S | Staged | #54 |
| SP-392 | sequence-diagnose-dashboard | S | Staged | #54 |

---

## 7. Task decomposition (SP-HARNESS ↔ SP-ID)

| SP-HARNESS | SP-ID | Slug | Mission | Size | Deps | Closes |
|------------|-------|------|---------|------|------|--------|
| 001 | SP-530 | harness-release-check-skill | Wire `npm run release:check` into release-operator Phase 5–6 | S | — | #175 |
| 002 | SP-531 | harness-tag-ci-gate | Release-safe CI profile before tag push | S | SP-530 | #156 |
| 003 | SP-532 | harness-complete-waits-engine | Fix #173: complete does not archive while engine running | S | — | #173 |
| 004 | SP-533 | harness-concurrent-resume-failfast | Fix #167: second resume --force fails fast | S | SP-434 | #167 |
| 005 | SP-534 | harness-detached-policy-docs | Update autonomous + release skills for detached default | S | — | #185 |
| 006 | SP-535 | harness-release-manifest-format | Document release sequence manifest + example in docs/release/ | S | — | #54 (Partial) |
| 007 | SP-350 | worktree-cleanup-complete-dismiss | Auto-clean worktrees on complete/dismiss | S | — | #169 (Partial) |
| 008 | SP-351 | doctor-stale-worktrees | Doctor detects stale lane worktrees | S | SP-350 | #169 |
| 009 | SP-388 | spine-run-sequence-cli | `spine run sequence` CLI | S | SP-387 | #54 |
| 010 | SP-389 | sequence-state-persistence | Sequence resume persistence | S | SP-388 | #54 |
| 011 | SP-391 | sequence-journal-events | Sequence journal events | S | SP-388 | #54 |
| 012 | SP-392 | sequence-diagnose-dashboard | Sequence diagnose + dashboard | S | SP-389 | #54 |
| 013 | SP-360 | spine-watch | `spine watch` operator CLI | S | — | #44 |
| 014 | SP-362 | spine-wait | `spine wait` block until condition | S | SP-360 | #46 |
| 015 | SP-536 | harness-sequence-release-profile | Release profile for sequence: wave caps, gate-only loop | S | SP-388, SP-535 | #54 (Partial) |
| 016 | SP-537 | harness-context-phase61 | CONTEXT Phase 61 + dependencies.json | S | leaves | — |

---

## 8. Gaps requiring new packets

| Gap | Proposed SP-ID |
|-----|----------------|
| release:check in skill | SP-530 |
| tag CI gate | SP-531 |
| complete waits engine | SP-532 |
| concurrent resume fail-fast | SP-533 |
| detached policy docs | SP-534 |
| release manifest format | SP-535 |
| sequence release profile | SP-536 |
| CONTEXT Phase 61 | SP-537 |

---

## 9. Wave run order

```text
SP-530 (release:check skill)
  └── SP-531 (tag CI gate)
SP-532, SP-533 (parallel — lifecycle)
SP-350 → SP-351 (worktree)
SP-388 → SP-389 → SP-391 → SP-392
SP-535 → SP-536 (release sequence profile)
SP-360 → SP-362 (watch/wait — parallel wave 0)
SP-534 (docs — anytime after SP-530)
leaves → SP-537
```

### Suggested batches

| Wave | Tasks |
|------|-------|
| H0 | SP-530, SP-532, SP-533 |
| H1 | SP-531, SP-350, SP-351 |
| H2 | SP-388, SP-389 |
| H3 | SP-391, SP-392, SP-535, SP-536 |
| H4 | SP-360, SP-362, SP-534 |
| H5 | SP-537 |

**Regression gate:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check`

**Proof gate:** 5-task patch release completes with operator touching only `spine gate approve` + publish approval (dry-run without npm publish).

---

## 10. Exit criteria

- [ ] `spine-release-operator` skill blocks `npm version` when `npm run release:check` fails
- [ ] Tag push requires release-safe CI profile green ([#156](https://github.com/beettlle/pi-spine/issues/156))
- [ ] `batch complete` does not archive active engine ([#173](https://github.com/beettlle/pi-spine/issues/173))
- [ ] Second concurrent `resume --force` fails with clear error ([#167](https://github.com/beettlle/pi-spine/issues/167))
- [ ] Worktree cleanup on dismiss/complete ([#169](https://github.com/beettlle/pi-spine/issues/169))
- [ ] `spine run sequence <manifest>` documented and tested for release scope
- [ ] Patch release (5 tasks) dry-run: gate approvals only
- [ ] Open GitHub issues ≤ ~15
- [ ] CONTEXT Phase 61 complete; Next Task ID → SP-538

---

## 11. Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-HARNESS-01 | release:check enforced | Skill audit + manual dry-run |
| M-HARNESS-02 | Complete/engine race | `tests/batch/batch-complete-engine.test.mjs` |
| M-HARNESS-03 | Concurrent resume blocked | `tests/batch/resume-concurrent.test.mjs` |
| M-HARNESS-04 | Sequence release dry-run | Operator sign-off checklist |

---

## 12. Workflow after this document

```text
Use create-spine-tasks to decompose docs/PRD-v1.10.0-release-harness-handoff.md
into SP-530+ packets. Update CONTEXT.md Phase 61.
```

Create example manifest: `docs/release/manifest-v1.10.0-example.md` (filled from release-manifest-template).

```bash
spine tasks validate SP-530 SP-531 SP-532 SP-533 SP-534 SP-535 SP-536
spine plan SP-530 SP-532 SP-533
```
