# Task: SP-302 — README slim rewrite

**Created:** 2026-06-18
**Size:** M

## Review Level: 1 (Plan Only)

**Assessment:** High-visibility first-impression doc; structural rewrite with strict acceptance criteria.
**Score:** 2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0

## Canonical Task Folder

```
spine-tasks/SP-302-readme-slim-rewrite/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Rewrite root README to a Taskplane-style onboarding page (≤180 lines): short intro, "Inspired by" link to `docs/adoption/why-pi-spine.md`, numbered quickstart, commands-at-a-glance tables, one how-it-works diagram, and doc links. Remove operator manual content, Cursor rules table, PRD requirement IDs, and verbose Best-of-N section.

## Dependencies

- **Task:** SP-301 (`docs/adoption/why-pi-spine.md` must exist)

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/_explore/readme-trim/findings.md`
- `docs/adoption/why-pi-spine.md`
- `README.md` — rewrite target
- Taskplane README pattern: https://github.com/HenryLach/taskplane/blob/main/README.md

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `README.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `README.md` |

## Steps

### Step 0: Preflight

- [ ] Read findings.md and why-pi-spine.md
- [ ] Draft outline matching target structure (intro → features → inspired-by → limits → install → quickstart → commands → diagram → migrate → status → docs → license)

**Plan-review checkpoint**

### Step 1: Collapse intro and positioning

- [ ] Merge `## Why this exists` + `## What pi-spine is` into concise intro (≤15 lines)
- [ ] Replace `## Advantages over using the others directly` with one "Inspired by" paragraph + link to `docs/adoption/why-pi-spine.md`
- [ ] Keep trimmed `## Feature summary` (drop duplicate Best-of-N bullet or shorten to link)

### Step 2: Replace quickstart and remove depth

- [ ] Replace `## Quick start` (lines ~208–524) with Taskplane-style numbered flow:

```bash
pi install npm:pi-spine
cd my-project && spine init && spine doctor
spine preflight && spine plan all
spine batch start pending
spine status --diagnose
# when batch finishes: spine gate status → spine gate approve → spine integrate
```

- [ ] Add pi slash equivalents (`/spine-plan all`, `/spine pending`, `/spine-status`, `/spine-gate`, `/spine-integrate`)
- [ ] Add "Commands at a glance" — two small tables (CLI + pi slash), ≤20 rows total, link to `docs/QUICK-REFERENCE.md`
- [ ] Remove `### Cursor rules (contributors)` — one line link to `docs/design/cursor-rules-discovery.md`
- [ ] Trim `## Best-of-N` to 2–3 lines + script link (do not remove documentation entirely)
- [ ] Trim `## Honest limits` to ~8 lines; remove FR-SHIP-11 requirement ID
- [ ] Add one "How it works" flow diagram; link `docs/EXECUTION-FLOW-DIAGRAMS.md`
- [ ] Fix version label consistency with `package.json` (`1.0.2`)
- [ ] Strip all `FR-`, `GAP-`, `NFR-`, `§` references from README

### Step 3: Testing & Verification

- [ ] Run `wc -l README.md` — must be ≤180
- [ ] Run `rg 'FR-|GAP-|NFR-|§' README.md` — must return no matches
- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 4: Documentation & Delivery

- [ ] Spot-check README links resolve
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `README.md` — full slim rewrite

**Check If Affected:**
- None (SP-303/304 handle doc index sync)

## Completion Criteria

- [ ] README ≤180 lines
- [ ] Zero PRD requirement IDs in README
- [ ] Numbered quickstart present; operator depth removed
- [ ] Tests passing
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-302): complete Step N — description`
- `fix(SP-302): description`

## Do NOT

- Edit files outside `README.md`
- Delete Best-of-N documentation entirely (trim + link)
- Re-add comparison tables (they live in why-pi-spine.md)
- Skip line-count or grep acceptance checks

---

## Amendments (Added During Execution)
