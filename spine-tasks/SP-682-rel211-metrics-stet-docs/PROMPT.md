# Task: SP-682 — Metrics, quota, and stet docs capstone

**Created:** 2026-07-20
**Size:** S

## Review Level: 0 (None)

**Assessment:** Documentation-only capstone for v2.11.0 metrics/stet surfaces.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

Partial #160, Partial #208, Partial #220 — Update `docs/QUICK-REFERENCE.md` Metrics section for usage rollups and `spine metrics quota`, and add operator-runbook notes covering credential classes (inference vs admin), degrade matrix, and stet gate evidence via `testing.review`. Do not claim npm publish.

## Dependencies

- **Task:** SP-675 (stet Approach 2 docs landed)
- **Task:** SP-677 (usage rollups CLI landed)
- **Task:** SP-679 (quota CLI landed)
- **Task:** SP-680 (HTML report landed)

## Context to Read First

- `docs/QUICK-REFERENCE.md` — Metrics and Reporting
- `docs/adoption/operator-runbook.md`
- `docs/stet-overview.md`
- Status notes from SP-675 / SP-677 / SP-679 / SP-680

## Environment

- **Workspace:** docs
- **Services required:** None

## File Scope

- `docs/QUICK-REFERENCE.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/QUICK-REFERENCE.md`, `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-675, SP-677, SP-679, SP-680 on `main`
- [ ] Inventory shipped CLI flags from those STATUS notes

### Step 1: QUICK-REFERENCE metrics

- [ ] Document usage rollups on `spine metrics show`
- [ ] Document `spine metrics quota` / `--json` / report paths
- [ ] Note honest unknowns and no-fake-cost rule

### Step 2: Operator runbook

- [ ] Credential classes + degrade matrix for quota probes
- [ ] Integrate-gate stet via `testing.review` / `scripts/spine-evidence-review.sh`
- [ ] Cross-link `docs/stet-overview.md` Approach 2

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Verify no application code changes

### Step 4: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/QUICK-REFERENCE.md` — metrics/quota
- `docs/adoption/operator-runbook.md` — quota + stet gate evidence

**Check If Affected:**
- `docs/stet-overview.md` — already updated in SP-675

## Completion Criteria

- [ ] Docs match shipped CLI behavior
- [ ] No publish claims for v2.11.0

## Do NOT

- Change `src/**` or `bin/**`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Claim release published

## Git Commit Convention

- `docs(SP-682): metrics quota and stet gate evidence (#208 #220 #160)`
