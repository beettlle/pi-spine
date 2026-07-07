# Task: SP-530 — Harness release:check skill

**Created:** 2026-07-07
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Skill-only change wiring existing `npm run release:check` into release-operator Phase 5–6 gate before version bump.
**Score:** 2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Implement FR-STA-20: the `spine-release-operator` skill must **enforce** `npm run release:check` before any `npm version` or tag push ([#175](https://github.com/beettlle/pi-spine/issues/175)). Phase 5 must hard-stop when release:check fails; Phase 6 must reference the gate and forbid bypass.

**Closes:** [#175](https://github.com/beettlle/pi-spine/issues/175)

## Dependencies

- **None**

## Context to Read First

- [`docs/PRD-v1.10.0-release-harness-handoff.md`](../../docs/PRD-v1.10.0-release-harness-handoff.md) §FR-STA-20
- [`skills/spine-release-operator/SKILL.md`](../../skills/spine-release-operator/SKILL.md) Phase 5–6
- [`package.json`](../../package.json) `scripts.release:check`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `skills/spine-release-operator/SKILL.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `skills/spine-release-operator/SKILL.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Read issue #175 and current Phase 5–6 skill text
- [ ] Confirm `npm run release:check` script exists and matches CI parity

### Step 1: Enforce release:check gate

- [ ] Phase 5: add explicit **HARD STOP** when `npm run release:check` exits non-zero — do not present publish checklist as passable
- [ ] Phase 6: require Phase 5 release:check success before `npm version`; document operator must not skip
- [ ] Add failure recovery: fix failures on main, re-run release:check, then re-attempt Phase 5

### Step 2: Testing & Verification

- [ ] `grep -q 'release:check' skills/spine-release-operator/SKILL.md` — gate referenced in Phase 5 and 6
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` (full suite — docs-only contract)

### Step 3: Documentation & Delivery

- [ ] Update manifest template publish checklist if needed
- [ ] Comment on #175 with skill behavior
- [ ] Create `.DONE`

## Completion Criteria

- [ ] Skill blocks publish path when release:check would fail (documented hard stop)
- [ ] Phase 6 cannot proceed without explicit operator approval **and** documented release:check pass

## Do NOT

- Change `npm run release:check` implementation in `package.json`
- Automate `npm version` without operator approval

## Git Commit Convention

- `feat(SP-530): enforce release:check gate in release-operator skill`
