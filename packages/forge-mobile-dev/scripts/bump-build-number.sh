#!/bin/bash
# scripts/bump-build-number.sh
# Bump iOS build number using best available strategy
# Usage: bash scripts/bump-build-number.sh [--strategy fastlane|agvtool|plist]
# If no strategy specified, tries each in order until one succeeds.

set -euo pipefail

STRATEGY="${1:-auto}"

bump_fastlane() {
  echo "Trying Fastlane increment_build_number..."
  bundle exec fastlane run increment_build_number 2>/dev/null && {
    echo "Bumped via Fastlane"
    return 0
  }
  return 1
}

bump_agvtool() {
  echo "Trying agvtool..."
  # Check if project is configured for apple-generic versioning
  if ! grep -rl "apple-generic" *.xcodeproj/project.pbxproj 2>/dev/null | grep -q .; then
    echo "agvtool not configured (no apple-generic versioning system)"
    return 1
  fi
  BUILD=$(agvtool what-version -terse 2>/dev/null)
  if [ -z "$BUILD" ]; then
    echo "agvtool: could not read current version"
    return 1
  fi
  NEW=$((BUILD + 1))
  agvtool new-version -all "$NEW" 2>/dev/null && {
    echo "Build: $BUILD → $NEW (agvtool)"
    return 0
  }
  return 1
}

bump_plist() {
  echo "Trying Info.plist direct edit..."
  PLIST=$(find . -name "Info.plist" \
    -not -path "*/DerivedData/*" \
    -not -path "*Tests*" \
    -not -path "*Pods*" \
    -not -path "*/build/*" | head -1)

  if [ -z "$PLIST" ]; then
    echo "ERROR: Info.plist not found"
    return 1
  fi

  CURRENT=$(/usr/libexec/PlistBuddy -c "Print CFBundleVersion" "$PLIST" 2>/dev/null)
  if [ -z "$CURRENT" ]; then
    echo "ERROR: CFBundleVersion not found in $PLIST"
    return 1
  fi

  NEW=$((CURRENT + 1))
  /usr/libexec/PlistBuddy -c "Set CFBundleVersion $NEW" "$PLIST"
  echo "Build: $CURRENT → $NEW ($PLIST)"
  return 0
}

case "$STRATEGY" in
  --strategy)
    # Handle --strategy flag format
    shift
    STRATEGY="$1"
    ;;
esac

case "$STRATEGY" in
  fastlane) bump_fastlane ;;
  agvtool)  bump_agvtool ;;
  plist)    bump_plist ;;
  auto)
    bump_fastlane || bump_agvtool || bump_plist || {
      echo "ERROR: All bump strategies failed" >&2
      exit 1
    }
    ;;
  *)
    echo "Usage: bump-build-number.sh [--strategy fastlane|agvtool|plist]"
    echo "Default: tries all strategies in order"
    exit 1
    ;;
esac
