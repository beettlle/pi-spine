# SP-769: Document Actions majors — Status

**Current Step:** Step 2 — Testing & Verification
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-26
**Review Level:** 0
**Review Counter:** 0
**Iteration:** 0
**Size:** S

## Progress Checklist

### Step 0: Preflight
**Status:** ✅ Done

- [x] Confirm SP-768 pins
- [x] Note Wave A/B docs
- [x] Dependencies satisfied

### Step 1: Document Actions majors
**Status:** ✅ Done

- [x] Update npm-publish.md
- [x] Update QUICK-REFERENCE.md

### Step 2: Testing & Verification
**Status:** 🔄 In Progress

- [ ] Contract true + File Scope changed

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged
- [ ] Create `.DONE`

## Discoveries & Decisions

| Discovery | Decision |
|-----------|----------|
| SP-768 pins verified on disk: `checkout@v7` + `setup-node@v7` in all three workflows, `upload-artifact@v7` (ci.yml only), `github-script@v9` (release.yml only) | Document exact per-workflow usage, not a blanket claim |
| npm-publish.md already has `## Version floors` (Wave A) + `### Wave B toolchain` subsections from SP-757 | Add `### Wave C Actions majors` subsection in the same pattern |
| QUICK-REFERENCE.md has no CI/release section (command reference only) | Add short `## 🤖 CI / release Actions pins` section before Common Workflows; update Last updated footer |
| README.md has no hardcoded Actions versions (CI badge only) | No README change needed per PROMPT Check-If-Affected |

## Completion Criteria

- [ ] Docs list Actions v7 / github-script v9
- [ ] Closes #285

## Blockers

_None yet._
