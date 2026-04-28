---
name: mobile-deploy
description: >
  Deploy iOS app to TestFlight or Android app to Play Store internal track.
  Detects whether the project has Fastlane configured and routes accordingly.
  Falls back to xcodebuildmcp + ASC CLI if no Fastfile exists.
  Triggers on: TestFlight, Play Store, deploy, release, distribute, beta,
  fastlane, submit, ship, mobile-deploy.
triggers: ["TestFlight", "Play Store", "deploy", "release", "distribute", "beta", "fastlane", "submit", "ship", "mobile-deploy"]
version: 3.0.0
---

# Mobile Deploy

Two deployment paths. Detection runs first.

## Step 0: Detect Path

```bash
FASTFILE_PATH=""
[ -f "fastlane/Fastfile" ] && FASTFILE_PATH="fastlane/Fastfile"
[ -f "Fastfile" ]          && FASTFILE_PATH="Fastfile"
echo "Fastfile: ${FASTFILE_PATH:-NOT FOUND}"
```

- `FASTFILE_PATH` set → **Path A** (Fastlane) — see `references/fastlane-path.md`
- `FASTFILE_PATH` empty → **Path B** (xcodebuildmcp + ASC CLI) — see `references/xcodebuildmcp-path.md`

## Step 1: Version Bump

```bash
bash scripts/bump-build-number.sh
```

## Step 2: Deploy

Follow the appropriate path reference document.

## Step 3: Verify

On success, write deploy artifact to `.pi/artifacts/deploy/`:

```markdown
# Deploy: iOS v{version} (build {build})
Date: {timestamp}
Path: A (Fastlane) | B (xcodebuildmcp + ASC CLI)
Status: SUCCESS
Version: {marketing_version}
Build number: {build_number}
Destination: TestFlight internal
Check: asc builds list --bundle-id {bundle_id}
```

## Quick Error Reference

| Error | Fix |
|---|---|
| `No profiles for ... found` | Provisioning expired — regenerate in Apple Developer portal |
| `Code signing error` | Check `DEVELOPMENT_TEAM` in build settings |
| `Upload error 409` | Build number collision — bump again |
| `ASC API key missing` | Set `APP_STORE_CONNECT_API_KEY_KEY_ID`, `ISSUER_ID`, `KEY_FILEPATH` |
| `Authentication required` | Run `asc auth` |
| `Build already exists` | Bump build number and re-archive |
