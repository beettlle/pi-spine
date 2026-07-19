# Release manifest — v2.9.0

**Created:** 2026-07-18  
**Current version:** 2.8.0  
**Target version:** v2.9.0  
**Theme:** Named agent-model profiles + dashboard DAG + bugs  
**Bump type:** minor  
**Profile:** minor  
**Operator approved scope:** yes 

**Source:** GitHub issue intake.

Ceilings: skills/spine-release-operator/references/release-profiles.md

---

## Composition audit

| Bucket | Selected | Profile ceiling | Status |
|--------|----------|-----------------|--------|
| Documentation | 1 | 2-4 | PASS (under budget) |
| Bug fixes | 1 | 3–5 | PASS (under budget) |
| Enhancements | 2 | 1–2 allowed | PASS |
| **Total tasks** | **5** | ≤15 | PASS |

**Profile audit:** PASS 

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-663 | #215 | bug | S | Fix spine wait re-driving recovery | |
| SP-664 | #216 | enh | M | Named agent-model profiles | |
| SP-665 | #214 | enh | S | Show task title in dashboard | |
| SP-666 | #210 | doc | S | Runbook: hybrid worker/reviewer models | |
| SP-667 | — | doc | S | CONTEXT Phase 73 capstone | |

**Release scope ID:** `SP-663,SP-664,SP-665,SP-666,SP-667`

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #215 | bug | SP-663 | create-spine-tasks (lean) |
| #216 | enh | SP-664 | create-spine-tasks (lean) |
| #214 | enh | SP-665 | create-spine-tasks (lean) |
| #210 | doc | SP-666 | create-spine-tasks (lean) |
| Runbook / CONTEXT | doc | SP-667 | create-spine-tasks (lean) |

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] CI/release workflows succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
