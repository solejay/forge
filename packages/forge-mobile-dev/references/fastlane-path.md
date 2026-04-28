# Path A: Fastlane Deployment

Use this path when a `Fastfile` exists in the project (`fastlane/Fastfile` or `./Fastfile`).

## A1 — Discover available lanes

```bash
bundle exec fastlane lanes 2>/dev/null | grep -E "^\-\-|^lane "
```

Pick the lane matching user intent:

| Intent | Lane |
|---|---|
| TestFlight / beta | `ios beta` or `ios testflight` |
| App Store release | `ios release` or `ios deploy` |
| Play Store internal | `android internal` |

If no matching lane → offer to scaffold one (see Scaffold section below).

## A2 — Version bump

Run `bash scripts/bump-build-number.sh` before the lane, or let the lane handle it
if it calls `increment_build_number` internally.

## A3 — Run the lane

```bash
bundle exec fastlane ios beta 2>&1 | tee /tmp/fastlane_deploy.log
```

## A4 — Triage failures

```bash
tail -40 /tmp/fastlane_deploy.log
```

| Error | Fix |
|---|---|
| `No profiles for ... found` | Provisioning expired — regenerate in Apple Developer portal |
| `Code signing error` | Check `DEVELOPMENT_TEAM` in Xcode build settings |
| `Upload error 409` | Build number collision — bump again and retry |
| `App Store Connect API key missing` | Set `APP_STORE_CONNECT_API_KEY_KEY_ID`, `ISSUER_ID`, `KEY_FILEPATH` |
| `Could not find gem` | Run `bundle install` first |

## Scaffold Fastfile

If no suitable lane exists and the user wants Fastlane going forward:

```bash
mkdir -p fastlane

cat > fastlane/Fastfile << 'FASTFILE'
SCHEME = ENV["SCHEME"] || "YourApp"

platform :ios do
  desc "Upload to TestFlight"
  lane :beta do
    increment_build_number
    build_app(scheme: SCHEME, export_method: "app-store")
    upload_to_testflight(
      skip_waiting_for_build_processing: true,
      notify_external_testers: false
    )
  end
end
FASTFILE

cat > fastlane/Appfile << 'APPFILE'
# app_identifier("com.yourcompany.app")
# apple_id("your@email.com")
APPFILE

echo "fastlane/Fastfile created"
echo "Edit SCHEME and Appfile, then: bundle exec fastlane ios beta"
```
