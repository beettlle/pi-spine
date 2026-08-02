# Task: SP-693 — Post-publish smoke ETARGET retry

**Created:** 2026-08-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Docs + small bounded retry script; must not mask real missing versions after retries exhaust.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Closes #247 — After `release.yml` succeeds, npm registry lag can make the first `npm install -g pi-spine@<version>` fail with `ETARGET` / "No matching version found" even when `npm view` already shows the version. Document retry/backoff in `docs/release/npm-publish.md` and `skills/spine-release-operator` Phase 6 smoke. Add optional `scripts/post-publish-smoke.sh` with bounded retries on ETARGET/404; exit non-zero after retries exhaust so real missing-version failures are not masked.

Depends on SP-691 so Phase 6 skill edits land after scope/model-pin hard rules.

## Dependencies

- **Task:** SP-691 (release-operator skill hard rules must land before Phase 6 smoke edits)

## Context to Read First

- `docs/release/npm-publish.md` — post-publish smoke section
- `skills/spine-release-operator/SKILL.md` — Phase 6 smoke
- `docs/release/post-mortem-v2.12.1.md` — §F9 (read-only)
- GitHub #247
- SP-691 PROMPT (skill edit baseline)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (script may call npm when run manually)

## File Scope

- `docs/release/npm-publish.md`
- `skills/spine-release-operator/SKILL.md`
- `scripts/post-publish-smoke.sh`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `bash -n scripts/post-publish-smoke.sh` |
| fileScopeMustChange | `docs/release/npm-publish.md`, `skills/spine-release-operator/SKILL.md`, `scripts/post-publish-smoke.sh` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `tests/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm current smoke docs have no ETARGET retry guidance
- [ ] Confirm SP-691 skill changes are present on the branch (dependency)

### Step 1: Docs + retry script

- [ ] Document bounded retry/backoff for post-publish `npm install -g` on ETARGET/404 in `docs/release/npm-publish.md`
- [ ] Update spine-release-operator Phase 6 smoke to use retry guidance (and optional script)
- [ ] Add `scripts/post-publish-smoke.sh`: install + `spine version` + `spine doctor`; retry only on ETARGET/404-class failures; fail after bounded attempts; do not treat other install errors as lag
- [ ] Make script executable (`chmod +x`)

### Step 2: Testing & Verification

- [ ] Run contract `testCommand` only (`bash -n`)
- [ ] Fix syntax issues in the script

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/release/npm-publish.md`
- `skills/spine-release-operator/SKILL.md`

**Check If Affected:**
- `docs/release/post-mortem-v2.12.1.md` — F9 already tracks #247

## Completion Criteria

- [ ] Operator docs specify retry on registry lag after tag publish
- [ ] Optional script exits 0 after successful retry within a bounded window
- [ ] Exhausted retries do not mask real missing-version failures
- [ ] Phase 6 skill smoke references the retry policy/script

## Do NOT

- Infinite retry loops or sleep without a max attempt count
- Swallow non-ETARGET install failures as "registry lag"
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
- Skip tests

## Git Commit Convention

- `feat(SP-693): post-publish smoke retry on ETARGET (#247)`
