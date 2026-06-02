# Task: TP-043 — Local install without npm publish

**Created:** 2026-06-02
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

Document and harden **local/path install** so teams can use pi-spine on real projects before npm publish.

Deliverables:
1. **`docs/adoption/local-install.md`** — git clone, `pi install /path -l`, `npm link`, `package.json` `"pi-spine": "file:../pi-spine"`, verify slash commands
2. **`spine doctor` stale-PATH check** — when `which spine` resolves to a binary whose `--version` or mtime differs from repo `bin/spine.mjs`, emit warning + suggested fix
3. **Tests** — `tests/doctor/stale-path.test.mjs` (new): mock PATH scenarios
4. **README** — "Adoption (pre-publish)" section linking local-install doc

**Success:** Operator can install from git checkout on a consumer repo and doctor passes (or warns clearly about PATH).

## Dependencies

- **TP-030** — migrate/init docs exist

## Context to Read First

**Tier 3:** `bin/spine.mjs` (doctor), `README.md`, `docs/adoption/real-project-readiness.md`

## File Scope

- `docs/adoption/local-install.md` (new)
- `src/doctor/` or doctor logic in `bin/spine.mjs`
- `tests/doctor/stale-path.test.mjs` (new)
- `README.md`

## Steps

### Step 1: Local install doc

> **Plan-review checkpoint**

- [ ] Write `local-install.md` with git, pi install, npm link, troubleshooting (empty `spine` on PATH)
- [ ] README adoption pointer

### Step 2: Doctor stale PATH check

- [ ] Implement version/path comparison for global vs repo-local spine
- [ ] Doctor output includes `suggestedCommand` when stale

### Step 3: Tests + verification

- [ ] Add stale-path doctor tests
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Completion Criteria

- [ ] Local install doc complete
- [ ] Doctor warns on stale global spine
- [ ] Tests pass

## Must Update

- `README.md`
- `docs/adoption/real-project-readiness.md` — link local-install

## Do NOT

- Do not npm publish
- Do not change package name or version for publish

## Environment

- **Workspace:** pi-spine repo root
- **Tests:** `npm run typecheck && SPINE_WORKER_STUB=1 npm test`

## Git Commit Convention

Commit at step boundaries with task ID prefix, e.g. `feat(TP-043): local install doctor check`.

## Amendments

_(Workers: log scope issues here only — do not expand scope above the divider.)_
