# Release manifest — v1.9.0

**Created:** 2026-07-07
**Current version:** 1.8.1
**Target version:** v1.9.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** no

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 | 2–4 | PASS |
| Bug fixes | 5 | 3–5 | PASS |
| Enhancements | 1 | 1–2 | PASS |
| **Total tasks** | 8 | 10–15 | PASS |

**Profile audit:** PASS

**Prior landed (included in epic, not in release scope):** SP-373, SP-374, SP-410–417, SP-478, SP-479, SP-521

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-522 | #187, #141 | bug | S | Validate npm test -- scope | Closes |
| SP-523 | #141 | doc | S | Skill scoped testCommand | Closes doc remainder |
| SP-524 | #143 | enh | S | Planner wave >8 warn | Closes |
| SP-525 | #142 | doc | S | Skill docs-only scope | Closes |
| SP-526 | #171 | bug | S | fileScope resume baseline | Closes |
| SP-527 | #159 | bug | S | Preflight stale fileScope redirect | Closes |
| SP-528 | #174 | bug | S | CI flutter-analyzer ubuntu | Closes |
| SP-529 | — | doc | S | CONTEXT Phase 60 capstone | — |

**Release scope ID:** `SP-522,SP-523,SP-524,SP-525,SP-526,SP-527,SP-528,SP-529`

---

## Wave plan snapshot

```text
Wave 0 parallel: SP-524, SP-525, SP-528
Wave 1: SP-522
Wave 2: SP-523
Wave 3 parallel: SP-526, SP-527
Wave 4: SP-529
```

Run `spine plan SP-522,SP-523,SP-524,SP-525,SP-526,SP-527,SP-528,SP-529` after validate for authoritative waves.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #175 | enh | release:check enforcement — v1.10.0 |
| #54 | enh | sequence release profile — v1.10.0 |
| #145–#150 | doc | skill template polish — v1.10.0 unless room |

---

## Risks and blockers

- SP-523 and SP-525 both touch `skills/create-spine-tasks/` — planner may serialize
- SP-521 already warns on generic `npm test` — SP-522 adds explicit `npm test --` detection
- Detached batch only — no `--attached` from Cursor shell (#163)

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
