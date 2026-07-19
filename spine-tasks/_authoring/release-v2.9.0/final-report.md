# Release Report: v2.9.0

## Composition
| Bucket | Selected | Status |
|--------|----------|--------|
| Documentation | 1 | PASS |
| Bug fixes | 1 | PASS |
| Enhancements | 2 | PASS |
| **Total tasks** | **5** | PASS |

## Tasks Completed
| SP-ID | Issue | Bucket | Size | Title |
|-------|-------|--------|------|-------|
| SP-663 | #215 | bug | S | Fix spine wait re-driving recovery |
| SP-664 | #216 | enh | M | Named agent-model profiles |
| SP-665 | #214 | enh | S | Show task title in dashboard |
| SP-666 | #210 | doc | S | Runbook: hybrid worker/reviewer models |
| SP-667 | — | doc | S | CONTEXT Phase 73 capstone |

**Issues closed**: #215, #216, #214

## Authoring Changes
- New SP-663 through SP-667 created.
- Dependencies set for sequential run of the capstone after Wave 0.

## Recovery Actions
- `SP-663` and `SP-665` experienced initial failure due to the worker models (`zai/glm-5.2` and `kimi-coding/kimi-k2-thinking`) timing out.
- Recovered by switching the `spine-config.json` default worker/code reviewer to `google/gemini-3.1-pro-preview` and re-running the failed tasks. 
- A coverage error resulted from `extensions/spine/slash-commands.ts` not meeting the coverage requirement during the manual gate, so `SP-663` ran again correctly.
- Resumed tasks successfully landed.

## Verification
- Spine preflight checks passed.
- `npm run release:check` passed with 89.11% code coverage before tag push.
- `spine --version` returns `v2.9.0`.
- All `spine doctor` checks successfully passed.

## Publish
- Version bumped: YES (`v2.9.0`)
- Tag pushed: YES (`v2.9.0`)
- CI workflow on HEAD: Success
- Release workflow: Success