# Task: SP-089 — Cursor rules parser foundation

**Created:** 2026-06-04
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** New minimal YAML frontmatter parser and profile schema; bounded blast radius under `src/config/cursor-rules/`.
**Score:** 3/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 0

## Mission

Add the foundation for auto-discovery of `.cursor/rules/`: `micromatch` dependency, `parseCursorRuleFrontmatter()`, rules profile loader, and unit tests matching real `.mdc` layouts in this repo (array globs, comma-separated globs, `alwaysApply`, missing `globs`).

## Dependencies

- **None**

## Context to Read First

**Tier 3 (load only if needed):**
- `src/config/worker-context.mjs` — existing FR-WORK-05 byte cap and path safety (reuse `resolveContextDocPath` patterns)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `package.json`
- `package-lock.json`
- `src/config/cursor-rules/parse-frontmatter.mjs`
- `src/config/cursor-rules/profile.mjs`
- `src/config/cursor-rules/index.mjs`
- `tests/config/cursor-rules/parse-frontmatter.test.mjs`
- `tests/config/cursor-rules/profile.test.mjs`
- `tests/fixtures/cursor-rules/*`

## Steps

### Step 0: Preflight

- [ ] `npm test` passes on current `main`
- [ ] Read sample frontmatter in `.cursor/rules/general-llm-anti-patterns.mdc`, `taskplane-task-authoring.mdc`, `audit-workflow.mdc`

### Step 1: Parser + profile schema
> **Plan-review checkpoint**

- [ ] Add `micromatch` to `package.json` dependencies (used by SP-091; declare here)
- [ ] Implement `parseCursorRuleFrontmatter(content, relPath)` — fence `---`, minimal YAML for `alwaysApply`, `description`, `globs` (array | `[]` | comma-separated string)
- [ ] Implement `loadRulesProfile(projectRoot)` — reads `.spine/rules-profile.json`; built-in defaults when missing (`profileVersion: 1`, worker includes `taskplane-worker-cursor.mdc`, excludes `*-brutal-audit`, `audit-workflow`, `cursor-integration`, `taskplane/prompt-template.md`, `taskplane/status-template.md`)
- [ ] Export types/JSDoc from `src/config/cursor-rules/index.mjs`
- [ ] Fixture files under `tests/fixtures/cursor-rules/` covering all glob shapes
- [ ] Call `spine_review_step` after step

### Step 2: Tests

- [ ] Unit tests: `alwaysApply` coercion, comma-split globs, empty `globs`, missing frontmatter → `parseStatus: "skip"`
- [ ] Profile merge: `neverInclude` wins over `alwaysInclude`; invalid JSON fails with clear error code `RULES_PROFILE_INVALID`

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && npm test`
- [ ] Run coverage gate: `npm run coverage:check` — **≥77% line coverage** on new modules
- [ ] Build passes: `npm run typecheck && npm test`

### Step 4: Documentation & Delivery

- [ ] Log API shapes in STATUS Discoveries for SP-090 consumer
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- None (design doc lands in SP-094)

**Check If Affected:**
- `docs/PRD.md` — only if FR-WORK-05 section needs a one-line cross-ref (optional)

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Parser + profile modules exported and tested

## Git Commit Convention

- `feat(SP-089): complete Step N — description`

## Do NOT

- Implement directory walk / `discoverCursorRules` (SP-090)
- Inject rules into worker prompts (SP-092)
- Add `spine rules` CLI (SP-093)

---

## Amendments (Added During Execution)
