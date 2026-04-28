# Project Setup Discovery

The `discover_mobile_project` tool (or the underlying discovery scripts) auto-detects project configuration when run from a project directory.

## What Gets Detected

### iOS (via `scripts/discover-ios-project.sh`)

| Field | Source | Fallback |
|-------|--------|----------|
| Project file | First `.xcworkspace` or `.xcodeproj` in cwd | — |
| Scheme | `xcodebuild -list` | `UnknownScheme` |
| Bundle ID | `Info.plist` → `CFBundleIdentifier`, then `project.pbxproj` | `com.yourcompany.yourapp` |
| Min iOS | `IPHONEOS_DEPLOYMENT_TARGET` in pbxproj | `17.0` |
| Package manager | Podfile → CocoaPods, Project.swift → Tuist, Package.swift → SPM | SPM |
| UI framework | Count `import SwiftUI` vs `import UIKit` across .swift files | SwiftUI |
| Architecture | TCA markers → TCA, VIPER markers → VIPER | MVVM |

### Android (via `scripts/discover-android-project.sh`)

| Field | Source | Fallback |
|-------|--------|----------|
| Build file | `app/build.gradle.kts` or `app/build.gradle` | — |
| Application ID | `applicationId` in build file | `com.yourcompany.yourapp` |
| Min SDK | `minSdk` in build file | `24` |
| Target SDK | `targetSdk` in build file | `34` |
| Modules | All directories with `build.gradle*` | — |
| UI framework | `compose` in dependencies → Compose, `res/layout/*.xml` → Views | Views |
| DI framework | hilt/koin/dagger in dependencies | None |

## How It Works in Pi

The `discover_mobile_project` tool (registered by the extension) wraps these scripts:

1. Checks cwd for `.xcodeproj`/`.xcworkspace` (iOS) or `build.gradle*` (Android)
2. Runs the matching discovery script(s)
3. Returns the discovered configuration as tool output

You can also run the scripts directly:
```bash
# iOS
bash scripts/discover-ios-project.sh

# Android
bash scripts/discover-android-project.sh
```

Or use the pi command:
```
/discover-project auto
```

## Override Values

If auto-detection gets something wrong, edit your project's `AGENTS.md` directly with the correct values. The extension's routing and persona injection use keyword detection from user prompts, not from AGENTS.md configuration values.
