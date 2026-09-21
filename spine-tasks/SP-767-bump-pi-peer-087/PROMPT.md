# Task: SP-767 — Bump pi-coding-agent peer to ^0.87.0

**Created:** 2026-09-21
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** Peer bump may affect extension tool schemas / doctor pi version checks; audit currently 0 high.
**Score:** 3/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 1
**Problem theory:** Locked on `@earendil-works/pi-coding-agent` ^0.85.1 while latest is 0.87.0 (≥1 0.x minor drift). Release profile requires peer hygiene for minor.

## Mission

Bump `@earendil-works/pi-coding-agent` to `^0.87.0`, refresh `package-lock.json`, keep `npm audit` at 0 high, and fix only typecheck/lint breakages caused by the peer bump. Do **not** bump TypeScript 7, `@types/node` 26, or GitHub Actions majors (#285 Wave C remains deferred). Leave a short STATUS discovery noting comment opportunity on #285 (do not close #285).

## Dependencies

- **None**

## Context to Read First

- `package.json` — peer pin
- `spine-tasks/SP-755-bump-pi-peer-audit/PROMPT.md` — prior bump pattern
- GitHub #285 (Wave C still open — do not close)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** Network for npm install/audit

## File Scope

- `package.json`
- `package-lock.json`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && npm run lint && npm audit --audit-level=high && node -e "const p=require('./package.json'); const d=p.devDependencies; const v=d && d['@earendil-works/pi-coding-agent']; if(!String(v).includes('0.87')) process.exit(1);"` |
| fileScopeMustChange | `package.json`, `package-lock.json` |

## Steps

### Step 0: Preflight

- [ ] Record current peer pin and `npm outdated` for pi-coding-agent
- [ ] Dependencies satisfied

### Step 1: Peer bump

- [ ] Bump `@earendil-works/pi-coding-agent` to `^0.87.0` and refresh lockfile
- [ ] Fix only typecheck/lint failures caused by the bump
- [ ] Confirm `npm audit --audit-level=high` exits 0

**Artifacts:**
- `package.json` (modified)
- `package-lock.json` (modified)

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand`
- [ ] Fix all failures from the peer bump

### Step 3: Documentation & Delivery

- [ ] Discoveries logged (before/after versions)
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `README.md` / install docs if they pin 0.85 explicitly

## Completion Criteria

- [ ] Peer pin includes 0.87
- [ ] typecheck + lint + audit-high=0
- [ ] #285 left open (Wave C deferred)

## Git Commit Convention

- `chore(SP-767): bump pi-coding-agent to ^0.87.0`

## Do NOT

- Bump TypeScript 7 / Actions majors
- Close #285
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
