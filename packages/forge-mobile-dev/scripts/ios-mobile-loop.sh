#!/bin/bash
# scripts/ios-mobile-loop.sh
# iOS build → simulator → screenshot → log capture cycle
# Usage: bash scripts/ios-mobile-loop.sh [--scheme SCHEME] [--device "iPhone 16"]
# Exit codes: 0=pass, 1=build-fail, 2=launch-fail, 3=screenshot-fail

set -euo pipefail

SCHEME="${1:---auto}"
DEVICE="${2:-iPhone 16}"
SCREENSHOT_PATH="/tmp/forge_screen.png"

# --- Auto-detect scheme if not provided ---
if [ "$SCHEME" = "--auto" ]; then
  SCHEME=$(xcodebuild -list 2>/dev/null | awk '/Schemes:/{found=1; next} found && /^[[:space:]]/{print; next} found{exit}' | head -1 | xargs)
  if [ -z "$SCHEME" ]; then
    echo "ERROR: No scheme found. Pass --scheme NAME" >&2
    exit 1
  fi
  echo "Auto-detected scheme: $SCHEME"
fi

# --- Build ---
echo "Building $SCHEME..."
BUILD_OUTPUT=$(xcodebuild \
  -scheme "$SCHEME" \
  -destination "platform=iOS Simulator,name=$DEVICE,OS=latest" \
  -configuration Debug \
  build \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO \
  2>&1) || {
  echo "$BUILD_OUTPUT" | grep -E "error:" >&2
  echo "BUILD FAILED" >&2
  exit 1
}
echo "$BUILD_OUTPUT" | grep -E "(BUILD SUCCEEDED|warning:)" | head -5
echo "Build: PASS"

# --- Boot simulator ---
UDID=$(xcrun simctl list devices booted -j | python3 -c \
  "import json,sys; d=json.load(sys.stdin); \
   devs=[v for vs in d['devices'].values() for v in vs if v['state']=='Booted']; \
   print(devs[0]['udid'] if devs else '')" 2>/dev/null)

if [ -z "$UDID" ]; then
  UDID=$(xcrun simctl list devices available -j | python3 -c \
    "import json,sys; d=json.load(sys.stdin); \
     devs=[v for vs in d['devices'].values() for v in vs \
           if '$DEVICE' in v['name'] and v['isAvailable']]; \
     print(devs[0]['udid'] if devs else '')" 2>/dev/null)
  if [ -z "$UDID" ]; then
    echo "ERROR: No available simulator matching '$DEVICE'" >&2
    exit 2
  fi
  echo "Booting simulator $UDID..."
  xcrun simctl boot "$UDID"
  open -a Simulator
  sleep 3
fi
echo "Simulator: $UDID"

# --- Install and launch ---
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "*.app" \
  -path "*/Debug-iphonesimulator/*" -newer /tmp/forge_build_marker 2>/dev/null | head -1)
# Fallback: find most recent .app
if [ -z "$APP_PATH" ]; then
  APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "*.app" \
    -path "*/Debug-iphonesimulator/*" 2>/dev/null | head -1)
fi

if [ -z "$APP_PATH" ]; then
  echo "ERROR: No .app bundle found in DerivedData" >&2
  exit 2
fi

BUNDLE_ID=$(plutil -extract CFBundleIdentifier raw "$APP_PATH/Info.plist" 2>/dev/null)
echo "Installing $BUNDLE_ID from $APP_PATH"
xcrun simctl install "$UDID" "$APP_PATH"
xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE_ID"
sleep 2

# --- Screenshot ---
echo "Taking screenshot..."
xcrun simctl io "$UDID" screenshot /tmp/forge_screen_3x.png || {
  echo "ERROR: Screenshot failed" >&2
  exit 3
}

# Resize to 1x to reduce token cost for vision
if command -v magick &>/dev/null; then
  magick /tmp/forge_screen_3x.png -resize 33.333% "$SCREENSHOT_PATH"
elif command -v sips &>/dev/null; then
  sips -Z 390 /tmp/forge_screen_3x.png --out "$SCREENSHOT_PATH" 2>/dev/null
else
  cp /tmp/forge_screen_3x.png "$SCREENSHOT_PATH"
fi

echo "Screenshot: $SCREENSHOT_PATH"

# --- Log capture (last 50 error/warning lines) ---
echo "Capturing logs..."
xcrun simctl spawn "$UDID" log stream \
  --predicate "subsystem == \"$BUNDLE_ID\" OR category == \"error\"" \
  --style compact --timeout 3 2>/dev/null | grep -E "(error|fault|warning)" | tail -50 > /tmp/forge_app.log || true

LOG_LINES=$(wc -l < /tmp/forge_app.log | xargs)
echo "Logs captured: $LOG_LINES relevant lines → /tmp/forge_app.log"

echo ""
echo "=== Mobile Loop Complete ==="
echo "Screenshot: $SCREENSHOT_PATH"
echo "Logs: /tmp/forge_app.log"
echo "Status: PASS"
exit 0
