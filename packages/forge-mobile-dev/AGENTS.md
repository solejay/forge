# Mobile Engineering Context

This project provides a pi package for mobile development (iOS & Android).

## Agent Routing Rules
- iOS implementation tasks (Swift, SwiftUI, UIKit, XCTest) → ios-engineer persona is injected automatically
- iOS debugging tasks (crashes, logs, memory, network) → ios-debugger persona
- Android implementation tasks (Kotlin, Compose, Gradle) → android-engineer persona
- Android debugging tasks (Logcat, ANR, LeakCanary) → android-debugger persona
- Dual-platform tasks → use mobile-split skill (parallel execution via delegate_to_agent)
- Any UI change → run mobile_loop tool after implementation (build + screenshot + verify)
- SwiftUI code quality → use swiftui-review skill
- Crash reports → use crash-triage skill
- Deployment → use mobile-deploy skill after tests pass
- TestFlight operations → use testflight-ops skill
- Extension issues → use mobile-doctor skill
- New feature modules → use feature-scaffold skill
- Performance analysis → use performance-audit skill
- Code signing issues → use code-signing-doctor skill
- Accessibility reviews → use accessibility-audit skill
- Animation/motion/haptics → use motion-design skill

## Conventions
- SwiftUI-first. No UIKit unless existing code requires it.
- @MainActor on all ObservableObject subclasses
- async/await over completion handlers
- No force unwraps. Use guard let or if let.
- No direct .pbxproj edits — the extension blocks them automatically.
- Compose-first for Android. No XML Views unless existing code requires it.
- StateFlow over LiveData for new ViewModels.
