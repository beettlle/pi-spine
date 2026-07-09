# Task: SP-563 — GitHub backlog hygiene

**Created:** 2026-07-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** Close issues already fixed on main with landed commit references.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Close GitHub issues already fixed on `main` at v2.1.0 release time. Comment each with landed SP-ID and commit SHA.

| Issue | Landed in |
|-------|-----------|
| [#130](https://github.com/beettlle/pi-spine/issues/130) | SP-483 |
| [#171](https://github.com/beettlle/pi-spine/issues/171) | SP-526 |
| [#156](https://github.com/beettlle/pi-spine/issues/156) | SP-531 |
| [#141](https://github.com/beettlle/pi-spine/issues/141) | SP-522/523/549 — verify then close or Partial |
| [#125](https://github.com/beettlle/pi-spine/issues/125) | SP-352/353 — verify planner parity then close |

**Depends on:** SP-555–562 implementation tasks complete (or verify-only issues may close earlier).

## Dependencies

- SP-555
- SP-556
- SP-557
- SP-558
- SP-559
- SP-560
- SP-561
- SP-562

## File Scope

- `docs/release/manifest-v2.1.0.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/manifest-v2.1.0.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-483, SP-526, SP-531 `.DONE` on main
- [ ] Verify #141 and #125 fix status

### Step 1: Close issues

- [ ] `gh issue close` with comment citing commit SHA for each verified issue
- [ ] Record closed issue numbers in manifest post-mortem section

### Step 2: Testing & Verification

- [ ] `gh issue list --repo beettlle/pi-spine --state open --json number | jq length` — record delta vs baseline 29

### Step 3: Documentation & Delivery

- [ ] Update manifest with hygiene closure table
- [ ] Create `.DONE`

## Completion Criteria

- [ ] All verify-only issues closed with evidence comments
- [ ] Open issue count decreased vs v2.1.0 baseline

## Git Commit Convention

- `chore(SP-563): v2.1.0 GitHub backlog hygiene`

## Do NOT

- Close issues with remaining implementation gaps (#169, #185 — closed by SP-555/560)
