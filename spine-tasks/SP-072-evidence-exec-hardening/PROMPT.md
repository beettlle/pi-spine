# Task: SP-072 — Evidence command execution hardening

**Created:** 2026-06-03
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Gate evidence runs config-derived shell strings with `shell: true` — command-injection footgun if `.spine/spine-config.json` is tainted.
**Score:** 5/8 — Blast radius: 1, Pattern novelty: 1, Security: 2, Reversibility: 1

## Mission

Harden integrate-gate **evidence collection** so `testing.build` / `testing.test` commands from spine config cannot execute arbitrary shell. Replace `execFileSync(command, { shell: true })` with argv parsing, allowlisted executables, and rejection of shell metacharacters. Add negative tests for malicious config strings.

**Audit source:** `.cursor/rules/owasp-secure-coding-practices.mdc` §14; `critical-rules-quick-reference.mdc` §18.

## Dependencies

- **None**

## Context to Read First

**Tier 3:**
- `src/batch/evidence.mjs` — `runEvidenceCommand()`
- `bin/get-version.mjs` — secondary `shell: true` usage (fix if trivial)
- `tests/batch/evidence.test.mjs` (create or extend)
- `docs/PRD.md` — integrate gate / evidence bundle

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/batch/evidence.mjs`
- `src/batch/evidence-command.mjs` (new, if extracted)
- `bin/get-version.mjs`
- `tests/batch/evidence.test.mjs`

## Steps

### Step 0: Preflight

- [ ] Read `runEvidenceCommand()` and all call sites
- [ ] Inventory allowed project commands (`npm run …`, `node …`)

### Step 1: Safe command runner

> **Plan-review checkpoint**

- [ ] Parse config command strings into argv (no `shell: true`)
- [ ] Allowlist executables: `npm`, `node`, `pnpm`, `yarn`, `npx` (document extensibility)
- [ ] Reject shell metacharacters (`;`, `|`, `&`, `` ` ``, `$()`, redirects)
- [ ] Preserve timeout, maxBuffer, cwd behavior
- [ ] Call `spine_review_step` after this step (Review Level 2)

**Artifacts:**
- `src/batch/evidence.mjs` (modified)
- `src/batch/evidence-command.mjs` (new, optional)

### Step 2: Tests + get-version cleanup

> **Code review checkpoint**

- [ ] Tests: valid `npm run test` succeeds (stub/mock spawn)
- [ ] Tests: `npm test; rm -rf /` rejected
- [ ] Tests: unknown binary rejected
- [ ] Fix `bin/get-version.mjs` to use argv spawn when straightforward
- [ ] Call `spine_review_step` after this step

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage**
- [ ] Build passes: `npm run typecheck && npm test`

### Step 4: Documentation & Delivery

- [ ] Note security behavior in operator runbook if evidence section exists
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` — evidence command constraints (if section exists)

**Check If Affected:**
- `docs/PRD.md` — gate evidence FRs

## Completion Criteria

- [ ] No `shell: true` for config-derived evidence commands
- [ ] Malicious config strings fail closed with clear error
- [ ] All tests passing

## Git Commit Convention

- **Step completion:** `feat(SP-072): complete Step N — description`
- **Bug fixes:** `fix(SP-072): description`

## Do NOT

- Allow arbitrary shell passthrough “for flexibility”
- Skip negative security tests
- Modify unrelated batch engine logic

---

## Amendments (Added During Execution)
