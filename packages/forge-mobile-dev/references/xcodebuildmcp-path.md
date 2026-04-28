# Path B: xcodebuildmcp + ASC CLI Deployment

Use this path when no `Fastfile` exists. Uses `xcodebuildmcp` to archive and `asc` (App Store Connect CLI) to upload.

## B1 — Verify tools (auto-install if missing)

### xcodebuildmcp

```bash
if ! command -v xcodebuildmcp > /dev/null 2>&1; then
  echo "xcodebuildmcp not found. Installing..."
  if command -v brew > /dev/null 2>&1; then
    brew tap getsentry/xcodebuildmcp 2>/dev/null \
    && brew install xcodebuildmcp 2>/dev/null \
    || brew install xcodebuildmcp 2>/dev/null \
    || {
      if command -v mint > /dev/null 2>&1; then
        mint install getsentry/xcodebuildmcp
      else
        ARCH=$(uname -m)
        BINARY_NAME="xcodebuildmcp-${ARCH}-apple-macosx"
        curl -sL "https://github.com/getsentry/xcodebuildmcp/releases/latest/download/${BINARY_NAME}" \
          -o /usr/local/bin/xcodebuildmcp \
        && chmod +x /usr/local/bin/xcodebuildmcp \
        || { echo "ERROR: Could not install xcodebuildmcp"; exit 1; }
      fi
    }
  fi
fi
xcodebuildmcp --help > /dev/null && echo "xcodebuildmcp: ready"
```

### ASC CLI

```bash
if ! command -v asc > /dev/null 2>&1; then
  echo "ASC CLI not found. Installing..."
  if command -v brew > /dev/null 2>&1; then
    brew install nicoverbruggen/tap/asc 2>/dev/null \
    || brew install asc 2>/dev/null \
    || {
      if command -v mint > /dev/null 2>&1; then
        mint install nicoverbruggen/asc
      else
        curl -sL https://github.com/nicoverbruggen/asc/releases/latest/download/asc \
          -o /usr/local/bin/asc && chmod +x /usr/local/bin/asc \
        || { echo "ERROR: Could not install ASC CLI"; exit 1; }
      fi
    }
  fi
fi
asc --version && echo "ASC CLI: ready"
```

### Verify authentication

```bash
asc apps list > /dev/null 2>&1 && echo "ASC: authenticated" || {
  echo "ASC CLI not authenticated. Running auth flow..."
  asc auth
}
```

## B2 — Discover project

```bash
xcodebuildmcp project discover-projs --search-path .
xcodebuildmcp session show-defaults
```

## B3 — Version bump

```bash
bash scripts/bump-build-number.sh
```

## B4 — Archive

```bash
xcodebuildmcp tools | grep -iE "archive|build|export"
xcodebuildmcp archive \
  --destination "generic/platform=iOS" \
  --archive-path /tmp/app.xcarchive \
  2>&1 | tee /tmp/archive.log
ls -la /tmp/app.xcarchive/
```

## B5 — Export IPA

```bash
cat > /tmp/ExportOptions.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store</string>
  <key>uploadSymbols</key>
  <true/>
  <key>compileBitcode</key>
  <false/>
</dict>
</plist>
EOF

xcodebuildmcp export-archive \
  --archive-path /tmp/app.xcarchive \
  --export-path /tmp/app-export \
  --export-options-plist /tmp/ExportOptions.plist \
  2>&1 | tee /tmp/export.log \
|| \
xcodebuild -exportArchive \
  -archivePath /tmp/app.xcarchive \
  -exportPath /tmp/app-export \
  -exportOptionsPlist /tmp/ExportOptions.plist \
  2>&1 | tee /tmp/export.log

IPA=$(find /tmp/app-export -name "*.ipa" | head -1)
echo "IPA: $IPA"
```

## B6 — Upload to TestFlight

```bash
asc auth || echo "Already authenticated"
asc apps list
asc builds upload --path "$IPA" 2>&1 | tee /tmp/asc_upload.log
asc builds list --limit 3
```

## ASC CLI Reference

```bash
asc apps list                       # your apps + bundle IDs
asc builds list --bundle-id <id>    # recent builds
asc builds upload --path <ipa>      # upload
asc testflight submit-for-review    # submit for external review
```

## Common ASC Errors

| Error | Fix |
|---|---|
| `Authentication required` | Run `asc auth` to sign in |
| `No suitable application records` | Bundle ID in IPA must match App Store Connect |
| `Build already exists` | Bump build number and re-archive |
| `Missing compliance` | Add `ITSAppUsesNonExemptEncryption = false` to Info.plist |
