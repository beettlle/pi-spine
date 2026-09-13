# Issue intake checklist

Run during **Phase 1** before composing the release manifest.

## GitHub queries

Repo: `beettlle/pi-spine`

```bash
gh issue list --repo beettlle/pi-spine --state open --limit 100 \
  --json number,title,labels,body

gh issue list --repo beettlle/pi-spine --state open --label documentation \
  --json number,title,labels

gh issue list --repo beettlle/pi-spine --state open --label bug \
  --json number,title,labels

gh issue list --repo beettlle/pi-spine --state open --label enhancement \
  --json number,title,labels
```

## Label taxonomy

| Label | Release bucket | Priority notes |
|-------|----------------|----------------|
| `documentation` | Documentation | Highest user value — address before enhancements |
| `bug` | Bug fix | Prefer user-impact, reproducible, already-tasked |
| `enhancement` | Enhancement | One per minor; zero per patch |
| `priority:P1` | Any | Prefer over P2/P3 when scope allows |
| `priority:P2` | Any | Normal |
| `priority:P3` | Any | Defer unless trivial S doc fix |
| `skill:create-spine-tasks` | Documentation (usually) | Skill/template updates; often docs-only packets |

## Issue → task mapping

1. Grep pending and done tasks for issue links:

   ```bash
   rg 'Closes:|Partial:' spine-tasks/*/PROMPT.md
   ```

2. Classify each open issue:

   | State | Action |
   |-------|--------|
   | Mapped to pending SP-* | Candidate for manifest if fits profile |
   | Mapped to `.DONE` SP-* | Closed by shipped work — exclude |
   | No SP-* yet | **Gap** — author with `create-spine-tasks` in Phase 3 |
   | Epic / `[Epic]` in title | Defer unless major profile with operator approval |

## Documentation issue heuristics

Prefer for release inclusion when:

- `label:documentation` or title starts with `Docs:`
- `skill:create-spine-tasks` issues that are template/rule updates only
- Pending SP-* with docs-only File Scope (`fileScopeMustNotChange` on `src/`, `bin/`, `tests/`)
- `testCommand: true` or scoped doc verification

Ensure **Documentation Requirements paths appear in File Scope** (issue #144).

## Bug issue heuristics

Prefer when:

- Repro steps in issue body or linked diagnosis
- Already has pending SP-* with `Closes: #NNN`
- S/M size, disjoint file scope from parallel neighbors
- User-visible failure (contract fail, integrate hang, dirty worktree)

Exclude when:

- Fixed on `main` but issue not closed — **unless** this release will close it immediately (hygiene debt from a prior land; close in §4.3c / Phase 6 sweep before selecting new work for the same issue)
- Requires external repo reproduction without minimal repro
- Blocked by epic infrastructure not in this release

## Enhancement issue heuristics

**Patch profile:** exclude all.

**Minor profile:** pick exactly one (two only with operator override):

- User-visible or operator-visible improvement
- S/M size; split L/XL first
- Disjoint `fileScopeMustChange` from bug tasks in same wave
- P1/P2 over P3

## Dependency drift check

Run during **Phase 1** for **every** profile (including patch). Always record results; only **include** a dep/hygiene task when a threshold fires — never auto-add “update all deps” to every minor.

### Commands

```bash
npm outdated
npm audit
```

Optional: glance at GitHub Actions major pins in `.github/workflows/*.yml` (`actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/github-script`) for toolchain major drift.

### Include / defer thresholds

| Signal | Include in release? | Bucket |
|--------|---------------------|--------|
| `npm audit` high or critical | Yes — even **patch** if fix is S-sized | bug / hygiene |
| `@earendil-works/pi-coding-agent` behind by ≥1 0.x minor (e.g. 0.80 → 0.85) | Yes for **minor/major**; patch only if also audit-high | enh / hygiene (counts against enh budget on minor) |
| Same-major patch/minor drift only (eslint 9.x, `@types/node` 22.x) | Include only if enh budget has room **or** operator override; otherwise defer | hygiene |
| TypeScript / ESLint / Actions **major** | **minor/major** only — never default into patch | enh / hygiene |
| No overdue signal | Record “deps OK — deferred” in the manifest; **no new task** | — |

**Scope when included:** prefer one focused peer/security packet over “bump everything” when the enhancement slot is already full. Dep hygiene inserts into the bug or enh slot — it is not a fourth unlimited bucket.

### Map before authoring a gap

Search open issues for an existing dep bump ticket before creating a new SP-*:

```bash
gh issue list --repo beettlle/pi-spine --state open --limit 100 \
  --json number,title,labels \
  --jq '.[] | select(.title | test("dependenc|pi-coding-agent|npm audit|Bump dep"; "i"))'
```

Prefer `Closes #NNN` on that issue over inventing duplicate work.

## Pending task inventory

```bash
spine plan pending
spine tasks validate pending
spine tasks analyze pending
spine deps pending
```

Read `spine-tasks/CONTEXT.md` for `Next Task ID` and phase notes.

Cross-reference pending SP-* with open issues. The release executes **manifest scope only**, not all pending tasks.

## Intake output table

| Issue # | Labels | Mapped SP-* | Bucket | Profile fit | Notes |
|---------|--------|-------------|--------|-------------|-------|
| #130 | bug | SP-483 | bug | patch ✓ | post-merge restore |
| #90 | documentation | — (gap) | doc | minor ✓ | needs new SP-* |

### Deps mini-table (required)

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| @earendil-works/pi-coding-agent | 0.80.3 | 0.85.1 | include (#285) / defer: … |
| (others from `npm outdated`) | … | … | include \| defer |

Also record: `npm audit` high/critical count and overall action for the manifest **Dependency drift** section.