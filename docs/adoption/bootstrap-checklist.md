# pi-spine bootstrap checklist

Copy-paste steps to adopt pi-spine on a **greenfield** repo or **migrate from Taskplane**, without touching production until you are ready.

## Adoption fixture (smoke target)

The repo ships a minimal consumer layout at **`tests/fixtures/adoption-repo/`**:

- `taskplane-tasks/AD-001-smoke/` — Review Level 0 task (touch `DONE.txt`)
- No `.spine/` config checked in — first bootstrap runs `spine init`

Run the automated smoke (no network, stub workers):

```bash
./scripts/adoption-smoke.sh
# or: SPINE_WORKER_STUB=1 node --test tests/adoption/fixture-batch.test.mjs
```

Use this fixture to validate install and batch wiring before pointing spine at your real project.

---

_(Full greenfield and migrate checklists follow in Step 2.)_
