# Real-project adoption plan (no npm publish)

**Goal:** Use pi-spine on an actual development repository — not only dogfood inside this repo with stub workers — without waiting for `npm publish` or pi.dev listing.

**Success criteria:**

1. A teammate can install pi-spine from a **git checkout or local path** and run `spine doctor` with no false positives.
2. A **fixture or pilot repo** completes init → plan → batch → gate → integrate → complete using documented commands.
3. At least one **stub-free** batch (`SPINE_WORKER_STUB=0`, real `pi -p` workers) is signed off with a written report.
4. Operator docs cover daily use: preflight, detached batches, land loop, recovery, Taskplane mutual exclusion.
5. Known v1.1 gaps (`createAgentSession`, journal rebuild) are tracked but do not block pilot.

**Explicitly out of scope (this phase):**

- npm publish, version bump execution, pi.dev listing
- Replacing Taskplane `/orch` in production repos before validation
- Full ncurses `/spine-settings` TUI

---

## Current baseline (2026-06-02)

| Area | State |
|------|--------|
| Phase 8 (TP-031–042) | Complete on `main` |
| Automated tests | ~772 tests with `SPINE_WORKER_STUB=1` (2026-06-12) |
| Real `pi` workers | `SPINE_WORKER_STUB=0`; Phase 6 manual checklist unchecked |
| Install story | README overview links to local-install; dev path is `pi install . -l` |
| Global `spine` CLI | May be stale; `node bin/spine.mjs` is reliable |

---

## Local install guide

Step-by-step install from git checkout, `pi install -l`, `npm link`, and PATH troubleshooting: **[local-install.md](./local-install.md)** (TP-043).

## Bootstrap checklist

Copy-paste greenfield and Taskplane-migration steps, plus the adoption fixture smoke target: **[bootstrap-checklist.md](./bootstrap-checklist.md)** (TP-044).

## Operator runbook

Daily procedures (preflight, land loop, gate races, recovery, dashboard, Taskplane coexistence): **[operator-runbook.md](./operator-runbook.md)** (TP-049).

---

## Adoption tiers

**Tier 0 — pi-spine repo:** `pi install . -l`, `node bin/spine.mjs doctor`, stub tests (see [local-install.md](./local-install.md)).

**Tier 1 — consumer stub:** `spine init`, `SPINE_WORKER_STUB=1 spine batch start <scope>`, land loop. Validate with `./scripts/adoption-smoke.sh` or the adoption fixture (see [bootstrap-checklist.md](./bootstrap-checklist.md)).

**Tier 2 — consumer real pi:** `SPINE_WORKER_STUB=0`, single-task batch, monitor dashboard.

**Tier 3 — daily operator:** detached batches, slash commands, recovery runbook.

---

## Phase 9 task map

| Wave | Tasks | Focus |
|------|-------|--------|
| A | TP-043, TP-045, TP-046 | Local install, coexistence guard, env overrides |
| B | TP-044 | Adoption fixture + bootstrap checklist |
| C | TP-047 | Stub-free dogfood sign-off |
| D | TP-048 | Real pi worker + reviewer E2E |
| E | TP-049 | Operator runbook |
| F | TP-050 | createAgentSession spike (v1.1) |

```
TP-043 ──► TP-044 ──► TP-047 ──► TP-048 ──► TP-049
TP-045 (after TP-043)
TP-046 (after TP-043)
TP-050 (after TP-048, optional)
```

---

## Pilot on your real dev project

After TP-049: install from git path, 1–2 small tasks, stub batch then real-pi batch, file issues for undocumented recovery.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Stale global `spine` | TP-043 doctor PATH check |
| Taskplane + spine active | TP-045 |
| Gate approve race | Retry; runbook TP-049 |
| Flaky worker-tools tests | Fix before pilot |

---

## v1.1+ (post-pilot)

Journal rebuild, merger agent, integrate dry-run polish, create-spine-tasks skill.
