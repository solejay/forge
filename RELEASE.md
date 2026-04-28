# Forge Release Process

Forge uses a simple monorepo version policy.

## Version policy

- The root `package.json` version is the release version for the whole Forge monorepo.
- Package versions in `packages/*/package.json` should match the root version for tagged releases.
- Release tags use `vMAJOR.MINOR.PATCH`, for example `v0.1.0`.
- GitHub installs should prefer immutable tags for reproducibility:

```bash
pi install git:github.com/solejay/forge@v0.1.0
```

For active development, install `main`:

```bash
pi install git:github.com/solejay/forge
```

## Bump versions

Use:

```bash
scripts/bump-version.sh 0.2.0
```

This updates:

- root `package.json`
- `packages/forge-core/package.json`
- `packages/forge-design-studio/package.json`
- `packages/forge-mobile-dev/package.json`

It does not run `npm version`, does not create npm lockfiles, and does not create git tags.

## Release checklist

1. Update `CHANGELOG.md`.
2. Run smoke tests:

   ```bash
   npm run smoke
   ```

3. Commit changes.
4. Create an annotated tag:

   ```bash
   git tag -a v0.1.0 -m "Forge v0.1.0"
   ```

5. Push commit and tag:

   ```bash
   git push origin main
   git push origin v0.1.0
   ```

6. Optional GitHub release:

   ```bash
   gh release create v0.1.0 --title "Forge v0.1.0" --notes-file releases/v0.1.0.md
   ```

## Safety

Do not include secrets, API keys, local session files, private logs, or `pipeline/state.json` in releases.
