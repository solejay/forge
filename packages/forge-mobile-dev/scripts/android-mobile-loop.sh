#!/bin/bash
# scripts/android-mobile-loop.sh
# Android build → emulator → screenshot → log capture cycle
# Usage: bash scripts/android-mobile-loop.sh [--module app]
# Exit codes: 0=pass, 1=build-fail, 2=launch-fail, 3=screenshot-fail

set -euo pipefail

MODULE="${1:-app}"
SCREENSHOT_PATH="/tmp/forge_screen.png"

# --- Build ---
echo "Building $MODULE (debug)..."
BUILD_OUTPUT=$(./gradlew assembleDebug 2>&1) || {
  echo "$BUILD_OUTPUT" | grep -E "(error|FAILED)" >&2
  echo "BUILD FAILED" >&2
  exit 1
}
echo "$BUILD_OUTPUT" | grep -E "(BUILD SUCCESSFUL|warning)" | head -5
echo "Build: PASS"

# --- Check for running emulator ---
ADB_DEVICE=$(adb devices 2>/dev/null | grep -E "emulator|device$" | grep -v "List" | awk '{print $1}' | head -1)
if [ -z "$ADB_DEVICE" ]; then
  AVD=$(emulator -list-avds 2>/dev/null | head -1)
  if [ -z "$AVD" ]; then
    echo "ERROR: No AVD found. Create one in Android Studio." >&2
    exit 2
  fi
  echo "Starting emulator: $AVD"
  emulator -avd "$AVD" -no-snapshot-load &
  sleep 15
  ADB_DEVICE=$(adb devices 2>/dev/null | grep emulator | awk '{print $1}' | head -1)
fi
echo "Device: $ADB_DEVICE"

# --- Install and launch ---
echo "Installing..."
./gradlew installDebug 2>&1 | tail -3

PACKAGE=$(grep "applicationId" "$MODULE/build.gradle.kts" 2>/dev/null | grep -o '"[^"]*"' | tr -d '"' | head -1)
if [ -z "$PACKAGE" ]; then
  PACKAGE=$(grep "applicationId" "$MODULE/build.gradle" 2>/dev/null | grep -o "'[^']*'" | tr -d "'" | head -1)
fi

if [ -z "$PACKAGE" ]; then
  echo "ERROR: Could not determine applicationId" >&2
  exit 2
fi

LAUNCHER=$(adb -s "$ADB_DEVICE" shell cmd package resolve-activity --brief "$PACKAGE" 2>/dev/null | tail -1)
adb -s "$ADB_DEVICE" shell am start -n "$PACKAGE/$LAUNCHER" 2>/dev/null || \
  adb -s "$ADB_DEVICE" shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 2>/dev/null
sleep 2
echo "Launched: $PACKAGE"

# --- Screenshot ---
echo "Taking screenshot..."
adb -s "$ADB_DEVICE" exec-out screencap -p > "$SCREENSHOT_PATH" || {
  echo "ERROR: Screenshot failed" >&2
  exit 3
}
echo "Screenshot: $SCREENSHOT_PATH"

# --- Log capture ---
echo "Capturing logs..."
adb -s "$ADB_DEVICE" logcat -d "*:W" "$PACKAGE:V" 2>/dev/null | tail -50 > /tmp/forge_logcat.log || true
LOG_LINES=$(wc -l < /tmp/forge_logcat.log | xargs)
echo "Logs captured: $LOG_LINES relevant lines → /tmp/forge_logcat.log"

echo ""
echo "=== Mobile Loop Complete ==="
echo "Screenshot: $SCREENSHOT_PATH"
echo "Logs: /tmp/forge_logcat.log"
echo "Status: PASS"
exit 0
