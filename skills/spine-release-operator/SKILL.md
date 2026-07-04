---
name: spine-release-operator
description: End-to-end pi-spine release operator. Intakes open GitHub issues and pending spine tasks, composes a semver-profiled release (docs priority, 3–5 bug fixes, ~1 enhancement for minor), authors and audits small self-contained task packets, executes wave-by-wave batches, verifies tests, and publishes after operator approval. Use when asked to run a spine release cycle, release vX.Y.Z, patch/minor/major release, or ship pi-spine to npm.
compatibility: Requires spine CLI, gh CLI, git, Node >= 22. Run from pi-spine repo root on main.
---

# Spine Release Operator

You are the **pi-spine release operator**. Drive a **curated release cycle** from intake through publish: select work by semver profile, author/audit task packets, execute batches, verify, and bump version — with **operator approval** before publish.

Invoke explicitly: `/skill:spine-release-operator` or "run a spine release cycle for v1.5.1".

**Not** for executing all pending tasks — use `spine-autonomous-operator` for that. This skill selects a **subset** fitting the release profile.

## Skill boundaries

| Concern | Delegate to |
|---------|-------------|
| PROMPT/STATUS/Contract authoring | `create-spine-tasks` skill + templates |
| Batch land loop / recovery | Phases below (adapted from `spine-autonomous-operator`) |
| Semver scope budgets | [references/release-profiles.md](references/release-profiles.md) |
| Issue intake queries | [references/issue-intake-checklist.md](references/issue-intake-checklist.md) |
| Manifest format | [references/release-manifest-template.md](references/release-manifest-template.md) |
| npm publish mechanics | `docs/release/npm-publish.md` |
| Upstream bug filing | [references/issue-template.md](references/issue-template.md) |

## Success criteria

1. Release manifest written and operator-approved
2. All **release-scoped** tasks `.DONE` and integrated on `main`
3. `spine preflight` green; local test/coverage gates pass
4. Operator explicitly approved publish; version bumped and tag pushed (if approved)
5. Final report with composition table, issues closed/deferred, verification output

## Hard rules

- **Never** hand-edit `.spine/batch-state.json` or `.spine/runtime/**`
- **Never** implement product code in task folders while a batch owns that scope
- **Never** claim batch/test/publish success without CLI output
- **Never** run `npm version` or `git push --tags` without explicit operator approval
- **Always** parse target version / bump type **before** task selection (Phase 2)
- **Always** prioritize documentation issues over enhancements
- **Always** run `spine gate approve` before `spine integrate`
- **Always** run `npm install` on `main` after successful integrate
- **Do not** execute tasks outside the approved manifest scope

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

**GitHub issues:**

```bash
gh issue list --repo beettlle/pi-spine --state open --limit 100 \
  --json number,title,labels,body
gh issue list --repo beettlle/pi-spine --state open --label documentation --json number,title,labels
gh issue list --repo beettlle/pi-spine --state open --label bug --json number,title,labels
```

**Pending tasks:**

```bash
spine plan pending
spine tasks validate pending
spine tasks analyze pending
```

**Map issues to tasks:**

```bash
rg 'Closes:|Partial:' spine-tasks/*/PROMPT.md
```

Read `spine-tasks/CONTEXT.md` for `Next Task ID`.

**Output:** intake table (issue #, labels, mapped SP-* or gap, bucket, profile fit).

---

## Phase 2 — Compose release manifest

Write manifest to:

```
spine-tasks/_authoring/release-v{TARGET}/manifest.md
```

Use [references/release-manifest-template.md](references/release-manifest-template.md).

### Selection order (strict)

1. **Documentation first** — all feasible doc items before feature work
2. **Bug fixes** — target 3–5 with user impact
3. **Enhancements** — per profile (0 for patch, 1–2 for minor)
4. **Defer** everything else with one-line rationale

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
- Deferred count
- Profile audit status

Require explicit **"approve release scope"** before Phase 3.

---

## Phase 3 — Author gaps and audit packets

### 3.1 Author new tasks (gaps only)

For issues in manifest without SP-*:

- Follow **`create-spine-tasks`** (lean mode default)
- Mission: `Closes: #NNN` (or `Partial:` when scoped)
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

**Scope:** manifest tasks only — build a comma-separated release scope ID list.

```bash
spine preflight
spine run sequence <release-scope> --dry-run
```

For each wave `N` until all release-scoped tasks are `.DONE`:

### 4.1 Start

```bash
spine batch start <release-scope> --wave N --attached
```

### 4.2 Monitor

```bash
spine status --diagnose
# or block:
spine wait --until completed,failed,needs_integrate,needs_retry,aborted --timeout 2h
```

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

### 4.4 Recovery

Always: `spine status --diagnose`

| Diagnosis | Action |
|-----------|--------|
| `running` | Wait; `spine watch` |
| `paused` | `spine batch resume` |
| `needs_retry` | Fix packet; `spine batch retry <taskId>` |
| `worker_orphaned` | abort → dismiss → prune worktree → retry |
| `needs_integrate` | Land loop |
| `state_drift` | Follow `suggestedCommand` |
| `failed` / `aborted` | Inspect journal; fix packet; dismiss; retry |
| Contract fail | Fix PROMPT on main, commit, abort, dismiss, retry |

**File upstream issues** for repeat engine faults — see [references/issue-template.md](references/issue-template.md).

---

## Phase 5 — Pre-publish verification (STOP)

```bash
spine plan <release-scope>    # should show 0 pending for scope
spine preflight
npm run typecheck && SPINE_WORKER_STUB=1 npm test
npm run coverage:check
git status
```

Present checklist from `docs/release/npm-publish.md`:

- [ ] All release-scoped tasks done
- [ ] Preflight green
- [ ] Tests + coverage green (≥77%)
- [ ] Clean git tree
- [ ] Bump type matches profile: patch | minor | major

**Human gate (required):** **STOP HERE.** Do not bump or push until operator explicitly approves publish and confirms bump type.

---

## Phase 6 — Publish (after approval only)

Only after operator says "approve publish" / "bump and push":

```bash
npm version patch   # or minor / major — must match Phase 2 profile
git push && git push --tags
```

Monitor CI:

```bash
gh run list --workflow release.yml --limit 3
```

Post-publish smoke per `docs/release/npm-publish.md`:

```bash
npm install -g pi-spine@<version>
spine version
spine doctor
```

Update `spine-tasks/CONTEXT.md` release note (version + date).

Close GitHub issues where tasks had `Closes: #NNN` and work shipped.

---

## Final report (required)

1. **Release manifest** — path, target version, profile, composition table
2. **Tasks completed** — SP-IDs, waves, issues closed
3. **Deferred backlog** — count and top items for next release
4. **Authoring changes** — new SP-* created, splits/fixes in Phase 3
5. **Issues filed** — pi-spine GitHub links or "none"
6. **Recovery actions** — aborts, retries, contract fixes
7. **Verification** — paste `spine preflight` tail, test/coverage output
8. **Publish** — version bumped (Y/N), tag pushed (Y/N), workflow URL, or "awaiting operator approval"

---

## Repo-specific notes (pi-spine)

| Item | Value |
|------|-------|
| Tasks root | `spine-tasks/` |
| Issues repo | `beettlle/pi-spine` |
| Test gate | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| Coverage gate | `npm run coverage:check` (≥77%) |
| Publish | Tag-triggered `.github/workflows/release.yml` |
| Pending backlog | Run `spine plan pending` — release executes **subset only** |

## Short prompt (resume mid-release)

```text
Resume spine release v{TARGET}: check manifest at spine-tasks/_authoring/release-v{TARGET}/manifest.md →
verify remaining scope → preflight → for each wave: batch start --attached → diagnose →
gate approve → integrate → npm install → batch complete →
when scope done: tests + preflight → STOP for publish approval.
Post final report with composition table.
```
