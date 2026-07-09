# Task: SP-545 — Release proof regression gate script

**Created:** 2026-07-08
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** Shell script with prerequisite checks; small blast radius.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Mission

Create `scripts/release-proof-gate.sh` — reusable prereq gate before v2.0.0 proof batch (FR-STA-35). Script must exit non-zero on failure.

**Checks (minimum):**
1. `spine doctor` green
2. `spine preflight` green (clean git, no active batch)
3. `gitnexus status` up-to-date (or warn with escape hatch `SPINE_PROOF_SKIP_GITNEXUS=1`)
4. SP-544 signoff checklist file exists
5. `docs/release/manifest-v2.0.0-proof.md` exists (SP-543)
6. Open P1 bug count = 0 (optional warn, not block)

**Source:** [`docs/PRD-v2.0.0-automation-proof-handoff.md`](../../docs/PRD-v2.0.0-automation-proof-handoff.md) §3, §11.3

## Dependencies

- SP-544

## File Scope

- `scripts/release-proof-gate.sh`
- `docs/release/automation-signoff-checklist.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `bash -n scripts/release-proof-gate.sh && node --test tests/scripts/release-proof-gate.test.mjs` |
| fileScopeMustChange | `scripts/release-proof-gate.sh` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-544 `.DONE` or signoff checklist exists on branch

### Step 1: Implement gate script

- [ ] `set -euo pipefail`; explicit exit codes
- [ ] Print pass/fail summary per check
- [ ] Document usage in script header comment

**Artifacts:**
- `scripts/release-proof-gate.sh`

### Step 2: Add test

- [ ] Create `tests/scripts/release-proof-gate.test.mjs` — syntax + dry-run mock checks (no real spine doctor in unit test)

**Artifacts:**
- `tests/scripts/release-proof-gate.test.mjs`

### Step 3: Testing & Verification

- [ ] `node --test tests/scripts/release-proof-gate.test.mjs`
- [ ] `bash -n scripts/release-proof-gate.sh`

### Step 4: Documentation & Delivery

- [ ] Reference script in `docs/release/automation-signoff-checklist.md` if not already linked
- [ ] Create `.DONE`

## Completion Criteria

- [ ] `./scripts/release-proof-gate.sh` exits 0 when prerequisites met

## Git Commit Convention

- `feat(SP-545): release proof regression gate script`

## Do NOT

- Run full proof batch from this task
