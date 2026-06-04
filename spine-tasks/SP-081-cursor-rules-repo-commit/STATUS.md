# SP-081: Cursor rules repo commit — Status

**Status:** 🟡 In progress | **Review Level:** 0

## Step 1: Curate and commit rules
- [x] Stage `.cursor/rules/` (38 files; JS + universal + optional language packs)
- [x] Verify no secrets or machine-local paths in rules

## Step 2: Contributor docs
- [ ] README section: Cursor rules + audit workflow pointer
- [ ] Bootstrap checklist: optional `.cursor/` setup step

## Step 3: Verification
- [ ] `git status` clean after commit on branch; no .gitignore conflict
- [ ] `npm test` passes
