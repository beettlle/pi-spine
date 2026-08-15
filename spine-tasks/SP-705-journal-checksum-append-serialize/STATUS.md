# SP-705: Journal checksum + append serialize — Status

**Current Step:** Step 0: Not started
**Status:** Ready
**Last Updated:** 2026-08-15
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

## Step 0: Preflight

**Status:** Not Started

- [ ] Confirm append + fsync
- [ ] Confirm legacy read without checksum

## Step 1: Checksum, serialize, retry

**Status:** Not Started

- [ ] SHA-256 on new events
- [ ] In-process serialize
- [ ] Bounded EBUSY/ENOENT retry
- [ ] Legacy lines still load
- [ ] Tests added

## Step 2: Testing & Verification

**Status:** Not Started

- [ ] Scoped contract testCommand
- [ ] Fix failures

## Step 3: Documentation & Delivery

**Status:** Not Started

- [ ] Create `.DONE`

---

## Reviews

| Date | Step | Type | Outcome |
|------|------|------|---------|
| | | | |

## Discoveries

| Date | Finding | Impact |
|------|---------|--------|
| | | |

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-15 | Task staged | PROMPT.md and STATUS.md created |

## Blockers

| Date | Blocker | Resolution |
|------|---------|------------|
| | | |

## Notes
