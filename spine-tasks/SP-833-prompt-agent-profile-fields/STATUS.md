# SP-833: PROMPT `**Profile:**`, `**Thinking:**`, `**Reviewer Profile:**` fields — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `parsePrompt`, `validatePrompt`, `loadTaskPacket` — record callers in Discoveries
- [ ] Dependencies satisfied (SP-832 exports present)

### Step 1: Parse fields
**Status:** ⬜ Not Started

- [ ] `profile`, `thinking`, `reviewerProfile` parsed and always present on the result
- [ ] Structural errors and execute-task warnings

### Step 2: Config-aware validation + callers
**Status:** ⬜ Not Started

- [ ] Optional `agents` option threaded through validation
- [ ] Unknown profile / reviewer profile errors; missing reviewer block warning; same-family error
- [ ] `spine tasks validate` and preflight pass `agents`

### Step 3: Tests
**Status:** ⬜ Not Started

- [ ] Parse: each field present / absent / mixed case label / invalid thinking / malformed name
- [ ] Validate with `agents`: unknown profile, unknown reviewer profile, missing reviewer block warning, same-family error (gemini worker profile + gemini reviewer profile), cross-family OK
- [ ] Validate without `agents`: no profile errors (planner path)
- [ ] `spine tasks validate` CLI reports the unknown-profile error

### Step 4: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review)
- [ ] Fix all failures

### Step 5: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-833-prompt-agent-profile-fields/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
