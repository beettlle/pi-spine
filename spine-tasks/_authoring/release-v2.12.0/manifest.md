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
Spine plan — ids
4 task(s) · 2 wave(s) · maxParallel 4

Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-683 — Reconcile gate-pending needs_integrate
  Lane 2: SP-685 — Harden destroyGitRepo ENOTEMPTY teardown
  Lane 3: SP-686 — Coverage-safe metrics redaction test layout

Wave 1 · 1 task
  Lane 1: SP-684 — Wait/skill land-loop recipes after #221

Start: spine batch start SP-683,SP-684,SP-685,SP-686 --wave 0
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

- [x] All release-scoped tasks `.DONE` on `main` (SP-683–686)
- [x] Post-integrate `release:check` green after **each wave**
  - Wave 0: `/tmp/pi-spine-post-integrate-wave-0.log` (monitor exit 0; coverage ~89.11%)
  - Wave 1: `/tmp/pi-spine-post-integrate-wave-1.log` (monitor exit 0; coverage 89.09%)
- [x] `spine preflight` green (after second `spine batch complete` cleared leftover completed state)
- [x] `npm run release:check` green on final `HEAD` `0363a101` (typecheck, lint, tests, coverage — CI parity)
- [x] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`) — run `29969075636` succeeded on `de6f73d9`
- [x] `git status` clean
- [x] Operator approved publish bump type: **minor** (2.11.0 → 2.12.0)
- [x] `npm version minor` + `git push && git push --tags` — created commit `cd3dfd19`, tag `v2.12.0`
- [ ] `release.yml` succeeded (watching run `29969761072`)
- [ ] Post-publish smoke per `docs/release/npm-publish.md`

### Batches

| Wave | Batch | Tasks | Integrate |
|------|-------|-------|-----------|
| 0 | `20260722T184536` | SP-683, SP-685, SP-686 | orch → main |
| 1 | `20260722T211042` | SP-684 | orch → main (`0363a101`) |
