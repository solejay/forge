---
name: mobile-split
description: >
  Enhancement skill. Intercepts any task that has both iOS and Android work, 
  splits it into two parallel branches, routes each to the correct platform agent.
  Use as an enhancement layer on top of ultrawork for cross-platform codebases.
  Triggers on: "both platforms", "iOS and Android", "cross-platform", React Native, Flutter.
triggers: ["both platforms", "iOS and Android", "cross-platform", "React Native", "Flutter", "RN"]
version: 1.0.0
---

# Mobile Split — Platform Parallelism Enhancement

Sequential cross-platform work is wasted time. iOS and Android implementations
of the same feature are almost always fully independent. This skill splits them
and runs them in parallel.

## When to Apply This Skill

Apply mobile-split when the task contains ANY of:
- Explicit dual-platform reference: "fix on iOS and Android", "update both apps"
- React Native platform-specific code (`Platform.OS`, `.ios.tsx`, `.android.tsx`)
- Flutter platform channels or platform-specific widgets
- A task description that is clearly the same feature on two platforms

Do NOT apply when:
- The task is purely shared business logic with no platform-specific code
- The task is backend/API changes only
- Only one platform is mentioned

## Split Detection Logic

Scan the task prompt for platform signals:
```
iOS signals:   Swift, SwiftUI, UIKit, Xcode, .xcodeproj, AppDelegate, Info.plist,
               xcrun, simctl, iOS, iPhone, iPad, watchOS, tvOS
               
Android signals: Kotlin (in Android context), Compose, Gradle, AndroidManifest,
                 Activity, Fragment, ViewModel (Android), adb, Android Studio,
                 .apk, Play Store, minSdk
                 
RN signals:    metro, Expo, react-native, Platform.OS, .ios.tsx, .android.tsx,
               NativeModules, TurboModules
```

If BOTH iOS and Android signals present → **split mode**
If only one platform → **pass through** to `ios-engineer` or `android-engineer` directly

## Parallel Execution Pattern

When split mode is detected:

```
ORIGINAL TASK: "Fix push notification permission flow on iOS and Android"
                │
                ▼
        mobile-split detects dual-platform
                │
    ┌───────────┴────────────┐
    │                        │
    ▼                        ▼
delegate_to_agent(       delegate_to_agent(
  agent=                   agent=
  "ios-engineer",          "android-engineer",
  task=ios_prompt,         task=android_prompt,
  isolation="worktree"     isolation="worktree"
)                        )
    │                        │
    └───────────┬────────────┘
                ▼
        Synthesize results
        Check for consistency
        (same API contract? same UX flow?)
```

## Isolation Rule

For parallel implementation work, call `delegate_to_agent` with `isolation="worktree"` for each platform. This creates separate git worktrees and branches so the iOS and Android agents cannot overwrite each other's changes.

Use `isolation="none"` only for read-only exploration/debugging or when the repository is not a git checkout.

Stage 3 does **not** auto-merge worktree branches. After both agents finish, inspect each returned worktree path and branch, run validation, then merge manually.

## Prompt Construction Rules

When building the per-platform prompt, include:
1. The original task description
2. Platform constraint: "Implement this for iOS only / Android only"
3. Relevant shared context (API endpoints, data models, UX spec)
4. Explicit file paths if known

**Good iOS prompt:**
```
Implement push notification permission request flow for iOS.
Context: user taps "Enable Notifications" in Settings screen.
Flow: check current status → if notDetermined, request → handle granted/denied.
Use UNUserNotificationCenter. Update NotificationManager.swift.
The Android version is being handled separately — focus only on iOS.
```

**Good Android prompt:**
```
Implement push notification permission request flow for Android.
Context: user taps "Enable Notifications" in Settings screen.
Flow: check POST_NOTIFICATIONS permission (API 33+) → request if needed → handle result.
Use ActivityResultContracts.RequestPermission. Update NotificationViewModel.kt.
The iOS version is being handled separately — focus only on Android.
```

## React Native Split

For React Native, split by:
- **Platform-specific files** (`.ios.tsx`, `.android.tsx`) → split to each engineer
- **NativeModules / TurboModules** → split (each platform has its own native module)
- **Shared JS logic** → do NOT split, handle directly (no delegation needed)

```
RN task: "Fix camera permission on both platforms"
├── delegate_to_agent(agent="ios-engineer", task="update Info.plist NSCameraUsageDescription + iOS permission flow", isolation="worktree")
└── delegate_to_agent(agent="android-engineer", task="update AndroidManifest CAMERA permission + runtime request", isolation="worktree")
(shared): JS layer CameraPermission.ts stays in main executor
```

## Reviewer Merge Gate (Post-Parallel)

After both platform tasks complete, do not merge immediately. For each returned worktree, run `forge_review_worktree`:

1. `action="review"` to inspect changed files and diff stats.
2. `action="validate"` with platform-specific commands, for example `xcodebuild ... test` or `./gradlew test`.
3. `action="merge"` only when validation passes and the user wants the branch accepted.
4. `action="cleanup"` when the worktree is no longer needed.

## Consistency Check (Post-Parallel)

After both platform tasks complete and before merge, run a consistency check:
1. Do both implementations call the same API contract?
2. Do both handle the same error cases?
3. Is the UX flow equivalent (not necessarily identical — platform conventions differ)?
4. Are feature flags / AB test keys the same?

Report any inconsistencies as warnings. Do not block completion for UX differences
that are intentional (iOS uses sheets, Android uses bottom sheets — that's correct).

## Output Format

```
✅ mobile-split: Parallel execution complete

iOS:    [PASS/FAIL] {summary of what was done}
Android:[PASS/FAIL] {summary of what was done}

Consistency: {CONSISTENT/WARNING: {specific inconsistency}}

Files changed:
iOS:     {list}
Android: {list}

Worktrees:
iOS:     {path + branch + forge_review_worktree result}
Android: {path + branch + forge_review_worktree result}
```
