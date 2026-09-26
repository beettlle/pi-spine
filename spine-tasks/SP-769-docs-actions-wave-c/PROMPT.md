# Task: SP-769 — Document Actions majors (close #285 Wave C)

**Created:** 2026-09-26
**Size:** S

## Review Level: 0 (None)

**Risk:** Documentation only; no runtime code.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** After Wave C pins land, operators need a single place stating CI/release/real-pi use Actions checkout/setup-node/upload-artifact **v7** and release github-script **v9**, completing #285.

## Mission

Closes #285 — Document the Wave C Actions majors in release/CI docs so Trusted Publisher / OIDC stage and local CI parity stay explainable. Confirm Waves A–B floors already documented. Do not change workflow YAML here (SP-768 owns pins).

## Dependencies

- **Task:** SP-768 (Actions pins must exist on `main` before documenting versions)

## Context to Read First

- GitHub #285 — full acceptance checklist (Wave C row)
- `.github/workflows/ci.yml` / `release.yml` / `real-pi.yml` — pins after SP-768
- `docs/release/npm-publish.md`
- `spine-tasks/SP-757-minpi-engines-docs/PROMPT.md` — prior #285 docs pattern

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/release/npm-publish.md`
- `docs/QUICK-REFERENCE.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/release/npm-publish.md`, `docs/QUICK-REFERENCE.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-768 pins on workflows (v7 / github-script v9)
- [ ] Note existing Wave A/B floor docs from SP-757
- [ ] Dependencies satisfied

### Step 1: Document Actions majors

- [ ] Record checkout/setup-node/upload-artifact **v7** and github-script **v9** in npm-publish and QUICK-REFERENCE (CI/release section)
- [ ] Note that #285 Waves A–C are complete; do not reopen TypeScript 7 / `@types/node` 26

**Artifacts:**
- `docs/release/npm-publish.md` (modified)
- `docs/QUICK-REFERENCE.md` (modified)

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand` (`true`)
- [ ] Confirm File Scope paths changed

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**

- `docs/release/npm-publish.md` — Actions major pins for CI/release
- `docs/QUICK-REFERENCE.md` — short CI Actions pin note

**Check If Affected:**

- `README.md` — only if it hardcodes Actions v4

## Completion Criteria

- [ ] Docs state Actions v7 / github-script v9 for the three workflows
- [ ] Closes #285
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-769): document Actions v7 / github-script v9 (#285)`

## Do NOT

- Edit `.github/workflows/**` (SP-768)
- Close unrelated issues
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`
