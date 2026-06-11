# npm publish checklist (Phase 22)

Pre-publish validation before `npm publish` (operator-triggered).

## Checklist

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` green
- [ ] `npm run coverage:check` green
- [ ] `package.json` `files` includes `bin/`, `src/`, `extensions/`, `skills/`, `templates/`
- [ ] Version bumped per semver
- [ ] README install section lists `npm install -g pi-spine` path
- [ ] `spine doctor` passes on clean consumer fixture after global install
- [ ] Real-pi adoption E2E report filed (optional but recommended)

## Commands

```bash
npm pack --dry-run
npm publish --access public
```

## Post-publish

- [ ] Tag release in git
- [ ] Update pi.dev package listing when available
