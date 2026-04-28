#!/bin/bash
# scripts/mobile-doctor.sh
# Diagnose forge-mobile-dev package installation and iOS/Android toolchain.
# Usage: bash scripts/mobile-doctor.sh
#
# Checks:
#   1. pi installation
#   2. forge-mobile-dev package loaded
#   3. Extension tools registered
#   4. Agent persona files present
#   5. Skills present
#   6. iOS toolchain (Xcode, simulators, SwiftLint)
#   7. Android toolchain (SDK, emulator, adb)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local status="$2"
  local detail="${3:-}"

  case "$status" in
    pass) echo -e "  ${GREEN}✅ $label${NC}"; ((PASS++)) ;;
    fail) echo -e "  ${RED}❌ $label${NC}"; [ -n "$detail" ] && echo -e "     ${RED}$detail${NC}"; ((FAIL++)) ;;
    warn) echo -e "  ${YELLOW}⚠️  $label${NC}"; [ -n "$detail" ] && echo -e "     ${YELLOW}$detail${NC}"; ((WARN++)) ;;
  esac
}

# ─── Resolve package directory ───────────────────────────────────────────
# Try to find the forge-mobile-dev package directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   forge-mobile-dev Diagnostic Report        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─── [1] Pi Installation ────────────────────────────────────────────────
echo -e "${BLUE}[1] Pi Installation${NC}"

if command -v pi &>/dev/null; then
  PI_VERSION=$(pi --version 2>/dev/null || echo "unknown")
  check "pi installed (version: $PI_VERSION)" pass
else
  check "pi not found" fail "Install with: npm install -g @mariozechner/pi-coding-agent"
fi

# ─── [2] Package Files ──────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[2] Package Files${NC}"

if [ -f "$PACKAGE_DIR/package.json" ]; then
  check "package.json found" pass
else
  check "package.json not found at $PACKAGE_DIR" fail
fi

if [ -f "$PACKAGE_DIR/extensions/forge-mobile/index.ts" ]; then
  check "Extension entry point (index.ts)" pass
else
  check "Extension entry point missing" fail \
    "Expected at $PACKAGE_DIR/extensions/forge-mobile/index.ts"
fi

for f in routing.ts guards.ts agents.ts; do
  if [ -f "$PACKAGE_DIR/extensions/forge-mobile/$f" ]; then
    check "Extension module: $f" pass
  else
    check "Extension module missing: $f" fail
  fi
done

for f in tools/mobile-loop.ts tools/project-discover.ts; do
  if [ -f "$PACKAGE_DIR/extensions/forge-mobile/$f" ]; then
    check "Tool: $f" pass
  else
    check "Tool missing: $f" fail
  fi
done

# ─── [3] Agent Personas ─────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[3] Agent Personas${NC}"

for agent in ios-engineer ios-debugger android-engineer android-debugger; do
  if [ -f "$PACKAGE_DIR/agents/$agent.md" ]; then
    check "$agent.md" pass
  else
    check "$agent.md missing" fail
  fi
done

# ─── [4] Skills ─────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[4] Skills${NC}"

SKILLS="mobile-loop mobile-split crash-triage swiftui-review mobile-deploy mobile-doctor testflight-ops feature-scaffold performance-audit code-signing-doctor accessibility-audit"
for skill in $SKILLS; do
  if [ -f "$PACKAGE_DIR/skills/$skill/SKILL.md" ]; then
    check "$skill" pass
  else
    check "$skill missing" fail \
      "Expected at $PACKAGE_DIR/skills/$skill/SKILL.md"
  fi
done

# ─── [5] Scripts ─────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[5] Scripts${NC}"

SCRIPTS="ios-mobile-loop.sh android-mobile-loop.sh discover-ios-project.sh discover-android-project.sh bump-build-number.sh mobile-doctor.sh"
for script in $SCRIPTS; do
  if [ -f "$PACKAGE_DIR/scripts/$script" ]; then
    if [ -x "$PACKAGE_DIR/scripts/$script" ]; then
      check "$script (executable)" pass
    else
      check "$script (not executable)" warn "Run: chmod +x $PACKAGE_DIR/scripts/$script"
    fi
  else
    check "$script missing" fail
  fi
done

# ─── [6] References ─────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[6] Reference Documents${NC}"

REFS="visual-checklist.md architecture-patterns.md accessibility-standards.md fastlane-path.md xcodebuildmcp-path.md project-setup.md"
for ref in $REFS; do
  if [ -f "$PACKAGE_DIR/references/$ref" ]; then
    check "$ref" pass
  else
    check "$ref missing" warn
  fi
done

# ─── [7] iOS Toolchain ──────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[7] iOS Toolchain${NC}"

if command -v xcodebuild &>/dev/null; then
  XCODE_VERSION=$(xcodebuild -version 2>/dev/null | head -1 || echo "unknown")
  check "Xcode ($XCODE_VERSION)" pass
else
  check "Xcode not found" fail "Install from Mac App Store or xcode-select --install"
fi

if command -v xcrun &>/dev/null; then
  check "xcrun available" pass
else
  check "xcrun not found" fail
fi

# Check for booted simulator
BOOTED_SIM=$(xcrun simctl list devices booted 2>/dev/null | grep "Booted" | head -1 || true)
if [ -n "$BOOTED_SIM" ]; then
  check "Simulator booted: $(echo "$BOOTED_SIM" | sed 's/^ *//')" pass
else
  # Check for any available simulator
  AVAIL_SIM=$(xcrun simctl list devices available 2>/dev/null | grep "iPhone" | head -1 || true)
  if [ -n "$AVAIL_SIM" ]; then
    check "No simulator booted (available: $(echo "$AVAIL_SIM" | sed 's/^ *//'))" warn \
      "Boot one with: xcrun simctl boot <UDID>"
  else
    check "No simulators available" fail "Install via Xcode > Settings > Platforms"
  fi
fi

if command -v swiftlint &>/dev/null; then
  SL_VERSION=$(swiftlint version 2>/dev/null || echo "unknown")
  check "SwiftLint ($SL_VERSION)" pass
else
  check "SwiftLint not installed" warn "Optional. Install with: brew install swiftlint"
fi

if command -v swift &>/dev/null; then
  SWIFT_VERSION=$(swift --version 2>/dev/null | head -1 | grep -o 'Swift version [0-9.]*' || echo "unknown")
  check "Swift ($SWIFT_VERSION)" pass
else
  check "Swift not found" fail
fi

# ─── [8] Android Toolchain ──────────────────────────────────────────────
echo ""
echo -e "${BLUE}[8] Android Toolchain${NC}"

if [ -n "${ANDROID_HOME:-}" ] || [ -n "${ANDROID_SDK_ROOT:-}" ]; then
  SDK_PATH="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  check "Android SDK ($SDK_PATH)" pass
else
  check "Android SDK not found" warn \
    "Set ANDROID_HOME or ANDROID_SDK_ROOT environment variable"
fi

if command -v adb &>/dev/null; then
  ADB_VERSION=$(adb version 2>/dev/null | head -1 || echo "unknown")
  check "adb ($ADB_VERSION)" pass
else
  check "adb not found" warn "Install Android SDK platform-tools"
fi

if command -v kotlin &>/dev/null; then
  check "Kotlin compiler available" pass
else
  check "Kotlin compiler not found" warn "Optional if using Gradle"
fi

if [ -f "./gradlew" ]; then
  check "Gradle wrapper (./gradlew) present" pass
elif command -v gradle &>/dev/null; then
  check "Gradle available (system)" pass
else
  check "Gradle not found" warn "Not needed if this isn't an Android project"
fi

if command -v ktlint &>/dev/null; then
  check "ktlint available" pass
else
  check "ktlint not installed" warn "Optional. Install with: brew install ktlint"
fi

# ─── [9] Optional Tools ─────────────────────────────────────────────────
echo ""
echo -e "${BLUE}[9] Optional Tools${NC}"

if command -v fastlane &>/dev/null || command -v bundle &>/dev/null; then
  check "Fastlane / Bundler available" pass
else
  check "Fastlane not found" warn "Optional. Install with: gem install fastlane"
fi

if command -v magick &>/dev/null; then
  check "ImageMagick (for screenshot resize)" pass
elif command -v sips &>/dev/null; then
  check "sips available (macOS, for screenshot resize)" pass
else
  check "No image resize tool" warn "Screenshots won't be resized to 1x"
fi

# ─── Summary ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: $PASS${NC}  ${YELLOW}Warnings: $WARN${NC}  ${RED}Failed: $FAIL${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo -e "${RED}Some checks failed. Fix the issues above and re-run:${NC}"
  echo -e "  bash scripts/mobile-doctor.sh"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}All critical checks passed. Some optional tools are missing.${NC}"
  exit 0
else
  echo ""
  echo -e "${GREEN}All checks passed! forge-mobile-dev is ready.${NC}"
  exit 0
fi
