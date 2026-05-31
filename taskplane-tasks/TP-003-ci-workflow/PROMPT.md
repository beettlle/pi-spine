# Task: TP-003 — Add minimal GitHub Actions CI

**Created:** 2026-05-31
**Size:** S

## Review Level: 0 (None)

**Assessment:** Single workflow file; no product logic or auth surface.
**Score:** 1/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 0

## Mission

Add a minimal GitHub Actions CI workflow so every push/PR to `main` runs typecheck, tests (when present), and CLI smoke checks — matching Phase 0 deliverable "CI" and PRD §20.4 release gates.

## Dependencies

- **None**

## Context to Read First

**Tier 2 (area context):**
- `taskplane-tasks/CONTEXT.md`

**Tier 3:**
- `package.json` — existing scripts
- [Taskplane ci.yml](https://github.com/HenryLach/taskplane/blob/main/.github/workflows/ci.yml)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `.github/workflows/ci.yml` (new)
- `README.md`

## Steps

### Step 0: Preflight

- [ ] Confirm `npm run typecheck` works locally
- [ ] Confirm whether `npm test` exists in `package.json`

### Step 1: Add CI workflow

- [ ] Create `.github/workflows/ci.yml` on `push` and `pull_request` to `main`
- [ ] Use `ubuntu-latest`, Node 22+, `npm ci`, cache `package-lock.json`
- [ ] Run `npm run typecheck`
- [ ] Run `npm test` when the script exists
- [ ] CLI smoke: `node bin/spine.mjs version`, `help`, `doctor` (allow doctor exit 1 until TP-002 — document in workflow comment)

**Artifacts:**
- `.github/workflows/ci.yml` (new)

### Step 2: Testing & Verification

- [ ] Run the same commands locally that CI will run
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Add CI badge or note to README.md
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `README.md` — CI badge or short CI section

## Completion Criteria

- [ ] CI workflow committed and commands pass locally

## Git Commit Convention

- **Step completion:** `feat(TP-003): complete Step N — description`

## Do NOT

- Add release/Pages/npm publish workflows
- Modify init or extension code

---

## Amendments (Added During Execution)
