# SP-079: CLI router split — Status

**Status:** 🟡 In Progress — Step 2 complete (tests + get-version dedupe)

## Step 1: Extract dispatch modules
- [x] One module per command group; spine.mjs becomes thin router

## Step 2: Tests + get-version
- [x] CLI smoke tests unchanged; remove shell:true if present
