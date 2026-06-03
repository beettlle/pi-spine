# SP-055 Status

**Task:** Migrate pi-spine repo to spine-tasks/
**Status:** 🔄 In Progress — Step 3

## Step 3: Purge or gitignore `.pi/` runtime cruft

- [x] Remove tracked `.pi/taskplane.json` and `.pi/agents/*`
- [x] Gitignore `.pi/taskplane.json` and `.pi/agents/`
- [x] Keep `.pi/taskplane-config.json` as migration test fixture

## Step 1: Move tasks root + config

- [x] `git mv taskplane-tasks spine-tasks`
- [x] Update `.spine/spine-config.json` `paths.tasksRoot` → `spine-tasks`
- [x] Update `spine-tasks/CONTEXT.md` Key Files path

## Step 2: Update test/fixture references

- [x] Repo dogfood tests → `spine-tasks/` (`integration`, `incidents`, `lanes-parallel`)
- [x] `git-fixture` default tasks root → `spine-tasks`
- [x] Batch/temp test paths → `spine-tasks` (migration/adoption fixtures unchanged)
- [x] Resume fallbacks use config `paths.tasksRoot` instead of hardcoded `taskplane-tasks`
