# Task: SP-757 — Document minPiVersion, engines, and peer bump

**Created:** 2026-09-13
**Size:** S

## Review Level: 0 (None)

**Risk:** Documentation only; no runtime code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** After Wave A, operators need a single place stating Node ≥22.19, pi ≥0.80, and peer `pi-coding-agent` ^0.85.

## Mission

Partial #285 — Document the Wave A floors (`engines.node`, `pi.minPiVersion`, peer pin) in README and npm-publish / operator install docs so doctor failures and local installs are explainable. Do not change `package.json` here (SP-755 owns pins).

## Dependencies

- **Task:** SP-755 (pins must exist on `main` before documenting versions)

## Context to Read First

- `package.json` — engines / `pi.minPiVersion` / peer after SP-755
- `docs/release/npm-publish.md`
- `README.md`
- GitHub #285 — Wave A doc expectations

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `README.md`
- `docs/release/npm-publish.md`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `README.md`, `docs/release/npm-publish.md` |
| fileScopeMustNotChange | `src/**`, `bin/**`, `package.json` |

## Steps

### Step 0: Preflight

- [ ] Read post-SP-755 `engines.node` and `pi.minPiVersion` from `package.json`
- [ ] Dependencies satisfied

### Step 1: Document floors

- [ ] README: Node / pi minimums and peer expectation
- [ ] npm-publish: note minPiVersion/engines for release operators
- [ ] operator-runbook: short install/doctor row for the new floors (no wait-UX rewrite — that is SP-756)

**Artifacts:**
- `README.md` (modified)
- `docs/release/npm-publish.md` (modified)
- `docs/adoption/operator-runbook.md` (modified)

### Step 2: Testing & Verification

- [ ] Contract `testCommand` is `true`
- [ ] Version numbers in docs match `package.json`

### Step 3: Documentation & Delivery

- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `README.md` — engines / minPiVersion / peer *(also in File Scope)*
- `docs/release/npm-publish.md` — release operator note *(also in File Scope)*

**Check If Affected:**
- `docs/QUICK-REFERENCE.md` — only if install cheatsheet exists (prefer SP-756 ownership of QR wait sections)

## Completion Criteria

- [ ] Docs match Wave A pins
- [ ] Partial #285 (docs)

## Git Commit Convention

- `docs(SP-757): document minPiVersion and engines floors (#285)`

## Do NOT

- Edit `package.json` / lockfile
- Bump TypeScript/ESLint
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
