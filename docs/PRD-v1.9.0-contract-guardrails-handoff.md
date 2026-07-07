# pi-spine v1.9.0 — Contract Guardrails Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 1.9.0 Contract Guardrails  
**Last updated:** 2026-07-07  
**Status:** Ready for `create-spine-tasks` decomposition  

**Epic alias:** Phase 60 — SP-CTR (SP-521+)

**Prerequisite:** v1.8.1 exit criteria met ([`PRD-v1.8.1-reconciliation-handoff.md`](PRD-v1.8.1-reconciliation-handoff.md)).

**Release profile:** minor — 10–15 tasks; docs-first wave, then 3 bugs : 1 enhancement.

---

## 1. Executive summary

v1.5.0+ contract verify and stet integration reduced false positives, but release batches still fail when:

- `testCommand` uses `npm test -- <path>` which runs the **full suite** ([#187](https://github.com/beettlle/pi-spine/issues/187), [#141](https://github.com/beettlle/pi-spine/issues/141))
- Collateral `phase23-exit-verify` LOC policy fails unrelated tasks ([#187](https://github.com/beettlle/pi-spine/issues/187))
- `fileScopeMustChange` fails when files landed before resume `sinceCommit` ([#171](https://github.com/beettlle/pi-spine/issues/171))
- Task packets lack authoring guardrails (wave size, docs-only scope, scoped tests) ([#142](https://github.com/beettlle/pi-spine/issues/142)–[#144](https://github.com/beettlle/pi-spine/issues/144))
- CI `flutter-analyzer-hygiene` fails on ubuntu-latest ([#174](https://github.com/beettlle/pi-spine/issues/174))

**v1.9.0** makes bad task packets **fail at validate/preflight** instead of mid-batch `contract_failed`.

**Tagline:** *Catch bad contracts before the batch starts.*

---

## 2. Scope lock

### In scope (Phase 60 — SP-CTR)

| FR | Description |
|----|-------------|
| FR-STA-10 | Reject or warn on `npm test -- <single-file>` in `testCommand`; recommend `node --test` pattern |
| FR-STA-11 | Contract verify honors resume baseline / pre-landed `fileScopeMustChange` |
| FR-STA-12 | `create-spine-tasks` P1 warnings: scoped testCommand, docs-only scope, wave >8, doc paths in file scope |
| FR-STA-13 | CI platform hygiene — fix or document skip for [#174](https://github.com/beettlle/pi-spine/issues/174) |
| FR-STA-14 | Preflight advisory for stale `fileScopeMustChange` ([#159](https://github.com/beettlle/pi-spine/issues/159)) |
| FR-STA-15 | Serialized lane scoped contract verify ([#62](https://github.com/beettlle/pi-spine/issues/62), [#105](https://github.com/beettlle/pi-spine/issues/105)) |
| FR-STA-16 | Contract template parallel / must-not-change semantics ([#63](https://github.com/beettlle/pi-spine/issues/63)) |

### Deferred (v1.10.0+)

- Release `npm run release:check` enforcement ([#175](https://github.com/beettlle/pi-spine/issues/175))
- Sequence release profile ([#54](https://github.com/beettlle/pi-spine/issues/54))
- Skill template polish ([#145](https://github.com/beettlle/pi-spine/issues/145)–[#150](https://github.com/beettlle/pi-spine/issues/150)) unless room in minor budget

### Non-goals

- Changing stet CLI behavior
- Full contract schema redesign
- npm publish workflow changes

---

## 3. Baseline — already landed

| Work | Reference | Gap |
|------|-----------|-----|
| Worker env isolation in contract verify | SP-491, #155 | `npm test --` scoping still broken |
| Trailing-slash fileScope match | SP-490, #118 | Resume baseline timing #171 |
| Stet contract integration | SP-494 | Collateral full-suite runs |
| Contract resume baseline (partial) | SP-478, SP-479 staged | Not landed |
| must-not-change docs chain | SP-410–417 staged | Partial |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| Contract parse/validate | `src/tasks/packet/parse-contract.mjs`, `validate-contract.mjs` |
| Contract verify | `src/batch/contract-verify.mjs` |
| tasks validate CLI | `src/cli/tasks-validate.mjs`, `bin/spine-tasks.mjs` |
| Preflight | `src/batch/spine-preflight-lib.mjs`, `bin/spine-preflight.mjs` |
| Planner warnings | `src/planner/index.mjs` |
| create-spine-tasks skill | `skills/create-spine-tasks/SKILL.md`, `references/contract-template.md` |
| CI | `.github/workflows/*.yml`, `tests/adoption/flutter-analyzer-hygiene.test.mjs` |
| LOC policy | `scripts/verify-phase23-exit.mjs`, `tests/cli/phase23-exit-verify.test.mjs` |

---

## 5. GitHub issue intake

| Issue | Closes / Partial | Assigned task |
|-------|------------------|---------------|
| [#187](https://github.com/beettlle/pi-spine/issues/187) | Closes | SP-521 (new) |
| [#141](https://github.com/beettlle/pi-spine/issues/141) | Closes | SP-522 (new) |
| [#142](https://github.com/beettlle/pi-spine/issues/142) | Closes | SP-523 (new) |
| [#143](https://github.com/beettlle/pi-spine/issues/143) | Closes | SP-524 (new) |
| [#144](https://github.com/beettlle/pi-spine/issues/144) | Closes | SP-525 (new) |
| [#171](https://github.com/beettlle/pi-spine/issues/171) | Closes | SP-526 (new) |
| [#159](https://github.com/beettlle/pi-spine/issues/159) | Closes | SP-527 (new) |
| [#174](https://github.com/beettlle/pi-spine/issues/174) | Closes | SP-528 (new) |
| [#105](https://github.com/beettlle/pi-spine/issues/105) | Partial | SP-478, SP-479 |
| [#62](https://github.com/beettlle/pi-spine/issues/62) | Closes | SP-416, SP-417 |
| [#63](https://github.com/beettlle/pi-spine/issues/63) | Closes | SP-410–413 subset |

---

## 6. Existing staged tasks

| SP-ID | Slug | Size | Status | Issue |
|-------|------|------|--------|-------|
| SP-373 | contract-verify-pre-landed | S | Staged | #56 (related) |
| SP-374 | preflight-stale-filescope | S | Staged | #56 |
| SP-410 | contract-template-parallel | S | Staged | #63 |
| SP-411–413 | must-not-change chain | S | Staged | #63 |
| SP-414–417 | serialized lane verify | S/M | Staged | #62 |
| SP-478 | contract-verify-resume-baseline | M | Staged | #105 |
| SP-479 | contract-cli-friction-fixes | S | Staged | #105 |

---

## 7. Task decomposition (SP-CTR ↔ SP-ID)

| SP-CTR | SP-ID | Slug | Mission | Size | Deps | Closes |
|--------|-------|------|---------|------|------|--------|
| 001 | SP-521 | ctr-handoff-doc | This handoff doc committed | S | — | — |
| 002 | SP-522 | ctr-validate-npm-test-scope | `spine tasks validate` rejects/warns `npm test -- <file>` | S | — | #187, #141 |
| 003 | SP-523 | ctr-skill-scoped-testcommand | create-spine-tasks: scoped testCommand template + examples | S | SP-522 | #141 |
| 004 | SP-524 | ctr-planner-wave-size-warn | Hard-warn when wave >8 tasks in plan output | S | — | #143 |
| 005 | SP-525 | ctr-skill-docs-only-scope | fileScopeMustNotChange docs-only pattern in skill | S | — | #142 |
| 006 | SP-526 | ctr-filescope-resume-baseline | Fix #171: fileScopeMustChange vs pre-landed sinceCommit | S | SP-478 | #171 |
| 007 | SP-527 | ctr-preflight-stale-filescope | Preflight suggest redirect for pre-landed paths | S | SP-373 | #159 |
| 008 | SP-528 | ctr-ci-flutter-analyzer-ubuntu | Fix #174 ubuntu-latest verifyContract failure | S | — | #174 |
| 009 | SP-478 | contract-verify-resume-baseline | Resume baseline for contract scope checks | M | SP-415 | #105 (Partial) |
| 010 | SP-479 | contract-cli-friction-fixes | Contract CLI friction from #105 | S | SP-478 | #105 (Partial) |
| 011 | SP-416 | serialized-lane-scoped-verify | Wire scoped diff API for serialized lanes | M | SP-414 | #62 (Partial) |
| 012 | SP-417 | close-62-serialized-verify | Capstone close #62 | S | SP-416 | #62 |
| 013 | SP-410 | contract-template-parallel | Parallel semantics in contract template | S | — | #63 (Partial) |
| 014 | SP-413 | validate-must-not-warn | tasks validate must-not-change warnings | S | SP-410 | #63 |
| 015 | SP-529 | ctr-context-phase60 | CONTEXT Phase 60 + dependencies.json | S | leaves | — |

**Release-scoped wave order:** docs/skill (SP-523, SP-525) → validate (SP-522, SP-524) → contract engine (SP-478, SP-526) → CI (SP-528) → capstones.

---

## 8. Gaps requiring new packets

| Gap | Proposed SP-ID |
|-----|----------------|
| validate npm test scoping | SP-522 |
| skill testCommand guidance | SP-523 |
| wave size warning | SP-524 |
| docs-only scope skill | SP-525 |
| #171 resume baseline fix | SP-526 |
| #159 preflight redirect | SP-527 |
| #174 CI fix | SP-528 |
| CONTEXT Phase 60 | SP-529 |

SP-521 (handoff doc) is satisfied by this file — optional packet only if operator wants journal trail.

---

## 9. Wave run order

```text
SP-522 (validate npm test)
  ├── SP-523 (skill testCommand)
  ├── SP-524 (wave warn)
  └── SP-525 (docs-only scope)
SP-478 → SP-479 → SP-526
SP-373 → SP-527
SP-414 → SP-415 → SP-416 → SP-417
SP-410 → SP-411 → SP-412 → SP-413
SP-528 (CI — parallel wave 0)
leaves → SP-529
```

### Suggested batches

| Wave | Tasks | Mix |
|------|-------|-----|
| D0 (docs) | SP-523, SP-525 | 2 documentation |
| V0 (validate) | SP-522, SP-524, SP-527 | 2 bug + 1 enhancement |
| C0 (contract) | SP-478, SP-526, SP-479 | 3 bugs |
| C1 (lanes) | SP-416, SP-417 | 2 bugs |
| C2 (must-not) | SP-410, SP-413 | 1 bug + 1 doc |
| CI | SP-528 | 1 bug |
| Cap | SP-529 | — |

**Regression gate:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run coverage:check`

---

## 10. Exit criteria

- [ ] `spine tasks validate` fails or warns on `testCommand: npm test -- tests/foo.test.mjs`
- [ ] 10-task dogfood batch: zero collateral full-suite `contract_failed` from unrelated LOC policy
- [ ] `spine preflight` warns on release scope with bad testCommand patterns
- [ ] #171, #187, #174, #141–#144 closed
- [ ] create-spine-tasks skill documents scoped `node --test` pattern
- [ ] Open GitHub issues ≤ ~25
- [ ] CONTEXT Phase 60 complete; Next Task ID → SP-530

---

## 11. Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-CTR-01 | npm test scope rejected | `tests/cli/tasks-validate-contract.test.mjs` |
| M-CTR-02 | Resume baseline scope | `tests/batch/contract-verify-resume.test.mjs` |
| M-CTR-03 | CI ubuntu green | `.github/workflows/ci.yml` |
| M-CTR-04 | Wave size warn | `tests/planner/wave-size-warn.test.mjs` |

---

## 12. Workflow after this document

```text
Use create-spine-tasks to decompose docs/PRD-v1.9.0-contract-guardrails-handoff.md
into SP-521+ packets (skip SP-521 if handoff-only). Update CONTEXT.md Phase 60.
```

```bash
spine tasks validate pending
spine tasks analyze pending
spine plan SP-522 SP-523 SP-525 SP-528
```
