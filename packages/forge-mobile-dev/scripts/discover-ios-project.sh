#!/bin/bash
# scripts/discover-ios-project.sh
# Auto-detect iOS project configuration from the current directory.
# Outputs key=value pairs to stdout. Used by the discover_mobile_project tool.
# Usage: eval "$(bash scripts/discover-ios-project.sh)"

set -euo pipefail

# --- Find project file ---
XCWORKSPACE=$(find . -maxdepth 2 -name "*.xcworkspace" -not -path "*/Pods/*" | head -1)
XCODEPROJ=$(find . -maxdepth 2 -name "*.xcodeproj" | head -1)

PROJECT_FILE="${XCWORKSPACE:-$XCODEPROJ}"
if [ -z "$PROJECT_FILE" ]; then
  echo "# No iOS project found in $(pwd)" >&2
  exit 1
fi
echo "PROJECT_FILE=\"$PROJECT_FILE\""

# --- Discover schemes ---
SCHEME=""
if [ -n "$XCWORKSPACE" ]; then
  SCHEME=$(xcodebuild -workspace "$XCWORKSPACE" -list 2>/dev/null | \
    awk '/Schemes:/{found=1; next} found && /^[[:space:]]/{gsub(/^[[:space:]]+/,""); print; next} found{exit}' | head -1)
else
  SCHEME=$(xcodebuild -project "$XCODEPROJ" -list 2>/dev/null | \
    awk '/Schemes:/{found=1; next} found && /^[[:space:]]/{gsub(/^[[:space:]]+/,""); print; next} found{exit}' | head -1)
fi
echo "SCHEME=\"${SCHEME:-UnknownScheme}\""

# --- Bundle ID ---
BUNDLE_ID=""
# Try Info.plist first
PLIST=$(find . -name "Info.plist" \
  -not -path "*/DerivedData/*" \
  -not -path "*Tests*" \
  -not -path "*Pods*" \
  -not -path "*/build/*" 2>/dev/null | head -1)
if [ -n "$PLIST" ]; then
  BUNDLE_ID=$(/usr/libexec/PlistBuddy -c "Print CFBundleIdentifier" "$PLIST" 2>/dev/null || true)
fi
# If it's a variable reference like $(PRODUCT_BUNDLE_IDENTIFIER), try pbxproj
if [[ "$BUNDLE_ID" == *'$('* ]] || [ -z "$BUNDLE_ID" ]; then
  if [ -n "$XCODEPROJ" ]; then
    BUNDLE_ID=$(grep -m1 "PRODUCT_BUNDLE_IDENTIFIER" "$XCODEPROJ/project.pbxproj" 2>/dev/null | \
      grep -o '"[^"]*"' | tr -d '"' | head -1 || true)
  fi
fi
echo "BUNDLE_ID=\"${BUNDLE_ID:-com.yourcompany.yourapp}\""

# --- Min iOS version ---
MIN_IOS=""
if [ -n "$XCODEPROJ" ]; then
  MIN_IOS=$(grep -m1 "IPHONEOS_DEPLOYMENT_TARGET" "$XCODEPROJ/project.pbxproj" 2>/dev/null | \
    grep -o '[0-9]\+\.[0-9]\+' | head -1 || true)
fi
echo "MIN_IOS=\"${MIN_IOS:-17.0}\""

# --- Package manager ---
PKG_MANAGER="Swift Package Manager"
if [ -f "Podfile" ] || [ -f "Podfile.lock" ]; then
  PKG_MANAGER="CocoaPods"
elif [ -f "Tuist/Config.swift" ] || [ -f "Project.swift" ]; then
  PKG_MANAGER="Tuist"
elif [ -f "Package.swift" ]; then
  PKG_MANAGER="Swift Package Manager"
fi
echo "PKG_MANAGER=\"$PKG_MANAGER\""

# --- UI framework ---
UI_FRAMEWORK="SwiftUI"
# Check for SwiftUI imports in Swift files
SWIFTUI_COUNT=$(grep -rl "import SwiftUI" --include="*.swift" . 2>/dev/null | wc -l | xargs)
UIKIT_COUNT=$(grep -rl "import UIKit" --include="*.swift" . 2>/dev/null | wc -l | xargs)
if [ "$UIKIT_COUNT" -gt "$SWIFTUI_COUNT" ] && [ "$SWIFTUI_COUNT" -eq 0 ]; then
  UI_FRAMEWORK="UIKit"
elif [ "$UIKIT_COUNT" -gt 0 ] && [ "$SWIFTUI_COUNT" -gt 0 ]; then
  UI_FRAMEWORK="Mixed (SwiftUI + UIKit)"
fi
echo "UI_FRAMEWORK=\"$UI_FRAMEWORK\""

# --- Architecture guess ---
ARCH="MVVM"
if grep -rl "ComposableArchitecture\|ReducerProtocol\|@Reducer" --include="*.swift" . 2>/dev/null | grep -q .; then
  ARCH="TCA"
elif grep -rl "protocol.*Router\|protocol.*Presenter\|protocol.*Interactor" --include="*.swift" . 2>/dev/null | grep -q .; then
  ARCH="VIPER"
fi
echo "ARCH=\"$ARCH\""
