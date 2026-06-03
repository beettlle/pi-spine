# SP-053 Status

**Task:** Scaffold CONTEXT.md on init
**Status:** 🔄 In Progress

## Step 1: Template + init write

- [x] `templates/tasks/CONTEXT.md` template (Next Task ID, phase table stub, execution policy)
- [x] `bin/spine-init.mjs` writes `{tasksRoot}/CONTEXT.md` on init (skip/force semantics)

## Step 2: Tests

- [x] `tests/spine-init.test.mjs` coverage for CONTEXT scaffold
- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test`
