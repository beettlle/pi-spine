# STATUS — SP-548 Subprocess heartbeat observability

**Task:** SP-548
**Status:** Complete

## Steps

### Step 0: Preflight

- [x] Read issue #134 — worker_alive null payload during long test/coverage subprocess

### Step 1: Subprocess heartbeat kind

- [x] Extend heartbeat builder to accept subprocess phase signals from journal
- [x] Include redacted subprocess label in lane.heartbeat payload
- [x] Git porcelain debounce unchanged (SP-455)

### Step 2: Dashboard display

- [x] Expose subprocess phase in snapshot lane meta when present
- [x] Format display string (e.g. `running tests (3m)`)

### Step 3: Tests

- [x] Add `tests/batch/heartbeat-subprocess.test.mjs`

### Step 4: Testing & Verification

- [x] `node --test tests/batch/heartbeat-subprocess.test.mjs tests/batch/heartbeat-git-debounce.test.mjs` — 10 pass
- [x] `npm run typecheck` — pass

### Step 5: Documentation & Delivery

- [x] Close #134
- [x] Create `.DONE`
