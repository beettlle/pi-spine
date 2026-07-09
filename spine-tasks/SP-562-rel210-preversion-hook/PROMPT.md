# Task: SP-562 — preversion release:check hook

**Created:** 2026-07-09
**Size:** S

## Review Level: 1 (Plan Only)

**Assessment:** package.json lifecycle hardening for #175 option B.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 2

## Mission

Implement [#175](https://github.com/beettlle/pi-spine/issues/175) §B: add `preversion` script in `package.json` that runs `npm run release:check` and exits non-zero on failure. Document escape hatch (`npm version --no-git-tag-version`) in `docs/release/npm-publish.md`.

**Partial:** [#175](https://github.com/beettlle/pi-spine/issues/175) (SP-530 landed skill gate)

## Dependencies

- **Task:** SP-554

## File Scope

- `package.json`
- `docs/release/npm-publish.md`
- `tests/cli/preversion-hook.test.mjs`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/cli/preversion-hook.test.mjs` |
| fileScopeMustChange | `package.json` |

## Steps

### Step 0: Preflight

- [ ] Read issue #175 and SP-530 skill gate

### Step 1: preversion hook

- [ ] Add `"preversion": "npm run release:check"` to package.json scripts
- [ ] Ensure hook does not run on `npm version --no-git-tag-version` (npm behavior — document)

### Step 2: Docs + tests

- [ ] Update npm-publish.md with hook behavior and dry-run escape
- [ ] Test documents expected package.json script presence

### Step 3: Testing & Verification

- [ ] Run contract `testCommand`

### Step 4: Documentation & Delivery

- [ ] Comment on #175
- [ ] Create `.DONE`

## Completion Criteria

- [ ] `npm version` fails when release:check fails

## Git Commit Convention

- `feat(SP-562): preversion release:check hook`

## Do NOT

- Auto-run npm publish from hook
