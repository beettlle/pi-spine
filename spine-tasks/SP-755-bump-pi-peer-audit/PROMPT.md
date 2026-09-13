# Task: SP-755 — Wave A: pi-coding-agent 0.85 peer bump + audit clear

**Created:** 2026-09-13
**Size:** M

## Review Level: 2 (Plan and Code)

**Risk:** Peer/runtime dependency bump can break extension tool schemas and doctor min-version checks. Security highs (undici/brace-expansion/js-yaml) clear via 0.85.1.
**Score:** 5/8 — Blast radius: 3, Pattern novelty: 1, Security: 2, Reversibility: 1
**Problem theory:** Locked on pi-coding-agent ^0.80.3 with 3 high audit findings; npm reports fix via 0.85.1. `pi.minPiVersion` still 0.60.0 while peer is 0.80+.

## Mission

Partial #285 — Complete **Wave A** only: bump `@earendil-works/pi-coding-agent` to `^0.85.1`, align `typebox` to 1.3.x, set `engines.node` to `>=22.19.0`, set `pi.minPiVersion` to `0.80.0`, refresh lockfile, update CI/release pi stubs that pin below minPiVersion, and drive `npm audit` to **0 high** (prefer without `--force` after the peer bump). Do **not** bump TypeScript/ESLint/Actions (SP-758 / deferred Wave C).

## Dependencies

- **None**

## Context to Read First

- `package.json` — deps, engines, `pi.minPiVersion`
- GitHub #285 — Wave A acceptance criteria
- `spine-tasks/SP-499-bump-pi-coding-agent-audit-fix/PROMPT.md` — prior bump pattern
- `src/doctor/run-doctor-checks.mjs` — minPiVersion check (read-only unless stub fixtures need updates)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** Network for npm install/audit

## File Scope

- `package.json`
- `package-lock.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/real-pi.yml`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run release:check` |
| fileScopeMustChange | `package.json`, `package-lock.json` |

> **Coverage / lint:** `release:check` already runs typecheck, lint, full suite, and `coverage:check` (≥77%). Do not prefix lint/typecheck (triples work) or set `minLineCoverage` (redundant parse path). Post-integrate `release:check` on `main` remains the merge gate.

## Steps

### Step 0: Preflight

- [ ] Capture `npm audit` high/critical counts and `npm outdated` for pi-coding-agent
- [ ] Record current pins in STATUS.md
- [ ] Dependencies satisfied

### Step 1: Peer, engines, minPiVersion

- [ ] Bump `@earendil-works/pi-coding-agent` to `^0.85.1` and refresh lockfile
- [ ] Align `typebox` to 1.3.x; fix extension tool schemas only if install/typecheck fails
- [ ] Set `engines.node` to `>=22.19.0` and `pi.minPiVersion` to `0.80.0`
- [ ] Update CI/release pi stubs below the new floor (ci.yml / release.yml / real-pi.yml only)
- [ ] If a fixture asserts the old minPiVersion string, expand File Scope in an amendment and fix that fixture in-lane
- [ ] Re-run `npm audit` — 0 high; document any remaining moderate with rationale

**Artifacts:**
- `package.json` (modified)
- `package-lock.json` (modified)

### Step 2: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (`release:check`)
- [ ] Fix all failures from the peer/typebox bump
- [ ] Confirm `npm audit` high=0

### Step 3: Documentation & Delivery

- [ ] Discoveries logged (before/after audit counts)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None (operator docs in SP-757)

**Check If Affected:**
- `docs/release/npm-publish.md` — engines wording
- Extension registration tests if typebox schemas drift

## Completion Criteria

- [ ] Peer at ^0.85.1; minPiVersion 0.80.0; engines.node ≥22.19.0
- [ ] `npm audit` high=0
- [ ] `npm run release:check` green
- [ ] Partial #285 Wave A

## Git Commit Convention

- `chore(SP-755): bump pi-coding-agent 0.85 and clear audit highs (#285)`

## Do NOT

- Bump TypeScript 6 / ESLint 10 / Actions majors (SP-758 / Wave C)
- Use `npm audit fix --force` without STATUS escalation note
- Modify `.spine/` agent pins mid-release
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
