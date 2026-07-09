# Task: SP-572 — v2.2.0 GitHub backlog hygiene

**Created:** 2026-07-09
**Size:** S

## Review Level: 0 (None)

**Assessment:** Close issues already fixed on main with landed commit references.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Close GitHub issues already fixed on `main` at v2.2.0 release time. Comment each with landed SP-ID and commit SHA.

| Issue | Landed in |
|-------|-----------|
| [#128](https://github.com/beettlle/pi-spine/issues/128) | SP-559 |
| [#129](https://github.com/beettlle/pi-spine/issues/129) | SP-561 |
| [#146](https://github.com/beettlle/pi-spine/issues/146)–[#150](https://github.com/beettlle/pi-spine/issues/150) | SP-558 |
| [#175](https://github.com/beettlle/pi-spine/issues/175) | SP-562 |
| [#185](https://github.com/beettlle/pi-spine/issues/185) | SP-560 |

**Depends on:** SP-569, SP-571 implementation complete (#190, #158 closed by those tasks).

## Dependencies

- SP-569
- SP-571

## File Scope

- `docs/release/manifest-v2.2.0.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/manifest-v2.2.0.md` |

## Steps

### Step 0: Preflight

- [ ] Verify SP-558–562 `.DONE` on main with commit SHAs
- [ ] Verify SP-569 closed #190 and SP-571 closed #158

### Step 1: Close issues

- [ ] `gh issue close` with comment citing commit SHA for each verified issue
- [ ] Record closed issue numbers in manifest hygiene section

### Step 2: Testing & Verification

- [ ] `gh issue list --repo beettlle/pi-spine --state open --json number | jq length` — record delta vs baseline 22

### Step 3: Documentation & Delivery

- [ ] Update manifest with hygiene closure table
- [ ] Create `.DONE`

## Completion Criteria

- [ ] All verify-only issues closed with evidence comments
- [ ] Open issue count decreased vs v2.2.0 baseline

## Git Commit Convention

- `chore(SP-572): v2.2.0 GitHub backlog hygiene`

## Do NOT

- Close issues with remaining implementation gaps (#190, #158 — closed by SP-569/571)
