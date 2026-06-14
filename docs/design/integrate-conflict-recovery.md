# Integrate conflict recovery (FR-SHIP-12 spike)

**Status:** Spike complete — runbook + manual operator workflow; no merger-agent code  
**Related:** [operator runbook §4.1](../adoption/operator-runbook.md#41-integrate-merge-conflicts-fr-ship-12), [PRD v2.2 FR-SHIP-12](../PRD-v2.2-ship-readiness-handoff.md#fr-ship-12--mergerconflict-ux)

---

## Spike question

When `spine integrate` hits a git merge conflict (orch → `main`), is Taskplane-style **LLM merger-agent** automation required for v2.2, or is documented manual recovery sufficient?

## Current behavior (no code changes in SP-223)

| Stage | Conflict handling |
|-------|-------------------|
| Lane → orch (wave merge) | Auto-resolve **only** `.spine/rules-manifest.json` when `rules[]` are identical and `generatedAt` differs (SP-121). All other paths fail the wave merge with `MergeConflict`. |
| Orch → base (`spine integrate`) | Same rules-manifest auto-resolve attempt; on failure **`git merge --abort`**, restore prior checkout, journal `integrate.failed` with `conflict: true`, exit non-zero. |

Headline shown to operators:

```text
Merge conflict integrating orch/spine-<batchId> into main — resolve manually
```

Regression coverage: `tests/batch/integrate.test.mjs` (`integrateOrchToBase aborts merge on conflict and restores checkout`).

## Spike conclusion

**Minimal UX is sufficient for v2.2.** pi-spine already:

1. Fails loud with a classified `MergeConflict` headline (not silent partial merge).
2. Aborts the in-progress merge and leaves `main` unchanged when integrate fails.
3. Journals `integrate.failed` for post-mortems and `spine journal export`.
4. Auto-resolves the one high-frequency conflict (rules-manifest timestamp drift).

Adding an LLM **merger agent** (Taskplane parity) would introduce non-deterministic git state, new failure modes, and security review surface without addressing the root cause — overlapping file scope between lanes or concurrent edits on `main` during a batch.

## Merger-agent non-goal (v2.2)

Per [PRD §4.2 non-goals](../PRD.md#42-non-goals-v1): **LLM-powered merger agent for git conflict resolution** remains out of scope.

| Taskplane capability | pi-spine v2.2 |
|----------------------|---------------|
| Merger LLM agent resolves integrate conflicts | **Not shipped** — operator resolves in git, then re-runs land loop |
| Conversational conflict narration | **Not shipped** — use `spine status --diagnose`, journal export, runbook §4.1 |

**Optional stretch (post-v2.2):** interactive `spine integrate --explain-conflicts` that lists unmerged paths and suggests file owners — only if consumer pilot shows operators cannot recover with runbook + git alone. Not blocking publish.

## Operator workflow

Procedural steps live in [operator-runbook.md §4.1](../adoption/operator-runbook.md#41-integrate-merge-conflicts-fr-ship-12). Summary:

1. Confirm integrate failed with `MergeConflict` (CLI headline or `--diagnose`).
2. Verify merge aborted — `git status` on `main` should not show `MERGING`.
3. Resolve on **orch branch** (rebase/merge `main`, fix, commit) **or** manual merge on `main`.
4. Re-run `spine integrate` → `spine batch complete` → push.

Lane-level conflicts during the batch (before integrate) use `needs_merge` diagnosis — fix in lane worktrees, then `spine batch resume --force` or retry failed tasks.
