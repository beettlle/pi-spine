# Task: SP-255 — pi.dev package listing + post-publish doc sync

**Created:** 2026-06-16
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** Human-gated pi.dev submission plus adoption README/doc refresh after npm publish; no application code changes.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1

## Canonical Task Folder

```
spine-tasks/SP-255-pi-dev-package-listing/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

FR-SHIP-14 (phase 3): After **SP-226** publishes `pi-spine` to npm, submit the package to the **pi.dev package registry** so consumers can run `pi install npm:pi-spine`, and refresh adoption docs that still describe pre-publish / stub-era behavior (README slash-command table, test counts, local-install framing).

## Dependencies

- **Task:** SP-226 (npm publish executed with human approval; `pi-spine@1.0.0` or current release on npm)

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `docs/release/v1.0-checklist.md` — §pi.dev listing, §Post-publish smoke
- `docs/release/npm-publish.md` — post-publish checklist
- `docs/adoption/local-install.md` — pre-publish framing to update
- `README.md` — adoption section, slash commands, project status
- `extensions/spine/slash-commands.ts` — ground truth for implemented slash commands (`/spine-gate`, `/spine-integrate`)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** npm registry (package must exist); pi coding agent for smoke (`pi install npm:pi-spine`)

## File Scope

- `README.md`
- `docs/adoption/local-install.md`
- `docs/release/npm-publish.md`
- `docs/release/v1.0-checklist.md`
- `spine-tasks/CONTEXT.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| artifactsMustExist | `docs/release/v1.0-checklist.md` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-226 `.DONE` and npm package `pi-spine` is live (`npm view pi-spine version`)
- [ ] Obtain explicit human operator approval before pi.dev registry submission (if required by pi.dev workflow)
- [ ] Re-read `docs/release/v1.0-checklist.md` §pi.dev listing for field values

### Step 1: pi.dev package listing (human-gated)
> **Plan-review checkpoint**

- [ ] Submit or update pi-spine on pi.dev using checklist fields (name, description, keywords, `minPiVersion`, repository, extensions, skills)
- [ ] Record pi.dev package URL in `docs/release/v1.0-checklist.md` (new row or §Post-publish)
- [ ] Run post-listing smoke: `pi install npm:pi-spine` in a clean fixture or temp dir; confirm `/spine` and `spine --version` work

**Artifacts:**
- `docs/release/v1.0-checklist.md` (modified — pi.dev URL + checked post-publish items)

### Step 2: Adoption and README doc sync
> **Plan-review checkpoint**

- [ ] **README.md:** Replace "not on npm yet" / "pre-publish" adoption framing with published install paths (`pi install npm:pi-spine`, `npm install -g pi-spine`); keep local path install as secondary option
- [ ] **README.md:** Update slash-command table — `/spine-gate` and `/spine-integrate` are implemented (not stubs); remove or narrow "Most slash commands remain stubs" prose to match `extensions/spine/slash-commands.ts`
- [ ] **README.md:** Refresh project status (no longer "Early development / before v1.0" if v1.0.0 shipped); add FR-REV-08 reviewer-rules capability (`spine rules select --role reviewer`) if missing
- [ ] **README.md:** Update test/coverage figures to current baseline (re-run suite; do not copy stale 838-test / 85.92% figures)
- [ ] **docs/adoption/local-install.md:** Retitle/reframe — local path install remains valid but npm/pi.dev is the primary consumer path after publish
- [ ] **docs/release/npm-publish.md:** Check post-publish boxes; link pi.dev URL
- [ ] **spine-tasks/CONTEXT.md:** Mark Phase 26 complete; note SP-255 Done; set Next Task ID appropriately

**Artifacts:**
- `README.md` (modified)
- `docs/adoption/local-install.md` (modified)
- `docs/release/npm-publish.md` (modified)
- `spine-tasks/CONTEXT.md` (modified)

### Step 3: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Operator can install from pi.dev per recorded URL
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `README.md` — published adoption path, accurate slash-command status, current test baseline
- `docs/release/v1.0-checklist.md` — pi.dev URL and post-publish checkboxes
- `docs/release/npm-publish.md` — post-publish section
- `docs/adoption/local-install.md` — npm/pi.dev as primary path
- `spine-tasks/CONTEXT.md` — Phase 26 closure

**Check If Affected:**
- `docs/PRD.md` — ship milestone M6 if still says "when stable"
- `docs/adoption/bootstrap-checklist.md` — install command examples

## Completion Criteria

- [ ] pi-spine listed on pi.dev; URL recorded in release docs
- [ ] `pi install npm:pi-spine` smoke verified
- [ ] README and adoption docs no longer claim pre-publish-only status
- [ ] Slash-command documentation matches implementation
- [ ] All tests passing

## Git Commit Convention

- `feat(SP-255): complete Step N — description`
- `fix(SP-255): description`
- `docs(SP-255): description`

## Do NOT

- Run `npm publish` (SP-226 scope)
- Repeat pre-release dry-run checklist (SP-242 scope)
- Change application code unless required for doc accuracy (prefer docs-only)

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution. -->
