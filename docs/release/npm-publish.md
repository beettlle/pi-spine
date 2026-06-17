# npm publish checklist (Phase 22 / Phase 26)

Pre-publish validation before `npm publish` (operator-triggered). SP-242 completed pre-release + dry-run; execution completed SP-226 (2026-06-17).

## Checklist

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` green — 880/880 (2026-06-17)
- [x] `npm run coverage:check` green — ~86.75% line (threshold 77%)
- [x] `package.json` `files` includes `bin/`, `src/`, `extensions/`, `skills/`, `templates/`, `scripts/coverage-parse.mjs`
- [x] Version bump decision documented — **`1.0.0`** initial; **`1.0.1`** hotfix for missing `coverage-parse.mjs` in tarball
- [x] `package.json` version set to `1.0.1` on `main`
- [x] README install section lists `npm install -g pi-spine` and `pi install npm:pi-spine`
- [x] `spine doctor` passes after global install of `pi-spine@1.0.1` (2026-06-17)
- [x] CI publish workflow (`.github/workflows/publish.yml`) uses `NPMSECRET` after green CI on `main`
- [ ] Real-pi adoption E2E report filed (optional but recommended)

## Dry-run pack (SP-242, 2026-06-14)

```bash
npm pack --dry-run
```

## Publish (SP-226, 2026-06-17)

- Operator approval recorded in release docs
- `pi-spine@1.0.0` published manually (browser 2FA); broken global install (missing `scripts/coverage-parse.mjs`)
- `pi-spine@1.0.1` published via GitHub Actions (`publish.yml`, `--ignore-scripts` after CI gate)
- Post-publish smoke: `npm install -g pi-spine@1.0.1`, `spine version`, `spine doctor` — pass

## pi.dev

- Package page: https://pi.dev/packages/pi-spine
- Install: `pi install npm:pi-spine`
