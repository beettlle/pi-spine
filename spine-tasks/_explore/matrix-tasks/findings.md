# Explore: Parametric Matrix Tasks (#217) & Execution-only Tasks (#218)

## Summary
Implementation of parametric matrix tasks (job arrays) and execution-only tasks in spine.

## Codebase areas
- Planner: `src/planner/` - needs `## Matrix` parsing and expansion logic.
- Contract Verify: `src/batch/contract-verify.mjs` - needs variable substitution for matrix IDs.
- Engine: `src/batch/engine.mjs` - needs dynamic lane creation based on matrix row count.
- Worker: `src/worker/runner.mjs` - needs execution-only bypass and frontmatter parsing.

## Risks
- Matrix expansion in planner could cause performance issues if matrix is huge.
- Execution-only tasks must still respect lane isolation and integration gate.

## Suggested file scopes
- Planner: `src/planner/matrix.mjs` (new)
- Contract: `src/batch/matrix-subst.mjs` (new)
- Worker: `src/worker/execute-only.mjs` (new)

## Open questions
- How to handle failure/success of individual sub-lanes in the journal?
