# Release manifest — v2.10.0

**Created:** 2026-07-19
**Current version:** 2.9.0
**Target version:** v2.10.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-19)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 | 2–4 | WARN — below target; bundled with feature tasks |
| Bug fixes | 1 | 3–5 | WARN — only one open bug surfaced; operator override required |
| Enhancements | 4 | 1–2 | WARN — operator explicitly requested #217 + #218; override required |
| **Total tasks** | 6 | 10–15 | PASS |

**Profile audit:** PASS with operator override (bug count <3, doc count <2, enhancement count >2 all justified by available open issues and operator request)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-668 | #219 | bug | S | Auto-stage untracked files before contract verify | Closes #219 |
| SP-669 | #217 | enh | M | Parse Matrix section from PROMPT.md and expand in planner | Closes #217 |
| SP-670 | #217 | enh | S | Substitute matrix variables in contract and steps | Closes #217 |
| SP-671 | #217 | enh | M | Execute matrix sub-lanes in parallel worktrees | Closes #217 |
| SP-672 | #218 | enh | M | Execution-only task type in PROMPT frontmatter | Closes #218 (matrix handled by #217) |
| SP-673 | #217, #218 | doc | S | Document parametric matrix and execution-only tasks in operator runbook | Partial #217/#218 docs |

**Release scope ID:** `SP-668,SP-669,SP-670,SP-671,SP-672,SP-673`

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-668 SP-669 SP-670 SP-671 SP-672 SP-673
spine plan SP-668,SP-669,SP-670,SP-671,SP-672,SP-673
spine run sequence SP-668,SP-669,SP-670,SP-671,SP-672,SP-673 --dry-run
```

Regression gate after each integrate:

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE}.log
test "${PIPESTATUS[0]}" -eq 0
```

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #219 | bug | SP-668 | create-spine-tasks (lean) |
| #217 | enh | SP-669, SP-670, SP-671 | create-spine-tasks (lean) |
| #218 | enh | SP-672 | create-spine-tasks (lean) |
| #217/#218 docs | doc | SP-673 | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
Spine plan — ids
6 task(s) · 5 wave(s) · maxParallel 4

Wave 0 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-668 — Auto-stage untracked files before contract verify
  Lane 2: SP-672 — Execution-only task type in PROMPT frontmatter

Wave 1 · 1 task
  Lane 1: SP-669 — Parse Matrix section from PROMPT.md and expand in planner

Wave 2 · 1 task
  Lane 1: SP-670 — Substitute matrix variables in contract and steps

Wave 3 · 1 task
  Lane 1: SP-671 — Execute matrix sub-lanes in parallel worktrees

Wave 4 · 1 task
  Lane 1: SP-673 — Document parametric matrix and execution-only tasks in operator runbook

Start: spine batch start ids --wave 0
Then (after each wave lands):
  Wave 1: spine batch start ids --wave 1
  Wave 2: spine batch start ids --wave 2
  Wave 3: spine batch start ids --wave 3
  Wave 4: spine batch start ids --wave 4
```
---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #213 | enh | Out of minor scope; parser hardening not user-visible |
| #212 | enh | MCP tools for operator land-loop — deferred |
| #211 | enh | Metrics export for authoring — experimental |
| #209 | enh | Review level light-path — P3 |
| #208 | enh | Token/cost rollups — P2, out of scope |
| #160 | enh | Gate evidence external tool integration — P3 |
| #135 | enh | Dashboard task DAG — out of scope |
| #127 | enh | File mailbox steering — out of scope |
| #124 | enh | Parallel wave strategies — out of scope |
| #120 | enh | Journal SHA-256/atomic writes — out of scope |
| #43 | epic | Operator monitoring toolkit — epic, out of scope |
| #218 (per-task model overrides) | enh | Proposed solution 3; matrix + execution-only covers the problem; model override deferred to next release |

---

## Risks and blockers

- Only one open bug (#219) matches the `bug` label; release profile audit requires operator override for bug count <3.
- Matrix task execution touches planner, engine, and contract verification; must be serialized into multiple waves to avoid worktree collisions.
- Execution-only tasks require worker spawn path changes to bypass the LLM while keeping lane isolation and contract verification.
- Release includes >2 enhancements, exceeding minor profile default; override justified by explicit operator request.

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
