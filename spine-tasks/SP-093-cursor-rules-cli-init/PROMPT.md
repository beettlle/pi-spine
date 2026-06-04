# Task: SP-093 — Cursor rules CLI + init sync

**Created:** 2026-06-04
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** `spine rules` CLI, init profile/manifest, doctor warnings.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1

## Mission

`spine rules discover|select|sync`; `spine init` copies rules-profile, runs discover, default `standards: []` (auto-discovery; non-empty **appends**). `spine doctor` warns missing/stale manifest. Manifest **committed to git**.

## Dependencies

- **Task:** SP-091 (select API)

## File Scope

- `bin/spine-rules.mjs`
- `bin/spine.mjs`
- `bin/spine-init.mjs`
- `bin/spine-doctor.mjs`
- `templates/spine-config.json`
- `templates/rules-profile.json`
- `tests/cli/spine-rules.test.mjs`
- `tests/cli/spine-init-rules.test.mjs`

## Steps

### Step 0: Preflight

- [ ] SP-091 complete

### Step 1: spine rules commands
> **Plan-review checkpoint**

- [ ] `discover [--json]`, `select --task`, `sync`
- [ ] `spine_review_step` after step

### Step 2: Init + doctor

- [ ] init copies profile; discover; `standards: []` default
- [ ] doctor RULES_MANIFEST_MISSING / STALE
- [ ] manifest not gitignored

### Step 3: Testing & Verification

- [ ] CLI tests + coverage ≥77%

### Step 4: Documentation & Delivery

- [ ] `spine rules --help`

## Git Commit Convention

- `feat(SP-093): complete Step N — description`

## Do NOT

- Change worker injection (SP-092)

---

## Amendments (Added During Execution)
