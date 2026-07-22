# Release manifest — v2.12.0

**Created:** 2026-07-22
**Current version:** 2.11.0
**Target version:** v2.12.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-22 — bugs_only)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 (SP-684 wait/skill docs for #221) | 2–4 | PASS (bug-adjacent docs only; no open `documentation` issues) |
| Bug fixes | 3 issues → 4 tasks (#221×2, #222, #223) | 3–5 | PASS |
| Enhancements | 0 | 1–2 | PASS with operator override (declined enhancement budget) |
| **Total tasks** | 4 | 10–15 | PASS |

**Profile audit:** PASS with operator override (enhancement budget unused by choice)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-683 | #221 | bug | S | Reconcile `needs_integrate` when gate pending | Partial #221 (engine) |
| SP-684 | #221 | doc/bug | S | Wait/skill land-loop recipes after diagnose fix | Closes #221 (docs) |
| SP-685 | #223 | bug | S | Harden temp-repo teardown (`destroyGitRepo`) | Closes #223 |
| SP-686 | #222 | bug | S | Coverage/layout guidance for metrics redaction tests | Closes #222 |

**Release scope ID:** `SP-683,SP-684,SP-685,SP-686`

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-683 SP-684 SP-685 SP-686
spine plan SP-683,SP-684,SP-685,SP-686
spine run sequence SP-683,SP-684,SP-685,SP-686 --dry-run
spine batch start SP-683,SP-684,SP-685,SP-686 --wave N   # detached
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #221 | bug | SP-683, SP-684 | create-spine-tasks (lean) |
| #223 | bug | SP-685 | create-spine-tasks (lean) |
| #222 | bug | SP-686 | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
(expected after authoring)
Wave 0: SP-683, SP-685, SP-686 (parallel — disjoint scopes)
Wave 1: SP-684 (depends on SP-683)
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #213 | enh | Operator declined enh budget this release |
| #212 | enh | MCP land-loop — larger than S; defer |
| #211 | enh | Outcome export — experimental P3 |
| #209 | enh | Light-path advisory — P3 |
| #135 | enh | Dashboard Mermaid DAG — large UI |
| #127 | enh | Mailbox steering — epic-ish |
| #124 | enh | Parallel wave strategies — large |
| #120 | enh | Journal checksums — deferred |
| #43 | epic | Monitoring toolkit epic |

---

## Risks and blockers

- #222 root cause (V8 coverage attribution) may remain tooling-side; packet scopes to layout guidance + keep asserts green, not a full V8 fix.
- #223 mitigations (`7dee5096`) already on main — packet closes remaining acceptance (shared teardown path + stress confidence).
- Dirty `AGENTS.md`/`CLAUDE.md` from gitnexus analyze stashed as `gitnexus index count hygiene` — restore/commit separately if desired; not in release scope.

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
