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

- Fixed on `main` but issue not closed
- Requires external repo reproduction without minimal repro
- Blocked by epic infrastructure not in this release

## Enhancement issue heuristics

**Patch profile:** exclude all.

**Minor profile:** pick exactly one (two only with operator override):

- User-visible or operator-visible improvement
- S/M size; split L/XL first
- Disjoint `fileScopeMustChange` from bug tasks in same wave
- P1/P2 over P3

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
