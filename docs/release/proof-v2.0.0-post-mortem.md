# v2.0.0 automation proof — post-mortem

**Epic:** Phase 62 — SP-AUTO (SP-543–551)  
**Published:** `pi-spine@2.0.0` (tag `aff1343d`)  
**Post-mortem date:** 2026-07-09

---

## Summary template

| Field | Value |
|-------|-------|
| Primary batch IDs | `20260709T044639` (wave 0), `20260709T045417` (wave 1), `20260709T051755` (wave 2), `20260709T053127` (wave 3) |
| Proof start (UTC) | 2026-07-09T04:46:39Z (`batch.started`, `20260709T044639`) |
| Proof end (UTC) | 2026-07-09T05:45:34Z (`batch.worktrees_cleaned`, `20260709T053127`) |
| Publish (UTC) | 2026-07-09T06:44Z (`npm version major` → tag `v2.0.0`) |
| Waves executed | 0–3 (4 batches; per-wave land loop) |
| Manifest scope ID | `SP-543,SP-544,SP-545,SP-546,SP-547,SP-548,SP-549,SP-550,SP-551` |
| Execution mode | Per-wave `spine batch start … --wave N` + gate/integrate/complete (not single `spine run sequence`) |
| Manual recovery count | **2** pause + **2** retry + **2** resume on wave 0 only (`GitignoredDirtyWorktree` on SP-544) |
| Open issues at proof start | 30 |
| Open issues at proof end (pre-tag) | 29 |
| Issue delta | **−1** (negative — M-AUTO-02 pass) |
| Issues closed in scope | #119, #134, #161, #144, #145 |
| Journal exports | [`proof-v2.0.0-journal-wave0.md`](proof-v2.0.0-journal-wave0.md) … [`wave3`](proof-v2.0.0-journal-wave3.md) |
| Engine post-mortems | `.spine/runtime/20260709T{044639,045417,051755,053127}/post-mortem.md` |
| Operator | Cursor release operator (batch waves); Cesar Delgado (publish approval) |

---

## Headline

**v2.0.0 automation proof shipped** with all nine manifest tasks integrated and published. **Gates-only attestation (M-AUTO-01) did not pass:** wave 0 required operator recovery after SP-544 failed with `GitignoredDirtyWorktree` (stet `.review/` gitignored artifacts). Waves 1–3 completed without pause/retry/resume.

---

## Wave scorecard

| Wave | Batch ID | Tasks | Succeeded | Failed | Manual recovery | Integrate merge |
|------|----------|-------|-----------|--------|-----------------|-----------------|
| 0 | `20260709T044639` | SP-543, SP-544 | 2 | 0 (after retry) | Yes — 2× pause/retry/resume | `040fe13b` |
| 1 | `20260709T045417` | SP-545–549 | 5 | 0 | No | `b7c31df4` |
| 2 | `20260709T051755` | SP-550 | 1 | 0 | No | `2c298095` |
| 3 | `20260709T053127` | SP-551 | 1 | 0 | No | `066d3f6f` |

**Post-wave operator fix (pre-tag):** `48709fea` — extract `heartbeat-subprocess.mjs` to satisfy phase23-exit ≤500 LOC after SP-548 landed.

**Tag commit:** `aff1343d` — `chore(release): v2.0.0`

---

## M-AUTO-01 — Gates-only execution (honest assessment)

| Criterion | Result | Evidence |
|-----------|--------|----------|
| One sequence session | **Partial** | Four detached batches, not one `spine run sequence` |
| Zero manual recovery | **Fail** | Wave 0 journal: `batch.paused`, `batch.retry_unblocked`, `batch.resumed` (×2) |
| Gate-only human touch | **Partial** | Gate approve on each wave + operator recovery on wave 0 |
| Journal clean | **Fail** | See [`proof-v2.0.0-journal-wave0.md`](proof-v2.0.0-journal-wave0.md) lines 29–40 |

**Root cause (wave 0):** SP-544 lane completed work (`.DONE`, commits on branch) but merge failed because gitignored stet artifacts (`.review/lock`, `.review/session.json`, `.review/spine-stet-baseline.ref`) remained in the lane worktree. Recovery: `git clean -fdX .review/` + `spine batch pause` → `spine batch retry SP-544` → `spine batch resume --force`.

**Follow-up:** File or link existing issue for stet gitignored merge friction; consider worktree hook cleanup (#185 adjacent).

---

## Issue delta table

| When | Open issue count | Notes |
|------|------------------|-------|
| Proof start | 30 | Recorded in [`manifest-v2.0.0-proof.md`](manifest-v2.0.0-proof.md) |
| Proof end (pre-tag) | 29 | After SP-546–549 closed #119, #134, #161, #144, #145 |
| **Delta** | **−1** | M-AUTO-02 **pass** |

---

## Verification gates (M-AUTO-03 / publish)

| Check | Result | Reference |
|-------|--------|-----------|
| `npm run release:check` on `48709fea` | Exit 0 | 89.21% line coverage |
| CI on `48709fea` | success | [run 28999068135](https://github.com/beettlle/pi-spine/actions/runs/28999068135) |
| `spine plan <manifest-scope>` | 9 tasks, all `.DONE` | 0 pending |
| Release workflow on `v2.0.0` | success | [run 28999465693](https://github.com/beettlle/pi-spine/actions/runs/28999465693) |
| npm publish | `pi-spine@2.0.0` | `npm view pi-spine version` → 2.0.0 |

---

## Manifest task outcomes

| Task | Status | Issue(s) |
|------|--------|----------|
| SP-543 | Done | — |
| SP-544 | Done | — |
| SP-545 | Done | — |
| SP-546 | Done | Closes #119 |
| SP-547 | Done | Closes #161 |
| SP-548 | Done | Closes #134 |
| SP-549 | Done | Closes #144, #145 |
| SP-550 | Done | — |
| SP-551 | Done | — |

---

## Artifacts delivered

| Artifact | Path |
|----------|------|
| Proof manifest | `docs/release/manifest-v2.0.0-proof.md` |
| Signoff checklist | `docs/release/automation-signoff-checklist.md` |
| Proof runbook | `docs/release/v2.0.0-proof-runbook.md` |
| Regression gate | `scripts/release-proof-gate.sh` |
| Journal wave 0 | `docs/release/proof-v2.0.0-journal-wave0.md` |
| Journal wave 1 | `docs/release/proof-v2.0.0-journal-wave1.md` |
| Journal wave 2 | `docs/release/proof-v2.0.0-journal-wave2.md` |
| Journal wave 3 | `docs/release/proof-v2.0.0-journal-wave3.md` |
| This post-mortem | `docs/release/proof-v2.0.0-post-mortem.md` |

---

## Lessons learned

1. **Stet + parallel lanes:** Gitignored `.review/` artifacts can block integrate even when task work succeeded; pre-merge `git clean -fdX .review/` should be documented in operator recovery (wave 0 cost ~12 min).
2. **Per-wave batches vs sequence:** Proof used four wave batches; M-AUTO-01 sequence semantics expect one `spine run sequence` — document waiver when using manual wave loop.
3. **LOC gate:** SP-548 subprocess work pushed `heartbeat.mjs` over 500 LOC; extract module before tag (caught by `release:check` / phase23-exit).
4. **Product outcome:** Despite M-AUTO-01 miss, all scope landed, issues decreased, and v2.0.0 published with green CI/release workflows.

---

_Generated from batch journals and engine post-mortems (FR-STA-32)._
