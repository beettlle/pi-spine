# SP-717: Atomic batch-history append; no silent wipe — Status

**Current Step:** Step 4: Documentation & Delivery
**Status:** Completed
**Last Updated:** 2026-08-22
**Review Level:** 1
**Size:** S

---

## Step 1: Atomic history writes

**Status:** Completed
- [x] Use `writeJsonAtomic` for history append (or JSONL migration if simpler)
- [x] Remove bare `writeFileSync` on happy path

## Step 2: Corrupt file handling

**Status:** Completed
- [x] Quarantine to `.spine/runtime/batch-history.json.corrupt.{timestamp}`
- [x] Operator-visible error; never silent `[]` reset

## Step 3: Testing & Verification

**Status:** Completed
- [x] Concurrent append test (two entries retained)
- [x] Corrupt-file quarantine test
- [x] Run contract `testCommand` only

## Step 4: Documentation & Delivery

**Status:** Completed
- [x] Create `.DONE`

---

## Execution Log

| Date | Event | Detail |
|------|-------|--------|
| 2026-08-22 | Task staged | v2.15.0 release packet |
| 2026-08-23 | Task executed | Atomic writes and quarantine logic implemented and verified |
