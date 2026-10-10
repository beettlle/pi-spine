# Authoring evidence (create-spine-tasks)

Incident and measurement data behind the rules in [SKILL.md](../SKILL.md). Read this when a rule seems arbitrary or an operator asks "why"; authors applying the rules do not need it.

---

## Two-deliverable split (Phase 55)

Every superseded composite task split into exactly two children because it bundled independent deliverables:

| Superseded | Split into |
|------------|------------|
| SP-419 | SP-466, SP-467 |
| SP-428 | SP-468, SP-469 |
| SP-430 | SP-470, SP-471 |
| SP-436 | SP-474, SP-475 |
| SP-461 | SP-478, SP-479 |

## Mega-wave stalls (Phase 13 / Phase 15)

Eight Phase-13 tasks in one batch (`SP-064`…`SP-085`) caused parallel pi stalls; 8-task waves stalled again in Phase 15 (SP-086–088). Prefer:

| Instead of | Use |
|------------|-----|
| One batch with 8 M tasks | Wave A: 4 tasks → land → Wave B: 4 tasks |
| One L task "refactor engine + resume + tests" | SP-074 engine scope, SP-076 resume DRY, SP-078 tests (deps) |

## Review Level recalibration (token-cost audit, Oct 2026)

Measured on this repository (`main` @ `c6891504`, v2.27.0) — basis for "Level 1 is the code default" ([#326](https://github.com/beettlle/pi-spine/issues/326), [#342](https://github.com/beettlle/pi-spine/issues/342)):

| Measure | Value |
|---------|-------|
| Engine reviews started, Sep–Oct 2026 | 114 plan · 44 code · 66 final |
| Journaled verdicts (all retained lane journals) | 140 APPROVE · 96 PASS · **0 REVISE** |
| `.reviews/` artifacts ever written that say REVISE | 8 of 844 (newest SP-474, 2026-07-05) |
| Tasks failed by reviewer infrastructure, Sep–Oct | 12 (timeouts, malformed function calls, 400s) |
| Wall time, failed vs completed attempts | 15.1 h vs 19.9 h |

Each review level adds reviewer spawns per task (Level 1: plan + final; Level 2+: plan + code + final). With approval near 100%, the extra spawns cost tokens and add failure surface without catching defects. Level 2 remains right for security, data-model, and hot shared-module changes, where a single missed defect is expensive.

## Execute and matrix adoption

As of v2.27.0, **0** real `Type: execute` or `## Matrix` packets had shipped on this repository — every deterministic step (generators, smoke runs, evidence collection) ran inside an LLM worker. Execute and matrix tasks run the Contract command with no LLM worker; see [Step 2a](../SKILL.md#step-2a-choose-task-type).

## Full-suite cost

| Measure | Value |
|---------|-------|
| Full suite size | 2,877 tests |
| Coverage run (`coverage-run.tap.log`) | ~176 s |
| Gate evidence `test-output.txt` | 243 KB |

Post-integrate `npm run release:check` already runs the full suite on `main` after every wave. A docs-only or S/M packet that reruns the full suite in its Testing step pays this cost a second time per task ([#341](https://github.com/beettlle/pi-spine/issues/341)).

## Usage fields

`spine metrics show` has token and cost columns from [#208](https://github.com/beettlle/pi-spine/issues/208), but 0 of 500 records carry usage until [#338](https://github.com/beettlle/pi-spine/issues/338) lands (workers and reviewers run pi in text mode). Use duration, attempt count, and failure class as cost proxies until then.
