# forge-mobile-dev

A [pi](https://github.com/badlogic/pi-mono) package for mobile engineering — iOS & Android agent routing, build loops, crash triage, deployment, and visual verification.

## Install

```bash
# From git
pi install git:github.com/yourorg/forge-mobile-dev

# Or locally during development
pi install -l .
```

## What's Included

### Extension (`extensions/forge-mobile/`)

A TypeScript extension that provides:

| Feature | Replaces | Description |
|---------|----------|-------------|
| **Input routing** | `mobile-keyword-detector.mjs` | Detects iOS/Android keywords in prompts, injects platform routing context |
| **pbxproj guard** | `pbxproj-guard.mjs` | Blocks direct `.pbxproj` edits with safe alternatives |
| **Lint guard** | `lint-guard.mjs` | Runs SwiftLint/ktlint after Swift/Kotlin file edits |
| **Agent personas** | `agents/*.md` | Injects ios-engineer/ios-debugger/android-engineer/android-debugger personas into system prompt |
| **`delegate_to_agent` tool** | — | Spawns focused pi sub-agents with specialist personas |
| **`mobile_loop` tool** | — | Build → simulator → screenshot → verify cycle |
| **`discover_mobile_project` tool** | — | Auto-detect scheme, bundle ID, architecture, etc. |
| **Forge design handoff** | — | Detects `pipeline/style-guide.json`, `copy-deck.json`, `screens/`, and injects them as implementation source of truth |

### Skills (`skills/`)

11 skills loaded automatically by pi:

| Skill | Trigger | Description |
|-------|---------|-------------|
| `mobile-loop` | UI changes | Build → run → screenshot → verify cycle |
| `mobile-split` | Dual-platform tasks | Split iOS + Android work in parallel |
| `crash-triage` | Crash reports, stack traces | Parse, symbolicate, root-cause, fix |
| `swiftui-review` | SwiftUI code review | 6-dimension quality checklist |
| `mobile-deploy` | Deploy, release, ship | TestFlight / Play Store deployment |
| `mobile-doctor` | Extension issues | Diagnose toolchain problems |
| `testflight-ops` | TestFlight management | Build status, beta groups, release notes |
| `feature-scaffold` | New feature module | Auto-detect architecture, generate stubs |
| `performance-audit` | Performance issues | 6-dimension performance analysis |
| `code-signing-doctor` | Code signing errors | Certificate, profile, entitlement diagnosis |
| `accessibility-audit` | Accessibility review | 6-dimension WCAG AA audit |
| `motion-design` | Animation, transitions, haptics | Dual-platform motion system + generated code |

### Commands

| Command | Description |
|---------|-------------|
| `/mobile-doctor` | Diagnose mobile toolchain |
| `/mobile-loop [ios\|android]` | Run build → screenshot → verify |
| `/discover-project [ios\|android\|auto]` | Detect project configuration |

### Scripts (`scripts/`)

Shell scripts used by the extension and skills:

- `ios-mobile-loop.sh` — iOS build → install → screenshot
- `android-mobile-loop.sh` — Android equivalent
- `discover-ios-project.sh` — Auto-detect iOS project config
- `discover-android-project.sh` — Auto-detect Android project config
- `bump-build-number.sh` — Increment build number
- `mobile-doctor.sh` — Toolchain diagnostics

### References (`references/`)

Documentation used by skills:

- `visual-checklist.md` — Screenshot verification criteria
- `architecture-patterns.md` — Architecture detection rules and templates
- `accessibility-standards.md` — WCAG thresholds and platform guidelines
- `fastlane-path.md` — Fastlane deployment path
- `xcodebuildmcp-path.md` — xcodebuild deployment path
- `project-setup.md` — Project configuration reference

## How It Works

### Automatic Routing

When you type a prompt, the extension scores it against weighted keyword lists:

```
"fix the SwiftUI layout bug in the payment screen"
  → iOS score: 5 (swiftui=3, swift=2) → ios-engineer persona injected
  → Mobile loop: "layout" + "screen" → visual verification suggested

"fix push notifications on iOS and Android"
  → iOS score: 4, Android score: 4 → mobile-split skill recommended
  → Parallel delegation via delegate_to_agent tool

"the app crashes when tapping checkout"
  → Crash score: 2 → crash-triage skill recommended

"add entrance animations and haptic feedback to the dashboard"
  → Motion score: 8 + iOS score: detected → motion-design skill recommended

"deploy to TestFlight"
  → Deploy score: 5 → mobile-deploy skill recommended
```

### Agent Personas

The extension loads 4 specialist personas from `agents/`:

- **ios-engineer** — Swift 6, SwiftUI, async/await, XCTest, xcodebuild
- **ios-debugger** — LLDB, simulator diagnostics, memory/network debugging
- **android-engineer** — Kotlin, Jetpack Compose, Hilt, Room, Gradle
- **android-debugger** — Logcat, ANR diagnosis, LeakCanary, thread analysis

Personas are injected into the system prompt automatically, or used as system prompts for sub-agents via `delegate_to_agent`.

### Forge Design Handoff

When a mobile project contains design artifacts from `forge-design-studio`, the extension detects them on startup and injects handoff context before the agent starts:

- `pipeline/style-guide.json` → design tokens for SwiftUI / Compose
- `pipeline/copy-deck.json` → strings and state copy
- `pipeline/screens/*.png` → visual reference
- `pipeline/backend-api-spec.json` → networking/API contracts
- `pipeline/state.json` → Forge world state shared by `forge-core`

### Visual Verification Loop

After any UI change, the `mobile_loop` tool:
1. Builds the app via xcodebuild/Gradle
2. Installs on simulator/emulator
3. Takes a screenshot (auto-resized to 1x for token efficiency)
4. Returns the screenshot as an image for the model to verify
5. Captures and returns app logs

## Prerequisites

- **iOS**: Xcode, simulator, `xcrun simctl`
- **Android**: Android SDK, emulator, `adb`
- **Optional**: SwiftLint (`brew install swiftlint`), ktlint
- **Optional**: Fastlane (`bundle exec fastlane`)

## Development

```bash
# Test the extension locally
pi -e ./extensions/forge-mobile/index.ts

# Or install as a local package
pi install -l .
```

## Architecture (for contributors)

```
extensions/forge-mobile/
├── index.ts              # Entry point — wires everything together
├── routing.ts            # Keyword scoring + context building
├── guards.ts             # pbxproj guard + lint guard
├── agents.ts             # Persona loader + delegate_to_agent tool
└── tools/
    ├── mobile-loop.ts    # Build → screenshot → verify tool
    └── project-discover.ts  # Auto-detect project config tool
```

The extension registers:
- 3 event handlers: `input` (routing), `tool_call` (pbxproj guard), `tool_result` (lint guard)
- 2 lifecycle handlers: `before_agent_start` (persona injection + design handoff)
- 3 tools: `delegate_to_agent`, `mobile_loop`, `discover_mobile_project`
- 3 commands: `/mobile-doctor`, `/mobile-loop`, `/discover-project`
- 1 message renderer: `forge-mobile-routing`
- 1 status widget: platform indicator (📱 iOS / Android / both)

## License

MIT
