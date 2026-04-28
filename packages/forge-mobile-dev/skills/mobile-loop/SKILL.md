---
name: mobile-loop
description: >
  Build, run, screenshot, and visually verify iOS or Android changes on simulator/emulator.
  Use when implementing or fixing UI features on mobile — any time you need to see what 
  the screen actually looks like. Triggers on: simulator, SwiftUI, Compose, layout, 
  render, screen, visual, UI bug, animation, navigation flow.
triggers: ["simulator", "SwiftUI", "Compose", "layout", "render", "visual", "screen", "preview"]
pipeline: [mobile-loop]
next-skill: mobile-loop
version: 2.0.0
---

# Mobile Loop

Close the build→run→see→fix cycle. Don't just check if the build passes — verify what the screen actually looks like.

## Flow

1. **Detect platform** — `.xcodeproj`/`.xcworkspace` → iOS. `build.gradle` → Android. Both → run both.
2. **Run the loop script:**
   - iOS: `bash scripts/ios-mobile-loop.sh [--scheme NAME] [--device "iPhone 16"]`
   - Android: `bash scripts/android-mobile-loop.sh [--module app]`
3. **Read the screenshot** at `/tmp/forge_screen.png` using vision capability
4. **Check against criteria** in `references/visual-checklist.md`
5. **Decide:**
   - All criteria met → report PASS with screenshot path
   - Issues found → delegate fix to `ios-engineer` or `android-engineer` with specific issue, then re-run loop
6. **Max 3 retry cycles** before escalating to user

## On Build Failure

- Extract error from script output
- Delegate fix to `ios-engineer` or `android-engineer` with exact error + file:line
- Re-run the loop script after fix

## Anti-Patterns

- Don't edit `.pbxproj` directly
- Don't assume bundle ID — scripts read it from Info.plist / build.gradle
- Don't send 3x screenshots to vision — scripts auto-resize to 1x
- Don't screenshot before app has rendered — scripts include sleep after launch
