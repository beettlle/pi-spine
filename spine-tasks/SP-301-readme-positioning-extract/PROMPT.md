# Task: SP-301 — README positioning extract

**Created:** 2026-06-18
**Size:** S

## Review Level: 0 (None)

**Assessment:** Docs-only; extract existing README comparison content to adoption doc.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0

## Canonical Task Folder

```
spine-tasks/SP-301-readme-positioning-extract/
├── PROMPT.md
├── STATUS.md
├── .reviews/
└── .DONE
```

## Mission

Move README `## Advantages over using the others directly` (vs Taskplane, Babysitter, pi-conductor) into a dedicated adoption doc so SP-302 can replace it with a one-paragraph "Inspired by" link. Preserve "When to stay on X" guidance and note pi-conductor archived status.

## Dependencies

- **Task:** SP-300 (findings.md section map)

## Context to Read First

**Tier 2:**
- `spine-tasks/CONTEXT.md`

**Tier 3:**
- `spine-tasks/_explore/readme-trim/findings.md`
- `README.md` — lines 41–99 source content
- `docs/README.md` — add nav entry

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/why-pi-spine.md`
- `docs/README.md`
- `docs/INDEX.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| artifactsMustExist | `docs/adoption/why-pi-spine.md` |

## Steps

### Step 0: Preflight

- [ ] Read SP-300 findings.md section map
- [ ] Confirm README comparison tables still at expected headings

### Step 1: Create positioning doc

- [ ] Create `docs/adoption/why-pi-spine.md` with: intro (compose don't merge), three comparison sections migrated from README, "When to stay on X" bullets, links to Taskplane / Babysitter / pi-conductor (note conductor archived)
- [ ] Add nav row in `docs/README.md` under Adoption / User Guides
- [ ] Add entry in `docs/INDEX.md` if adoption docs are indexed there

### Step 2: Testing & Verification

- [ ] Run FULL test suite: `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Verify all internal links resolve
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/why-pi-spine.md` — new
- `docs/README.md` — nav link
- `docs/INDEX.md` — index entry if applicable

**Check If Affected:**
- None

## Completion Criteria

- [ ] Positioning content lives in why-pi-spine.md (not README)
- [ ] Doc index links to new page
- [ ] Tests passing
- [ ] `.DONE` created

## Git Commit Convention

- `docs(SP-301): complete Step N — description`
- `fix(SP-301): description`

## Do NOT

- Edit `README.md` (SP-302 owns slim rewrite)
- Create other unsolicited markdown files
- Skip tests

---

## Amendments (Added During Execution)
