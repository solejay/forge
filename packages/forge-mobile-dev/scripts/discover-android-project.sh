#!/bin/bash
# scripts/discover-android-project.sh
# Auto-detect Android project configuration from the current directory.
# Outputs key=value pairs to stdout. Used by the discover_mobile_project tool.
# Usage: eval "$(bash scripts/discover-android-project.sh)"

set -euo pipefail

# --- Find build file ---
BUILD_FILE=""
if [ -f "app/build.gradle.kts" ]; then
  BUILD_FILE="app/build.gradle.kts"
elif [ -f "app/build.gradle" ]; then
  BUILD_FILE="app/build.gradle"
elif [ -f "build.gradle.kts" ]; then
  BUILD_FILE="build.gradle.kts"
elif [ -f "build.gradle" ]; then
  BUILD_FILE="build.gradle"
fi

if [ -z "$BUILD_FILE" ]; then
  echo "# No Android project found in $(pwd)" >&2
  exit 1
fi
echo "BUILD_FILE=\"$BUILD_FILE\""

# --- Application ID ---
APP_ID=""
if [[ "$BUILD_FILE" == *.kts ]]; then
  APP_ID=$(grep "applicationId" "$BUILD_FILE" 2>/dev/null | grep -o '"[^"]*"' | tr -d '"' | head -1 || true)
else
  APP_ID=$(grep "applicationId" "$BUILD_FILE" 2>/dev/null | grep -o "'[^']*'" | tr -d "'" | head -1 || true)
fi
echo "APP_ID=\"${APP_ID:-com.yourcompany.yourapp}\""

# --- Min SDK ---
MIN_SDK=$(grep -E "minSdk\s*=" "$BUILD_FILE" 2>/dev/null | grep -o '[0-9]\+' | head -1 || true)
echo "MIN_SDK=\"${MIN_SDK:-24}\""

# --- Target SDK ---
TARGET_SDK=$(grep -E "targetSdk\s*=" "$BUILD_FILE" 2>/dev/null | grep -o '[0-9]\+' | head -1 || true)
echo "TARGET_SDK=\"${TARGET_SDK:-34}\""

# --- Module structure ---
MODULES=$(find . -maxdepth 2 -name "build.gradle.kts" -o -name "build.gradle" 2>/dev/null | \
  sed 's|/build.gradle.*||' | sed 's|^\./||' | sort -u | tr '\n' ',' | sed 's/,$//')
echo "MODULES=\"$MODULES\""

# --- UI framework ---
UI_FRAMEWORK="Views (XML)"
if grep -q "compose" "$BUILD_FILE" 2>/dev/null; then
  UI_FRAMEWORK="Jetpack Compose"
  # Check if also uses XML layouts
  XML_COUNT=$(find . -path "*/res/layout/*.xml" 2>/dev/null | wc -l | xargs)
  if [ "$XML_COUNT" -gt 0 ]; then
    UI_FRAMEWORK="Mixed (Compose + Views)"
  fi
fi
echo "UI_FRAMEWORK=\"$UI_FRAMEWORK\""

# --- Dependency injection ---
DI_FRAMEWORK="None detected"
if grep -q "hilt\|dagger.hilt" "$BUILD_FILE" 2>/dev/null; then
  DI_FRAMEWORK="Hilt"
elif grep -q "koin" "$BUILD_FILE" 2>/dev/null; then
  DI_FRAMEWORK="Koin"
elif grep -q "dagger" "$BUILD_FILE" 2>/dev/null; then
  DI_FRAMEWORK="Dagger"
fi
echo "DI_FRAMEWORK=\"$DI_FRAMEWORK\""
