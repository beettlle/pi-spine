# npm publish checklist (Phase 22 / Phase 26)

Pre-publish validation before `npm publish` (operator-triggered). SP-242 completed pre-release + dry-run; execution is SP-226 (human-gated).

## Checklist

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` green — SP-225 baseline 838/838; SP-242 re-verifies in Step 2
- [x] `npm run coverage:check` green — SP-225: 85.92% line (threshold 77%)
- [x] `package.json` `files` includes `bin/`, `src/`, `extensions/`, `skills/`, `templates/` — verified SP-242
- [x] Version bump decision documented — **`1.0.0`** (see [v1.0-checklist.md §Version bump decision](v1.0-checklist.md#version-bump-decision))
- [ ] `package.json` version set to `1.0.0` — SP-226 (before publish)
- [x] README install section lists `npm install -g pi-spine` path
- [ ] `spine doctor` passes on clean consumer fixture after global install — post-publish smoke (SP-226)
- [ ] Real-pi adoption E2E report filed (optional but recommended)

## Dry-run pack (SP-242, 2026-06-14)

```bash
npm pack --dry-run
```

| Field | Value |
|-------|-------|
| version | `0.0.1` (pre-bump) |
| total files | 154 |
| package size | 223.5 kB |
| shasum | `927119b9db9ffd42705e057816cdc9a89b874503` |

Full verification recorded in [v1.0-checklist.md §Dry-run pack](v1.0-checklist.md#dry-run-pack).

## Commands

```bash
npm pack --dry-run
npm publish --access public
```

**Do not run `npm publish` without explicit human approval (SP-226).**

## Post-publish

- [ ] Tag release in git (`v1.0.0`)
- [ ] Update pi.dev package listing (fields in [v1.0-checklist.md §pi.dev listing](v1.0-checklist.md#pidev-listing))
- [ ] Post-publish smoke per v1.0-checklist §Post-publish smoke
