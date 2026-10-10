# Release manifest — v2.27.1

**Created:** 2026-10-10
**Current version:** 2.27.0
**Target version:** v2.27.1
**Bump type:** patch
**Profile:** patch
**Operator approved scope:** no — awaiting operator approval (operator invocation 2026-10-10: "create the next v2.27 release … contain #334 … create the spine tasks and wait for approval before starting development"). Packets are authored; **Phase 4 is blocked until this line reads `yes`.**
**Composition choice:** #334 (reviewer extension isolation, P1) as the headline bug, split into 4 code packets plus 1 docs packet; #315 (rules-manifest churn that caused a v2.27.0 wave 2 merge conflict) and #314 (gate streak reset fails open, trust decision) as companion bugs.
**Worker model pin:** `zai/glm-5.3` via `agents.activeProfile=hard`; `agents.quotaFallbackProfile=allegretto` (`kimi-coding/k3`) is provider failover per #329, not escalation. Do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248)).
**Agent pin override:** none
**Extension override:** pending check before wave 1. The installed v2.27.0 engine still spawns reviewers with user extensions until SP-819 lands. Before wave 1, confirm pi-headroom is the patched local build and pi-loop is removed (v2.27.0 manifest: pi-loop still gave 1/2 `MALFORMED_FUNCTION_CALL`), then probe the reviewer with a parallel-tool-call prompt on `google/gemini-3.1-pro-preview` `high`.
**GitNexus:** refreshed 2026-10-10 — status up-to-date with HEAD (`c696025`)

---

## Context

- Current `main`: `2.27.0` @ `c696025` (v2.27.0 on npm)
- Pending SP-* before authoring: **0** (Next Task ID was **SP-819**; now **SP-826**)
- Open issues: **33**. 0 `documentation`. Bugs: #334 (P1), #331, #327, #319, #316, #315, #314, #313, #311, #310, #309, #294. Enhancements: #317, #318, #320–#323, #325, #326, plus P3 items. Epics: #324, #225, #43.
- `spine status --diagnose`: idle.

### Authoring constraints

- Top-level `src/batch/*.mjs` batch LOC limit is 500 (`src/config/preflight/loc-capstone.mjs`). At or near the cap: `integrate-worktree.mjs` 498, `engine-lanes.mjs` 498, `journal.mjs` 497, `review-step-run.mjs` 473. `engine-lanes/review-poll.mjs` is 496 (not counted by the policy, kept ≤500 anyway). SP-820 puts new logic in a new module; SP-823's edits to the two 498-line files are net-negative.
- SP-821 partly reverses SP-762 (#291): post-`.DONE` plan-review spawn failures currently route to `pending_lane_land` / salvage on purpose. #334 shows that salvage lands unreviewed code. `spine batch retry <id>` on a finished lane resumes at the review (`review.resumed`), so retry is the re-review path. The #331 caveat (post-hoc plan review can reject finished work) still applies.
- `pi -ne` disables discovered, configured, **and built-in** extensions (pi `docs/cli.md`). Reviewers use only core tools, so SP-819 isolates reviewers only. Worker isolation (#334 item 2) is deferred because workers need the spine worker tools.

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 (SP-825) | 1–2 small | PASS (0 doc issues open; SP-825 documents #334 operator-visible changes) |
| Bug fixes | 3 issues / 6 packets (#334 ×4 code, #315, #314) | 3–5 | PASS |
| Enhancements | 0 | 0 | PASS (SP-822's doctor check is acceptance criterion 5 of bug #334, not a separate enhancement) |
| **Total tasks** | 7 | 5–8 | PASS |
| Task sizes | all S | S only | PASS |
| Dep drift check recorded | yes | WARN if missing | PASS |

**Profile audit:** PASS

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@types/node` 22.20.4 → 26.6.5 (major); `typescript` 6.0.3 → 7.0.2 (major); `eslint` 10.11.0 → 10.12.0; `globals` 17.12.0 → 17.13.0; `typebox` 1.3.34 → 1.3.36 |
| `npm audit` highs/criticals | **0** (found 0 vulnerabilities) |
| Action | **deferred** — no security finding; toolchain majors are minor/major-profile only; same-major drift has no slot in a patch release |

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| typescript | 6.0.3 | 7.0.2 | defer (major; own release) |
| @types/node | 22.20.4 | 26.6.5 | defer (major) |
| eslint / globals | 10.11 / 17.12 | 10.12 / 17.13 | defer (same-major; patch has no enh slot) |
| typebox | 1.3.34 | 1.3.36 | defer (patch-level drift outside `^` wanted range; no slot) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #334 | bug P1 | SP-819, SP-820, SP-821, SP-822 (Partial), SP-825 (Closes) | bug + doc | **Select** — operator required; v2.27.0 lost hours to it |
| #315 | bug P2 | SP-823 (Closes) | bug | **Select** — test runs dirty the tree; caused the v2.27.0 wave 2 manifest merge conflict |
| #314 | bug P2 | SP-824 (Partial) | bug | **Select** — fail-closed + journaling; streak locking left open |
| #331 | bug P2 | — | bug | **Defer** — prompt/flow change for post-hoc plan review; M-sized; bug slot full |
| #294 | bug | — | bug | **Defer** — plan-review ordering (items 1–2) |
| #309–#311, #313, #316, #319, #327 | bug P2/P3 | — | bug | **Defer** — bug slot full |
| #317, #318, #320–#323, #325, #326 | enh P2 | — | enh | **Defer** — patch profile allows 0 enhancements |
| #324 | epic P1 | — | epic | **Defer** (tracking) |
| #225, #231, #212, #211, #209, #135, #127, #124, #43 | P3 | — | enh/epic | **Defer** |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-819 | #334 | bug | S | Reviewer spawns pass `pi -ne` by default; `agents.reviewer.loadUserExtensions` opt-out | Partial #334 (AC 1, 2, 6) |
| SP-820 | #334 | bug | S | Classify reviewer provider request errors (`*_review_provider_error`) | Partial #334 (AC 3) |
| SP-821 | #334 | bug | S | Diagnose recommends re-review, not salvage | Partial #334 (AC 4); deps SP-820 |
| SP-822 | #334 | bug | S | Doctor warns about context-rewriting pi extensions | Partial #334 (AC 5); deps SP-819 |
| SP-823 | #315 | bug | S | Idempotent rules manifest sync; drop deprecated merge wrapper | Closes #315 |
| SP-824 | #314 | bug | S | Gate streak reset failure fails closed and is journaled | Partial #314 (locking left open) |
| SP-825 | #334 | doc | S | Docs: reviewer isolation and re-review recovery | Closes #334; deps SP-819–SP-822 |

**Release scope ID:** `SP-819,SP-820,SP-821,SP-822,SP-823,SP-824,SP-825`

### Operator wave plan (explicit scope per wave)

| Wave | Scope | Rationale |
|------|-------|-----------|
| 1 | `SP-819,SP-820,SP-823,SP-824` | Independent, disjoint File Scope; 4 lanes |
| 2 | `SP-821,SP-822,SP-825` | SP-821 needs SP-820's exit reasons; SP-822 needs SP-819's key; SP-825 (docs) runs after both inside the batch |

Release waves 1–2 are operator labels. Start each with its task IDs only (`spine batch start <ids>`); each explicit scope plans its own internal waves.

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-819 SP-820 SP-821 SP-822 SP-823 SP-824 SP-825
spine preflight
spine batch start SP-819 SP-820 SP-823 SP-824    # detached — omit --attached (#163)
spine status --diagnose
spine gate approve && spine integrate && npm install && spine batch complete
npm run release:check 2>&1 | tee /tmp/pi-spine-v2.27.1-wave1.log; test "${PIPESTATUS[0]}" -eq 0
```

**Until SP-821 lands:** if a review spawn fails with `.DONE` in the lane, diagnose still suggests `salvage --integrate`. Do not salvage. Run `spine batch retry <id>` (resumes at the review) or a manual `spine review step --type final` in the lane worktree.

**Model pin policy ([#248](https://github.com/beettlle/pi-spine/issues/248)):** one worker pin (`hard`). Automatic quota fallback to `allegretto` is allowed (#329); paste the `Agent pin override` line from `spine status --diagnose` above when it fires.

---

## Gaps requiring new packets

All 7 packets are new (lean authoring, 2026-10-10).

---

## Wave plan snapshot

```text
Spine plan — ids
7 task(s) · 3 wave(s) · maxParallel 4

Wave 0 · 4 tasks · 4 lanes in parallel
  Lane 1: SP-819 — Reviewer spawns skip user pi extensions by default
  Lane 2: SP-820 — Classify reviewer provider request errors as `review_provider_error`
  Lane 3: SP-823 — `spine rules sync` and `npm test` stop rewriting `.spine/rules-manifest.json`
  Lane 4: SP-824 — Gate streak reset failure fails closed and is journaled

Wave 1 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-821 — Diagnose recommends re-review, not salvage, when a review never ran
  Lane 2: SP-822 — Doctor warns when context-rewriting pi extensions can reach reviewers

Wave 2 · 1 task
  Lane 1: SP-825 — Docs: reviewer extension isolation and review-failure recovery (v2.27.1)
```

`spine tasks validate`: 7 passed, 0 failed. `spine tasks analyze`: 0 blocking, 1 pre-existing warning (CONTEXT references a missing `_explore/engine-lanes-split/findings.md`).

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #334 item 2 (worker isolation) | follow-up | Workers need spine worker tools; needs `-ne -e <pi-spine extension>` investigation |
| #334 `spine doctor --probe-reviewer` | follow-up | Optional in the issue; spawns a model from doctor |
| #314 streak locking | bug remainder | Read-modify-write lock; left open on #314 |
| #331 | bug | Post-hoc plan review verdict; M-sized |
| #294, #309–#311, #313, #316, #319, #327 | bug | Bug slot full |
| #317, #318, #320–#323, #325, #326 | enh | Patch profile |
| TypeScript 7 / `@types/node` 26 | dep major | Own release |

---

## Risks and blockers

- Wave 1 still runs on the installed v2.27.0 engine, whose reviewers load user extensions. Re-check the extension set and probe the reviewer before starting (see Extension override above).
- SP-819 changes every reviewer spawn. If a reviewer needs a built-in pi extension that `-ne` disables, every review breaks. SP-819 Step 0 lists exact-args tests; post-integrate `release:check` and wave 2 reviews (which run on the new code only after `npm install` / relink) are the live check.
- SP-821 reverses SP-762's salvage routing. #291's complaint was that retry language forced a worker re-run; SP-821 Step 0 must confirm retry resumes at the review before changing anything.
- SP-823 touches two 498-line batch modules; edits must be net-negative.

---

## Publish checklist (Phase 5–6)

- [ ] Operator approved scope (set `Operator approved scope: yes` above)
- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD`
- [ ] CI green on `HEAD`
- [ ] `git status` clean
- [ ] Operator approved publish bump type: patch
- [ ] `npm version patch` + `git push && git push --tags`
- [ ] `release.yml` succeeded; staged package approved (2FA)
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [ ] #334, #315 closed; #314 progress comment (stays open)
