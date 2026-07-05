# Release manifest — v{TARGET_VERSION}

**Created:** {YYYY-MM-DD}
**Current version:** {from package.json}
**Target version:** v{TARGET_VERSION}
**Bump type:** patch | minor | major
**Profile:** patch | minor | major
**Operator approved scope:** no | yes ({date})

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | {n} | {profile limit} | PASS / WARN |
| Bug fixes | {n} | 3–5 | PASS / WARN |
| Enhancements | {n} | {profile limit} | PASS / WARN |
| **Total tasks** | {n} | {profile cap} | PASS / WARN |

**Profile audit:** PASS | PASS with operator override | FAIL (do not proceed)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-### | #NNN | doc / bug / enh | S/M | … | Closes / Partial |

**Release scope ID:** comma-separated SP-IDs for `spine plan` / `spine batch start` (e.g. `SP-483,SP-460,SP-438`)

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #90 | doc | SP-### | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
(paste output of: spine plan <release-scope>)
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| SP-### / #NNN | enh | Exceeds patch profile; defer to v1.6.0 |
| #117 | epic | v2.3 module split — out of minor scope |

---

## Risks and blockers

- {e.g. 7 M-sized tasks in full pending plan — release scope excludes them}
- {e.g. #156 release CI gate — separate enhancement}

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: patch | minor | major
- [ ] `npm version <bump>` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
