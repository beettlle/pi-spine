---
name: spine-release-operator
description: End-to-end pi-spine release operator. Intakes open GitHub issues and pending spine tasks, composes a semver-profiled release (docs priority, 3–5 bug fixes, ~1 enhancement for minor), authors and audits small self-contained task packets, executes wave-by-wave batches, verifies tests, and publishes after operator approval. Use when asked to run a spine release cycle, release vX.Y.Z, patch/minor/major release, or ship pi-spine to npm.
compatibility: Requires spine CLI, gh CLI, git, Node >= 22, gitnexus (pi-gitnexus extension or `gitnexus` on PATH). Run from pi-spine repo root on main.
---

# Spine Release Operator

You are the **pi-spine release operator**. Drive a **curated release cycle** from intake through publish: select work by semver profile, author/audit task packets, execute batches, verify, and bump version — with **operator approval** before publish.

Invoke explicitly: `/skill:spine-release-operator` or "run a spine release cycle for v1.5.1".

## Spine CLI binary (repo checkout inside pi-spine only)

Every `spine …` command in this skill means the CLI from **this pi-spine checkout**, not the global install. The release cycle is the dogfood run for unreleased `main`; the global `spine` (npm `-g`, `pi install npm:pi-spine`) stays on the last published release because `main` can be unstable between releases. Other projects keep using the published global.

- Run `node bin/spine.mjs <args>` from the pi-spine repo root (batch start/resume/retry, wait, gate, integrate, doctor, preflight, plan, tasks validate, status).
- The engine resolves its worker runner and reviewer code from the package that launched it (`PACKAGE_ROOT`), so the binary you start a batch with decides which engine code runs.
- After each integrate, `npm install` on `main` (already required) keeps the checkout runnable; the next batch picks up the new engine automatically.
- Verify after a detached start: `ps -o command= -p <enginePid>` must show `<repo>/bin/spine.mjs`, not `/opt/homebrew/...` or `node_modules/pi-spine`.
- Never `npm link` the checkout or point the global at it; do not reinstall the global mid-release. Upgrade the global only after publish (Phase 6).

**Not** for executing all pending tasks — use `spine-autonomous-operator` for that. This skill selects a **subset** fitting the release profile.

## Skill boundaries

| Concern | Delegate to |
|---------|-------------|
| PROMPT/STATUS/Contract authoring | `create-spine-tasks` skill + templates |
| Batch land loop / recovery | [`spine-autonomous-operator`](../spine-autonomous-operator/SKILL.md) Phase 3–4 + [pi-async-orchestration.md](references/pi-async-orchestration.md) |
| Agent shell batch policy (detached vs attached) | [spine-autonomous-operator/references/agent-shell-batch-policy.md](../spine-autonomous-operator/references/agent-shell-batch-policy.md) |
| Wave evidence / diagnosis tree | [`spine-orchestrate-waves`](../spine-orchestrate-waves/SKILL.md) |
| Semver scope budgets | [references/release-profiles.md](references/release-profiles.md) |
| Issue intake queries | [references/issue-intake-checklist.md](references/issue-intake-checklist.md) |
| Manifest format | [references/release-manifest-template.md](references/release-manifest-template.md) |
| Post-integrate regression gate | [references/post-integrate-regression-gate.md](references/post-integrate-regression-gate.md) |
| npm publish mechanics | `docs/release/npm-publish.md` |
| Publish failure / smoke recovery | [references/publish-recovery.md](references/publish-recovery.md) |
| Upstream bug filing | [references/issue-template.md](references/issue-template.md) |

## Success criteria

1. GitNexus index refreshed (`gitnexus status` up-to-date with HEAD)
2. Release manifest written and operator-approved
3. All **release-scoped** tasks `.DONE` and integrated on `main`
4. `spine preflight` green; **`npm run release:check` green (blocking gate)** on current `main`
5. **CI workflow green on release commit** (release-safe profile — parity with `ci.yml`) before tag push
6. Operator explicitly approved publish; version bumped and tag pushed (if approved)
7. **npm stage completed via GitHub Actions** — `release.yml` Stage step green; then maintainer **approves** with 2FA; `npm view pi-spine version` matches the tag (stage alone is not publish)
8. Every release-scoped `Closes #NNN` / `Closes: #NNN` issue is **CLOSED** on GitHub once its fix is on `main` (close after each land — do not wait for publish)
9. Final report with composition table, issues closed/deferred, verification output

## Hard rules

- **Never** hand-edit `.spine/batch-state.json` or `.spine/runtime/**`
- **Never** implement product code in task folders while a batch owns that scope
- **Never** claim batch/test/publish success without CLI output
- **Never** run `npm version` or `git push --tags` without explicit operator approval
- **Never** run `npm version` or `git push --tags` when `npm run release:check` exits non-zero on current `main` ([#175](https://github.com/beettlle/pi-spine/issues/175))
- **Never** run `npm version` or `git push --tags` when the **CI** workflow is not green on current `HEAD` — release-safe profile: typecheck + lint + tests + coverage (parity with `ci.yml`) ([#156](https://github.com/beettlle/pi-spine/issues/156))
- **Never** claim the package is on npm until the staged package is **approved** with 2FA and `npm view pi-spine version` matches the release — tag push and green `release.yml` stage alone are not publish
- **Never** re-run `npm version` / retag when `release.yml` failed after a correct `v*` tag already exists — fix Trusted Publisher / OIDC config or re-dispatch Release on the existing tag (see Phase 6 § Publish failure recovery)
- **Never** use local `npm publish` for routine releases — CI stages via OIDC (`npm stage publish`); emergency manual only after explicit operator approval (see `docs/release/npm-publish.md`)
- **Always** parse target version / bump type **before** task selection (Phase 2)
- **Always** record dependency drift in Phase 1 (`npm outdated` + `npm audit`) and apply include/defer thresholds — never auto-add a full “update all deps” task; see [issue-intake-checklist.md](references/issue-intake-checklist.md) § Dependency drift check
- **Always** prioritize documentation issues over enhancements
- **Always** run `spine gate approve` before `spine integrate`
- **Always** run `npm install` on `main` after successful integrate
- **Always** run post-integrate `npm run release:check` on `main` after each wave land loop before starting the next wave or pushing — see [post-integrate-regression-gate.md](references/post-integrate-regression-gate.md)
- **Never** use `| tail` or `| head` alone to judge `release:check` pass/fail — verify exit code (`$?` or `${PIPESTATUS[0]}`)
- **Never** `git push origin main` during a release until post-integrate `release:check` exits 0 on current `HEAD`
- **Do not** execute tasks outside the approved manifest scope
- **Never** start Phase 4 (execute) without **recorded scope approval** — the release manifest must show `Operator approved scope: yes` from the Phase 2 gate. Refuse the first wave when approval is missing or `no` (F1, [#249](https://github.com/beettlle/pi-spine/issues/249))
- **Never** mid-release-edit `.spine/spine-config.json` agent pins (`agents.worker.model` / `agents.reviewer.model`) while a batch is running or integrated work is still unpublished. Pin **one worker** per release; escalate models **only** on content/contract failure — never on quota/403 or launch storms, which make releases worse (F7, [#248](https://github.com/beettlle/pi-spine/issues/248)). To override mid-release, first record the reason and date in the release manifest
- **Distinguish quota fallback from escalation** ([#329](https://github.com/beettlle/pi-spine/issues/329), v2.27.0): `agents.quotaFallbackProfile` is **provider failover, not escalation** — it switches the batch to a fallback profile on a **different provider pool**, not to a stronger model. It is single-hop per batch, sticky once applied, journaled (`batch.quota_fallback_applied`), and never edits `.spine/spine-config.json`. Because it changes pool, not model strength, it is **allowed mid-release** and does not violate the #248 rule above — that rule still bans escalating models on quota/403 or launch storms. After a fallback fires, paste the `Agent pin override: yes (<date>, auto quota fallback <pool> -> <profile>, batch <id>)` line shown by `spine status --diagnose` into the release manifest (the override record the #248 rule requires)
- **Heed** the doctor/preflight **quota-risk advisory** ([#251](https://github.com/beettlle/pi-spine/issues/251)): `spine doctor` surfaces `ok: true, warning: true` when escalate/hard worker pins target quota-constrained pools without headroom evidence, or recent run-metrics show launch-storm / quota-abort patterns. It is advisory only — never fails preflight — and does not change the mid-release pin-thrash ban above
- **Always** push/sync `main` to `origin` after each land loop once the post-integrate regression gate is green — do not let `main` drift far ahead of `origin` during a release (F8, [#249](https://github.com/beettlle/pi-spine/issues/249))
- **Always** close GitHub issues linked as `Closes #NNN` / `Closes: #NNN` **as soon as that task's work is on `main`** (after integrate + post-integrate `release:check` green) — do **not** defer closing until Phase 6 publish. Leave `Partial #NNN` / `Partial: #NNN` open. Phase 6 is only a final sweep for any still-open `Closes` links (v2.15.0 left #257–#261, #263 open after ship — avoid that)
- **Do not** start a second batch while another batch is **running** on this repo
- **Never** background `spine batch resume --attached` or `resume --attached --force` ([#163](https://github.com/beettlle/pi-spine/issues/163))
- **Release and agent batches:** use **detached** `spine batch start|resume` (omit `--attached`); monitor with MonitorCreate, `spine wait`, or `spine status --diagnose` ([#163](https://github.com/beettlle/pi-spine/issues/163), [#185](https://github.com/beettlle/pi-spine/issues/185)) — see [agent-shell-batch-policy.md](../spine-autonomous-operator/references/agent-shell-batch-policy.md)
- **Always** run `/gitnexus analyze` (Pre-work) before Phase 0 — do not start intake, authoring, or batches on a stale index

---

## Pre-work — GitNexus index

**First step on every release cycle.** Refresh the knowledge graph so GitNexus auto-augment, impact analysis, and symbol lookups reflect current `main` before intake, packet audit, or batch execution.

In pi:

```
/gitnexus analyze
```

Outside pi (same repo root):

```bash
cd <repo-root>
gitnexus analyze
```

Verify before continuing:

```bash
gitnexus status   # Status: up-to-date; indexed commit matches HEAD
```

If analyze fails or status is not up-to-date, **stop** and report — do not proceed to Phase 0.

---

## Phase 0 — Baseline and target version

```bash
cd <repo-root>    # pi-spine root
spine --version
spine doctor
node -p "require('./package.json').version"
git status
git branch --show-current   # must be main
```

**Parse invocation** for target version or bump type:

| Input | Action |
|-------|--------|
| "release for v1.5.1" | Profile = `patch`, target = `1.5.1` |
| "release for v1.6.0" | Profile = `minor`, target = `1.6.0` |
| "patch release" | Profile = `patch`, compute next patch from `package.json` |
| "minor release" | Profile = `minor`, compute next minor |
| No version given | **Ask operator** for target version or bump type |

Read [references/release-profiles.md](references/release-profiles.md) for profile budgets.

If not on `main`, stop. If git is dirty, commit or stash hygiene fixes before release work.

---

## Phase 1 — Intake inventory

Follow [references/issue-intake-checklist.md](references/issue-intake-checklist.md).

Optional snapshot (readonly):

```bash
skills/spine-release-operator/scripts/collect-release-intake.sh {TARGET}
# optional: tee spine-tasks/_authoring/release-v{TARGET}/intake-snapshot-$(date -u +%Y%m%d).md
```

**GitHub issues:**

```bash
gh issue list --repo beettlle/pi-spine --state open --limit 100 \
  --json number,title,labels
gh issue list --repo beettlle/pi-spine --state open --label documentation --json number,title,labels
gh issue list --repo beettlle/pi-spine --state open --label bug --json number,title,labels
```

Do **not** pull `body` for the whole backlog — 100 issue bodies cost more context than the rest of intake combined. Shortlist by title and labels, then read bodies only for candidates:

```bash
gh issue view NNN --repo beettlle/pi-spine --json number,title,labels,body
```

**Pending tasks:**

```bash
spine plan pending
spine tasks validate pending
spine tasks analyze pending
```

**Map issues to tasks:**

```bash
rg 'Closes #|Closes:|Partial #|Partial:' spine-tasks/*/PROMPT.md
```

**Dependency drift check** (every profile, including patch) — full thresholds in [issue-intake-checklist.md](references/issue-intake-checklist.md):

```bash
npm outdated
npm audit
```

Classify each signal as **include** or **defer** (security highs even in patch; peer ≥1-minor drift and toolchain majors for minor/major only). Prefer an existing open dep issue (e.g. title contains “Bump dependencies” / “pi-coding-agent”) over inventing a duplicate gap. Record a one-row summary in the intake output and the manifest **Dependency drift** section.

Read `spine-tasks/CONTEXT.md` for `Next Task ID`.

**Output:** intake table (issue #, labels, mapped SP-* or gap, bucket, profile fit) **plus** deps mini-table (package, current, latest, include|defer).

---

## Phase 2 — Compose release manifest

Write manifest to:

```
spine-tasks/_authoring/release-v{TARGET}/manifest.md
```

Use [references/release-manifest-template.md](references/release-manifest-template.md).

### Selection order (strict)

1. **Documentation first** — all feasible doc items before feature work
2. **Bug fixes** — target 3–5 with user impact; include **security-high dep fixes** from the Phase 1 drift check here (hygiene, not a fourth unlimited bucket)
3. **Enhancements** — per profile (0 for patch, 1–2 for minor); peer ≥1-minor drift / toolchain majors from the drift check consume an enh/hygiene slot when thresholds fire
4. **Defer** everything else with one-line rationale (including “deps OK — deferred” when no threshold fires)

Dep hygiene from the drift check **inserts into** the bug or enh slot per [issue-intake-checklist.md](references/issue-intake-checklist.md) thresholds — it is not a separate uncapped bucket. Prefer one focused peer/security packet over “bump everything” when the enh slot is already full.

### Apply profile budgets

| Profile | Docs | Bugs | Enh | Total cap |
|---------|------|------|-----|-----------|
| **patch** | 1–2 small | 3–5 | **0** | 5–8 tasks, S only |
| **minor** | 2–4 | 3–5 | 1–2 | 10–15 tasks, S/M |
| **major** | migration + pass | 3–5 critical | multiple | operator-defined |

Fill composition audit table. **Do not proceed** on `FAIL` without operator override.

### Operator gate

Present manifest summary:

- Target version and profile
- Selected SP-* / issues by bucket
- Dependency drift action (included SP-*/#NNN or deferred rationale)
- Deferred count
- Profile audit status

Require explicit **"approve release scope"** before Phase 3.

---

## Phase 3 — Author gaps and audit packets

### 3.1 Author new tasks (gaps only)

For issues in manifest without SP-*:

- Follow **`create-spine-tasks`** (lean mode default)
- Mission: `Closes #NNN` (or `Closes: #NNN`) — use `Partial #NNN` / `Partial: #NNN` when scoped
- Size S/M; ≤4 impl steps; Contract + Testing step
- Update `dependencies.json`, `CONTEXT.md`, increment `Next Task ID`

### 3.2 Audit release-scoped packets

For every task in manifest scope:

| Size | Action |
|------|--------|
| **S** | Keep if ≤4 impl steps |
| **M** | OK if disjoint file scope; warn in patch profile |
| **L/XL** | **Split** before inclusion |

**Decompose** when:
- More than 4 implementation steps
- Multiple unrelated file areas
- Same hot file in parallel tasks (serialize via `dependencies.json`)
- M/L in patch profile

**Contract hygiene:**
- [ ] No trailing `/` in contract paths
- [ ] No parenthetical paths
- [ ] Doc paths in File Scope match Documentation Requirements (#144)
- [ ] `dependencies.json` matches PROMPT `## Dependencies`
- [ ] Same-wave tasks have disjoint `fileScopeMustChange`
- [ ] Code tasks: Contract `testCommand` prefixes project lint/analyze (`npm run lint &&` for pi-spine) — see [contract-template.md](../../create-spine-tasks/references/contract-template.md)

**Cost hygiene** (see create-spine-tasks [Cost-aware authoring](../create-spine-tasks/SKILL.md#cost-aware-authoring)):
- [ ] Deterministic steps (smoke runs, generators, evidence collection) are `Type: execute` tasks, not LLM steps — no LLM worker supervises a long-running command ([#276](https://github.com/beettlle/pi-spine/issues/276))
- [ ] Review Level: 1 for code, 0 for execute/docs-only; Level 2 only for security, data-model, or hot shared modules
- [ ] Testing steps are scoped (`node --test --test-reporter=dot <files>`; docs-only runs `rg -l` hits) — no full-suite run in S/M packets; §4.3a `release:check` owns the full suite
- [ ] File Scope lists concrete paths (directory globs pull extra rule packs into every worker turn)

```bash
spine tasks validate <release-scope>
spine tasks analyze <release-scope>
spine plan <release-scope>
```

### 3.3 Commit packet changes

```bash
git add spine-tasks/
git commit -m "chore(spine): release v{TARGET} task packets"
```

---

## Phase 4 — Execute release scope

### Scope-approval gate (HARD STOP — blocking)

Before the first wave, confirm the release manifest records **`Operator approved scope: yes`** (Phase 2 gate). **HARD STOP:** do not start any wave when approval is missing or `no`. This closes F1 from the [v2.12.1 post-mortem](../../docs/release/post-mortem-v2.12.1.md) ([#249](https://github.com/beettlle/pi-spine/issues/249)).

**Model pin:** one worker pin for the release — do not mid-release-edit `.spine/spine-config.json` agent pins. Escalate models only on content/contract failure, never quota/403 or launch storms (F7, [#248](https://github.com/beettlle/pi-spine/issues/248)). A doctor/preflight quota-risk escalate signal is intentionally **out of scope** for this release — deferred to a later release ([#248](https://github.com/beettlle/pi-spine/issues/248) optional AC).

**Reviewer isolation:** reviewers no longer load user extensions — they spawn with `pi -ne` by default (v2.27.1, [#334](https://github.com/beettlle/pi-spine/issues/334)), so extension overrides matter only when `agents.reviewer.loadUserExtensions` is `true`. If a review spawn or provider failure hits a task whose `.DONE` is already in the lane, recover by re-review (`spine batch retry <taskId>` → `spine batch resume`), not salvage — salvage lands unreviewed work and is a last resort.

**Quota fallback is provider failover, not escalation** ([#329](https://github.com/beettlle/pi-spine/issues/329), v2.27.0): when `agents.quotaFallbackProfile` names a profile on a different provider pool, the engine moves the batch to that pool automatically — once per batch, sticky, journaled, without editing `.spine/spine-config.json` — and retries each quota-exhausted task once in its lane worktree. This is the sanctioned mid-release response to quota exhaustion; it does not count as a pin override under the rule above. When it fires, record it in the release manifest by pasting the `Agent pin override: yes (<date>, auto quota fallback <pool> -> <profile>, batch <id>)` line from `spine status --diagnose`.

**Detached-first:** See [agent-shell-batch-policy.md](../spine-autonomous-operator/references/agent-shell-batch-policy.md). Omit `--attached` for release waves unless the operator shell is a persistent interactive terminal that blocks until batch completion.

**Scope:** manifest tasks only — build a comma-separated release scope ID list.

```bash
spine preflight
spine run sequence <release-scope> --dry-run
```

For each wave `N` until all release-scoped tasks are `.DONE`:

Check `spine status --diagnose` first — if a batch is already **running** for this release, do not start another; follow recovery or wait.

### 4.1 Start (pi async — preferred in pi sessions)

See [references/pi-async-orchestration.md](references/pi-async-orchestration.md):

```text
MonitorCreate:
  command: spine batch start <release-scope> --wave N    # detached — omit --attached (#163)
  description: Release wave N
  timeout: 0
  onDone: spine status --diagnose → read evidence/summary.md → §4.3 land loop or §4.4 recovery
```

**Blocking fallback** (Cursor Agent, non-pi, or after MonitorCreate orphan — see [agent-shell-batch-policy.md](../spine-autonomous-operator/references/agent-shell-batch-policy.md)):

```bash
spine batch start <release-scope> --wave N
spine status --diagnose
spine wait --until completed,failed,needs_integrate,needs_retry,aborted --timeout 4h --interval 60
```

**Context discipline:** one blocking `spine wait` (or one Monitor wake) per wave — not repeated `spine status` polls. On wake, read `.spine/runtime/<batchId>/evidence/summary.md` (~2 KB). Never read `evidence/test-output.txt` (~240 KB) in full; extract the result lines:

```bash
rg -n '^ℹ (tests|pass|fail)|^not ok' .spine/runtime/<batchId>/evidence/test-output.txt
```

**Foreground `--attached`** (persistent interactive human terminal only):

```bash
spine batch start <release-scope> --wave N --attached
```

### 4.2 Monitor

```bash
spine status --diagnose
# or block:
spine wait --until completed,failed,needs_integrate,needs_retry,aborted --timeout 2h --interval 60
```

Optional pi watchdog: `LoopCreate` **only** when no MonitorCreate covers the batch — every 15m, `readOnly: true`, `maxFires: 8` — see pi-async-orchestration. Each fire is a full agent turn; a 2-minute loop over a 4-hour wave costs up to 120 turns of nothing.

> **Wait progress (SP-754):** human-mode `spine wait` is not silent until exit — it prints a start banner, a `Wait progress:` line per poll (diagnosis, phase, wave, elapsed), and a terminal `Wait matched:` (stdout) or `Wait timed out` (stderr) headline. Quiet output between progress lines means the wait is between polls, not hung. Use `--json` when a machine parses the result.

> **Wait recipe note:** With SP-683, gate-pending land loops report the taxonomy diagnosis `needs_integrate`, so the default `--until` lists above wake on that diagnosis. The operator runbook documents optional land-loop pseudo-diagnoses (`gate_open`, `needs_approval`, `post_merge_limbo`) as belt-and-suspenders waits when you need finer-grained blocking inside the land loop itself.

**Do not** start wave N+1 until wave N is integrated on `main`.

Wave sizing: prefer ≤4 M-sized tasks per wave; serialize hot shared files.

### 4.3 Land loop

When diagnosis is `needs_integrate` or gate is open:

```bash
spine gate status
spine gate approve
spine integrate
npm install
spine batch complete
```

Verify: `git status` clean, `.DONE` count increased.

### 4.3a Post-integrate regression gate (blocking)

After **every** land loop (including manual merge / conflict resolution), on current `main`:

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${N}.log
test "${PIPESTATUS[0]}" -eq 0
```

Full reference: [post-integrate-regression-gate.md](references/post-integrate-regression-gate.md).

**Why this gate still runs when contracts include lint:** contract verify runs only the authored `testCommand` in an isolated lane; post-integrate `release:check` validates the **merged tree** (full suite, coverage, cross-file call sites). Do not skip §4.3a because contract verify passed.

**If non-zero:** fix on `main`, commit, re-run gate. Do **not** start wave N+1, push, or proceed to Phase 5 until green.

**Do not** judge pass/fail from `tail` output — `tail` exits 0 even when `release:check` failed.

### 4.3b Push/sync `main` to `origin` (F8)

When **remote publish** is the goal, push `main` after each land loop once §4.3a is green:

```bash
git push origin main
```

Do not let `main` drift far ahead of `origin` between waves — v2.12.1 ran **24 commits ahead** of `origin` at Phase 5 (F8, [#249](https://github.com/beettlle/pi-spine/issues/249)). Local-only releases may defer this push; record the deferral in the manifest publish checklist.

### 4.3c Close GitHub issues for landed tasks (blocking hygiene)

After §4.3a is green (and §4.3b push when remote publish is the goal), **close every open issue fully resolved by tasks that just landed** — same wave, same land loop. Do not wait for Phase 6 or npm publish.

```bash
# Issues linked from the wave's newly-.DONE tasks:
rg -n 'Closes #|Closes: #' spine-tasks/SP-*/PROMPT.md

# For each Closes #NNN (not Partial) whose SP-* is .DONE on main and still OPEN:
gh issue view NNN --repo beettlle/pi-spine --json state,title
gh issue close NNN --repo beettlle/pi-spine --reason completed --comment "$(cat <<EOF
Fixed on \`main\` by **SP-XXX** (release v{TARGET}).

- Commit(s): \`<sha>\` — <subject>
- Batch: <batchId> (integrated)
EOF
)"
```

| Link in PROMPT Mission | Action after land |
|------------------------|-------------------|
| `Closes #NNN` / `Closes: #NNN` | **Close** when that task's `.DONE` is on `main` and §4.3a passed |
| `Partial #NNN` / `Partial: #NNN` | **Leave open** — note progress in a comment if useful |
| Manifest-mapped issue with no `Closes` line | Close only if acceptance criteria are fully met; otherwise comment + leave open |

**Fail closed before next wave / Phase 5:** every release-scoped `Closes #NNN` for tasks already `.DONE` on `main` must show `state: CLOSED`. Re-check:

```bash
# Example: verify still-open Closes targets for release-scoped DONE tasks
for n in $(rg -o 'Closes:? #([0-9]+)' -r '$1' spine-tasks/SP-*/PROMPT.md | sort -u); do
  gh issue view "$n" --repo beettlle/pi-spine --json number,state -q '"\(.number) \(.state)"'
done
```

Record closed issue numbers in the release manifest intake / composition notes.

### 4.4 Recovery

Always: `spine status --diagnose`

| Diagnosis | Action |
|-----------|--------|
| `running` | Wait; `spine watch` |
| `paused` | `spine batch resume` |
| `needs_retry` | Fix packet; `spine batch retry <taskId>` |
| `worker_orphaned` | abort → dismiss → prune worktree → retry |
| `needs_integrate` | Land loop |
| `state_drift` | Follow `suggestedCommand` from diagnose: `spine batch retry <taskId>` when drift task is not `running`; `spine batch resume --force` when still `running` (SP-512 — not `pause && retry`). Then **`spine batch resume --attached --force` in foreground** if engine remains detached (never MonitorCreate) |
| `failed` / `aborted` | Inspect journal; fix packet; dismiss; retry |
| Contract fail | Fix PROMPT on main, commit, abort, dismiss, retry |

**File upstream issues** for repeat engine faults — see [references/issue-template.md](references/issue-template.md).

---

## Phase 5 — Pre-publish verification (STOP)

```bash
spine plan <release-scope>    # should show 0 pending for scope
spine preflight
git status
```

**pi async (preferred):** `MonitorCreate` with `npm run release:check 2>&1 | tee /tmp/pi-spine-release-check.log`, `timeout: 900000`, `onDone` to verify exit 0 from monitor metadata — not log tail alone. On failure, extract failures with `rg -n '^not ok|^ℹ fail|Error' /tmp/pi-spine-release-check.log` instead of reading the whole log into context.

**Foreground fallback:**

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-release-check.log
test "${PIPESTATUS[0]}" -eq 0   # or: npm run release:check; echo $?
```

**Do not** use `npm run release:check 2>&1 | tail -20` for pass/fail — verify exit code explicitly.

### `release:check` gate (HARD STOP — blocking)

`npm run release:check` is **not advisory**. It is a **blocking gate** before any publish checklist or Phase 6.

**If `npm run release:check` exits non-zero:**

1. **STOP immediately.** Do not present the pre-publish checklist as passable.
2. Do not ask for publish approval. Do not run `npm version` or `git push --tags`.
3. Record the failure output in the release manifest publish checklist (paste log tail or path to `/tmp/pi-spine-release-check.log`).
4. **Recovery:** fix failures on `main` (commit fixes), re-run `npm run release:check` until green, then **re-attempt Phase 5** from the top.

Only after `npm run release:check` exits **0** may you present the checklist below.

Present checklist from `docs/release/npm-publish.md`:

- [ ] All release-scoped tasks done
- [ ] Preflight green
- [ ] `npm run release:check` green (includes lint; ≥77% coverage) — **verified exit 0**
- [ ] CI workflow green on `HEAD` (release-safe profile — parity with `ci.yml`) — **verified via `gh run list`**
- [ ] Clean git tree
- [ ] Bump type matches profile: patch | minor | major
- [ ] `release:check` output recorded in manifest publish checklist

**Human gate (required):** **STOP HERE.** Do not bump or push until operator explicitly approves publish, confirms bump type, **and** Phase 5 `release:check` passed on current `main`.

---

## Phase 6 — Publish (after approval only)

**Prerequisites (all required — no bypass):**

- Phase 5 `npm run release:check` exited **0** on current `main` (re-run if `main` moved since Phase 5)
- **CI workflow green on current `HEAD`** (pre-tag gate — see below)
- Operator explicitly said "approve publish" / "bump and push"
- Operator confirmed bump type matches Phase 2 profile

**Do not skip the release:check gate.** Operator approval alone does not authorize `npm version` or tag push when `release:check` would fail. If unsure, re-run `npm run release:check` before bumping.

### Pre-tag CI gate (HARD STOP — blocking)

Before `npm version` or `git push --tags`, verify the **CI** workflow succeeded on current `HEAD` (the commit you are about to tag). **Release-safe CI profile** matches `ci.yml`: typecheck → lint → tests with coverage (≥77% line minimum) → CLI smoke checks. Local parity: `npm run release:check` (Phase 5).

**If CI is not green on `HEAD`, STOP.** Push to `main` and wait for CI before tagging — do not retag after a failed release.

```bash
COMMIT=$(git rev-parse HEAD)
gh run list --workflow ci.yml --commit "$COMMIT" --json databaseId,conclusion,status --limit 5
```

**Fail closed** when no run has `conclusion: success`. **Cancelled or absent CI is no signal** — neither green nor red (post-mortem v2.12.3 F-C). Branch by run state:

- **`in_progress` / `queued`:** wait:

```bash
gh run watch --exit-status <run-id>
```

- **`cancelled` or no run exists for `HEAD`:** re-run **CI** via `workflow_dispatch` (trigger added in `edb7919d`), then wait for `conclusion: success` on current `HEAD`:

```bash
gh workflow run ci.yml
gh run list --workflow ci.yml --commit "$COMMIT" --json databaseId,conclusion,status --limit 5
gh run watch --exit-status <run-id>
```

Never treat a cancelled run as green or as a reason to skip this gate.

If CI **failed**, **STOP** — fix CI on `main`, re-run Phase 5, then re-attempt this gate. Do not `npm version` or `git push --tags` until a green CI run exists on `HEAD`.

Only after Phase 5 **and** pre-tag CI gate pass:

```bash
npm version patch   # or minor / major — must match Phase 2 profile
git push && git push --tags
```

### CI stages to npm via OIDC (not the operator shell)

**Canonical publish path:** pushing `v*` triggers [`.github/workflows/release.yml`](../../.github/workflows/release.yml). That workflow:

1. Checks out the tag
2. Verifies CI green on the tagged commit (or runs the full gate if no green CI yet)
3. Ensures npm ≥ 11.15 and runs `npm stage publish --access public --ignore-scripts --provenance` with **Trusted Publishing (OIDC)** — `permissions.id-token: write`; no `NPMSECRET`
4. Creates the GitHub Release (`gh release create`)

**Not live yet:** Trusted Publisher is **stage-only**. A maintainer must approve with 2FA before the version is installable:

```bash
npm stage list
npm stage view <stage-id>
npm stage approve <stage-id>   # prompts for 2FA
# or: npmjs.com → package → Staged Packages → Approve
```

Operator Phase 6 after approval is: **bump → push tag → watch `release.yml` (stage) → human approve → smoke**. Full mechanics: `docs/release/npm-publish.md`.

Monitor Release workflow until conclusion:

```bash
gh run list --workflow release.yml --limit 3
# Prefer the run for this tag:
gh run list --workflow release.yml --branch v{VERSION} --limit 3
gh run watch --exit-status <run-id>
```

**pi async:** `MonitorCreate` with `gh run watch --exit-status <run-id>`, `timeout: 1800000`, `onDone` to report conclusion; if green, remind operator to approve the staged package, then run smoke.

**Publish success criteria (all required):**

- `release.yml` conclusion `success` (stage + GitHub Release)
- Staged package **approved** (2FA) — `npm view pi-spine version` equals the released version
- GitHub Release exists for `v{VERSION}` (`gh release view v{VERSION}`)

Tag push + green **CI** (`ci.yml`) alone is **not** enough — `ci.yml` does not stage or publish. Green stage alone is **not** enough — approve is required.

### Publish failure recovery (HARD STOP — do not retag)

When `release.yml` fails: `gh run view <run-id> --log-failed`, then follow the symptom table in [references/publish-recovery.md](references/publish-recovery.md). Auth/OIDC failures → fix Trusted Publisher and `gh workflow run release.yml -f tag=v{VERSION}` on the **existing** tag; never `npm version` or retag for auth-only failures.

Post-publish smoke (**only after stage success and 2FA approve**): `scripts/post-publish-smoke.sh <version>` — bounded retry on registry lag (F9, [#247](https://github.com/beettlle/pi-spine/issues/247)). If retries exhaust, **STOP** and investigate; manual steps in [references/publish-recovery.md](references/publish-recovery.md#post-publish-smoke).

After smoke passes, upgrade the machine's global install to the new release (the only point the global changes): `npm install -g pi-spine@<version>`, then `spine --version` must print `<version>`. If pi loads the extension via `npm:pi-spine`, run `pi update` as well.

Update `spine-tasks/CONTEXT.md` release note (version + date).

### Close remaining GitHub issues (final sweep)

§4.3c should already have closed each `Closes #NNN` when its task landed. Before the final report, **sweep** any still-open issues that release-scoped DONE tasks fully resolve:

```bash
rg -n 'Closes #|Closes: #' spine-tasks/SP-*/PROMPT.md
# For each still-OPEN Closes #NNN whose SP-* is .DONE on main:
gh issue close NNN --repo beettlle/pi-spine --reason completed --comment "…"
```

Include the published version/tag in the close comment when closing at Phase 6 (e.g. `Shipped in **v{TARGET}**`). Leave `Partial #NNN` open.

**Fail closed:** do not mark the release cycle complete while any release-scoped `Closes #NNN` issue remains OPEN.

---

## Final report (required)

1. **Release manifest** — path, target version, profile, composition table
2. **Tasks completed** — SP-IDs, waves, issues closed (list `#NNN` CLOSED with close time or comment URL)
3. **Deferred backlog** — count and top items for next release (issues left OPEN + rationale)
4. **Dependency drift** — Phase 1 check outcome: included SP-*/#NNN or deferred rationale (and audit high/critical count)
5. **Authoring changes** — new SP-* created, splits/fixes in Phase 3
6. **Issues filed** — pi-spine GitHub links or "none"
7. **Recovery actions** — aborts, retries, contract fixes
8. **Verification** — paste `spine preflight` tail, **`npm run release:check` output** (or log path), test/coverage output
9. **Publish** — version bumped (Y/N), tag pushed (Y/N), `release.yml` URL + conclusion, stage approved (Y/N), `npm view pi-spine version`, or "awaiting operator approval" / "blocked on Trusted Publisher" / "awaiting stage approve"
10. **Issue tracker hygiene** — confirm every release-scoped `Closes #NNN` is CLOSED (paste `gh issue view` states or list)
11. **Spend** — per wave from `spine metrics show --batch <batchId>`: tasks, attempts (retries), failed-attempt wall time, reviewer-infrastructure failures, quota fallbacks. Include token/cost totals once populated ([#338](https://github.com/beettlle/pi-spine/issues/338)); until then write "tokens: not recorded"

---

## Repo-specific notes (pi-spine)

| Item | Value |
|------|-------|
| Tasks root | `spine-tasks/` |
| Issues repo | `beettlle/pi-spine` |
| Pre-publish gate | `npm run release:check` (typecheck → lint → tests → coverage; CI parity) |
| Pre-tag CI gate | `ci.yml` green on `HEAD` via `gh run list` / `gh run watch` before `npm version` ([#156](https://github.com/beettlle/pi-spine/issues/156)) |
| Publish | **CI-only OIDC stage** — `.github/workflows/release.yml` runs `npm stage publish` (`id-token: write`). Trusted Publisher: stage-only. Human 2FA approve before installable |
| Re-publish | `gh workflow run release.yml -f tag=vX.Y.Z` after Trusted Publisher fix — never retag for auth-only failures |
| Pending backlog | Run `spine plan pending` — release executes **subset only** |

## Short prompt (resume mid-release)

```text
Resume spine release v{TARGET}: /gitnexus analyze → gitnexus status →
check manifest at spine-tasks/_authoring/release-v{TARGET}/manifest.md →
spine status --diagnose (do not collide with running batch) →
preflight → for each wave: MonitorCreate batch start (or foreground) → onDone diagnose →
gate approve → integrate → npm install → batch complete →
post-integrate release:check (exit 0 required; no tail-only verification) →
git push origin main when remote publish is the goal (F8) →
close Closes #NNN issues for tasks that just landed (§4.3c; do not wait for publish) →
MonitorCreate release:check → HARD STOP if non-zero (fix on main, re-run) → only if exit 0: verify ci.yml green on HEAD (gh run list/watch) → HARD STOP if not green → only then: STOP for publish approval →
after approve: npm version + push tags → watch release.yml (OIDC `npm stage publish`) → on OIDC/auth failure fix Trusted Publisher and gh workflow run release.yml -f tag=v{TARGET} (do not retag) →
human 2FA approve staged package (npmjs.com or `npm stage approve`) → confirm npm view + gh release view → post-publish smoke → Phase 6 issue sweep → final report must list CLOSED issue numbers.
resume --attached --force stays foreground. Post final report with composition table.
```
