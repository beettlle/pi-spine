# Task: SP-112 — Spine-config testing defaults and doctor warn

**Created:** 2026-06-05
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Empty testing.* with evidence gates enabled — integrate evidence no-ops. Config + doctor only.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Align init template and dogfood `.spine/spine-config.json` testing fields with package.json scripts. Doctor warns when `gates.collect*Evidence` true but testing commands empty.

**Source:** SP-107 Finding #3 + SP-108 Finding F2 (HIGH).

## Dependencies

- **None**

## File Scope

- `templates/spine-config.json`
- `.spine/spine-config.json`
- `bin/spine-init.mjs`
- `bin/spine-doctor.mjs`
- `tests/config/spine-config-testing.test.mjs` (new or extend)

## Steps

### Step 1: Defaults and dogfood config
- [ ] Template defaults: test/build/testWithCoverage from package.json patterns
- [ ] Refresh pi-spine dogfood config
- [ ] Call `spine_review_step` (plan)

### Step 2: Doctor warning
- [ ] Doctor check: empty testing + evidence gates → warn/fail per SP-080 policy

### Step 3: Testing & Verification
- [ ] FULL suite + coverage gate

## Completion Criteria
- [ ] Dogfood config has non-empty testing fields
- [ ] Doctor surfaces misconfiguration

## Git Commit Convention
- `feat(SP-112): spine-config testing defaults and doctor warn`

## Do NOT
- Change gate FSM behavior in this task

---

## Amendments (Added During Execution)
