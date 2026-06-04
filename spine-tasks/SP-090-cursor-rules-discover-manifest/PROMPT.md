# Task: SP-090 — Cursor rules discover + manifest

**Created:** 2026-06-04
**Size:** M

## Review Level: 2 (Plan + Code)

**Assessment:** Recursive scan of `.cursor/rules/`, manifest generation, and profile-driven exclusions; touches read paths only until SP-092.
**Score:** 4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1

## Mission

Implement `discoverCursorRules()` to scan `.cursor/rules/**/*.{mdc,md}`, classify each rule (`always` | `glob` | `manual` | `excluded`), and write **`.spine/rules-manifest.json`** (committed to git per product decision). Ship `templates/rules-profile.json` for `spine init` to copy.

## Dependencies

- **Task:** SP-089 (parser + profile)

## Context to Read First

**Tier 2 (area context):**
- `spine-tasks/SP-089-cursor-rules-parser-foundation/STATUS.md` — Discoveries (if complete)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `src/config/cursor-rules/discover.mjs`
- `src/config/cursor-rules/index.mjs`
- `templates/rules-profile.json`
- `tests/config/cursor-rules/discover.test.mjs`
- `.spine/rules-manifest.json` (generated; **commit to git**)
- `.gitignore` (ensure manifest is **not** ignored)

## Steps

### Step 0: Preflight

- [ ] SP-089 merged or available on branch
- [ ] `.cursor/rules/` present in repo

### Step 1: Discovery engine
> **Plan-review checkpoint**

- [ ] `discoverCursorRules({ projectRoot, profile, writeManifest })` — max 200 files, 512 KiB per file, posix `relPath`
- [ ] Apply `profile.discovery.excludePatterns` / `excludeRelPaths` via micromatch
- [ ] `spineClass` classification per design (alwaysApply → `always`; non-empty globs → `glob`; else `manual`)
- [ ] Atomic write `.spine/rules-manifest.json` with `generatedAt`, `rulesRoot`, `rules[]`, `excluded[]`
- [ ] `spine_review_step` after step

### Step 2: Init template + pi-spine manifest
> **Code review checkpoint**

- [ ] Add `templates/rules-profile.json` (worker includes `taskplane-worker-cursor.mdc`; `globMatch: true`; manifest committed)
- [ ] Run discover on pi-spine; commit `.spine/rules-manifest.json`
- [ ] Confirm `.spine/rules-manifest.json` is tracked (not in `.gitignore`)
- [ ] `spine_review_step` after step

### Step 3: Testing & Verification

- [ ] Tests: empty rules root, excluded brutal-audit, parse warn entries, manifest round-trip
- [ ] FULL suite + `npm run coverage:check` ≥77%

### Step 4: Documentation & Delivery

- [ ] STATUS Discoveries: manifest field list for SP-091/093

## Documentation Requirements

**Must Update:**
- None

**Check If Affected:**
- `templates/spine-config.json` — comment that `standards: []` triggers auto-discovery (SP-093)

## Completion Criteria

- [ ] `discoverCursorRules` tested
- [ ] `.spine/rules-manifest.json` committed in pi-spine

## Git Commit Convention

- `feat(SP-090): complete Step N — description`

## Do NOT

- Glob-match against task File Scope (SP-091)
- Wire worker injection (SP-092)

---

## Amendments (Added During Execution)
