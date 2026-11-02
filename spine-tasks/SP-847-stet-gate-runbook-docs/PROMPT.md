# Task: SP-847 — Runbook and stet overview: threshold gate, stet v1.4.0 floor, review timeout

**Created:** 2026-11-01
**Size:** S

## Review Level: 0 (None)

**Risk:** Docs-only. Stale docs keep operators chaining stet onto `testCommand` and gating on every finding.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** Runbook §8.1 (`docs/adoption/operator-runbook.md` ~2273-2362) still says the contract fails while any active finding remains (~2320) and predates stet v1.4.0. `docs/stet-overview.md` §1 and §5 describe the stet call on `testCommand`. SP-846 (same batch) changes `scripts/spine-stet-contract-run.sh` to gate on `stet list --min-severity "$SPINE_STET_MIN_SEVERITY" --min-confidence "$SPINE_STET_MIN_CONFIDENCE"` (defaults `warning`, `0.8`; invalid severity exits 2; stet without the flags falls back to gating on every active finding with a stderr warning). stet v1.4.0 also adds file imports to JS/TS hunks, drops existence claims the file disproves, gives the critic the reviewer's context (slower reviews), and keeps dismissals across line shifts.

## Mission

Operators reading runbook §8.1 or the stet overview know how the stet contract gate decides, which stet version it needs, and how long reviews take:

1. **Runbook §8.1** — "Contract behavior" list: replace the "any active finding fails" rule with the threshold gate (defaults, both env vars, exit 2 on invalid severity, the below-threshold stderr note, the old-stet fallback). Prerequisites: stet ≥ v1.4.0 (`stet --version`). Time budget: critic requests carry more context in v1.4.0; recommend `spine settings set contract.reviewTimeoutMs 1800000` for stet-gated batches. Hazards: dismissals now survive line shifts above them (stet #38).
2. **Stet overview** — §1 and §5 show the stet call in `reviewCommand` (SP-845), not chained onto `testCommand`, and mention the threshold env vars.

## Dependencies

- **None** (documents SP-846's interface as specified above; no file overlap)

## Context to Read First

- `docs/adoption/operator-runbook.md` 2270-2365
- `docs/stet-overview.md` 1-90, 185-218
- stet v1.4.0 notes: `gh release view v1.4.0 --repo beettlle/stet`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`
- `docs/stet-overview.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md`, `docs/stet-overview.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `scripts/**` |

## Steps

### Step 0: Preflight

- [ ] Read runbook §8.1 and the stet overview; list every sentence that says any active finding fails or shows stet on `testCommand`

### Step 1: Runbook §8.1

- [ ] Contract behavior: threshold gate, env overrides, exit 2, below-threshold note, old-stet fallback
- [ ] Prerequisites: stet ≥ v1.4.0
- [ ] Time budget: `contract.reviewTimeoutMs 1800000` recommendation for stet-gated batches
- [ ] Hazards: dismissals survive line shifts

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)

### Step 2: Stet overview

- [ ] §1 and §5 examples use `reviewCommand`; threshold env vars mentioned

**Artifacts:**
- `docs/stet-overview.md` (modified)

### Step 3: Testing & Verification

- [ ] `rg -l 'operator-runbook.md|stet-overview.md' tests/` and run only the hits with `node --experimental-strip-types --test --test-reporter=dot <files>` (none → note "no tests reference these docs")
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-847-stet-gate-runbook-docs/.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — §8.1 stet contract gate
- `docs/stet-overview.md` — `reviewCommand` examples

**Check If Affected:**
- `.cursor/rules/stet-integration.mdc` (operator-owned; note gaps in Discoveries, do not edit)

## Completion Criteria

- [ ] No remaining doc text says any active finding fails the stet contract
- [ ] stet ≥ v1.4.0 floor and `contract.reviewTimeoutMs` guidance present

## Git Commit Convention

- `docs(SP-847): stet threshold gate, v1.4.0 floor, review timeout`

## Do NOT

- Edit `scripts/`, `src/`, or `bin/`
- Edit `.cursor/rules/stet-integration.mdc`
- Edit anything under `.spine/` or `.review/`
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- None
