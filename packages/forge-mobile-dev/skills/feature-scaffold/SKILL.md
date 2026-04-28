---
name: feature-scaffold
description: >
  Generate the full architecture stack for a new feature: protocols, repositories,
  use cases, view models, and views. Auto-detects project architecture
  (Clean/MVVM/VIPER/TCA for iOS, Clean/MVVM/MVI for Android) by reading existing
  code patterns. Triggers on: scaffold feature, new feature, create feature,
  generate feature, add feature module.
triggers: ["scaffold feature", "new feature", "create feature", "generate feature", "add feature module", "feature scaffold"]
version: 1.0.0
---

# Feature Scaffold

Generate a complete feature module following the project's existing architecture.

## Step 0: Detect Platform

Check the project root for platform markers:
- `.xcodeproj` or `.xcworkspace` present → iOS
- `build.gradle` or `build.gradle.kts` present → Android
- Both present → ask the user which platform to scaffold, or scaffold both in parallel via the `mobile-split` skill

## Step 1: Architecture Detection (iOS)

Scan existing source files. Do NOT rely on CLAUDE.md — detect from actual code.

### Detection Heuristics

| Architecture | Detection Signals | Confidence |
|---|---|---|
| TCA | `import ComposableArchitecture`, `@Reducer`, `Store<`, `ViewStore<` | Any 2 matches = HIGH |
| VIPER | `protocol.*Router`, `protocol.*Presenter`, `protocol.*Interactor`, `*Router.swift` | Any 2 matches = HIGH |
| Clean+MVVM | `Domain/`, `Data/`, `*UseCase.swift` + `*Repository.swift` + `*ViewModel.swift` | All 3 present = HIGH |
| MVVM | `*ViewModel.swift` without UseCase/Repository layers | = MEDIUM |
| MVC | UIViewController subclasses, no ViewModel pattern | Fallback = LOW |

### Detection Commands

```bash
# TCA markers
grep -rl "import ComposableArchitecture" . --include="*.swift" | head -3
grep -rl "@Reducer" . --include="*.swift" | head -3

# VIPER markers
find . -name "*Router.swift" | head -3
grep -rl "protocol.*Presenter" . --include="*.swift" | head -3

# Clean+MVVM markers
find . -name "*UseCase.swift" | head -3
find . -name "*Repository.swift" | head -3
find . -name "*ViewModel.swift" | head -3

# MVVM only (no domain layer)
find . -name "*ViewModel.swift" | head -3
find . -name "*UseCase.swift" | wc -l  # 0 = plain MVVM
```

## Step 1b: Architecture Detection (Android)

| Architecture | Detection Signals |
|---|---|
| Clean+MVVM | `domain/`, `data/`, `presentation/` packages; `*UseCase.kt`, `*Repository.kt`, `*ViewModel.kt` all present |
| MVI | `*Intent.kt`, `*State.kt`, `*SideEffect.kt`, sealed class event patterns |
| MVVM | `*ViewModel.kt` without UseCase/Repository layers |

```bash
# Clean+MVVM markers
find . -name "*UseCase.kt" | head -3
find . -name "*Repository.kt" | head -3

# MVI markers
find . -name "*Intent.kt" | head -3
find . -name "*State.kt" | head -3

# Check for Hilt vs Koin
grep -rl "@HiltViewModel" . --include="*.kt" | head -1
grep -rl "viewModel {" . --include="*.kt" | head -1  # Koin pattern
```

## Step 2: Discover Naming Conventions

Read 2–3 existing feature modules to extract:
- **File naming**: `PaymentViewModel.swift` vs `PaymentVM.swift`; `PaymentScreen.kt` vs `PaymentFragment.kt`
- **Directory structure**: flat (all files in one folder) vs nested (Domain/Data/Presentation subfolders), feature-per-folder vs layer-per-folder
- **Protocol naming** (iOS): `PaymentRepositoryProtocol` vs `PaymentRepositoring` vs `PaymentRepositoryType`
- **Import patterns**: Combine vs AsyncStream (iOS); Hilt vs Koin, StateFlow vs LiveData (Android)

```bash
# iOS: find an existing feature to use as reference
find . -name "*ViewModel.swift" | head -1

# Android: find an existing feature package
find . -path "*/presentation/*ViewModel.kt" | head -1
```

## Step 3: Generate Feature Stack

Each file is a compilable stub with `// TODO:` markers at integration points. No logic — just the skeleton.

### iOS — TCA Template

For feature name `{Feature}`:

```
{Feature}/
├── {Feature}Feature.swift          # @Reducer with State, Action, body
├── {Feature}View.swift             # View consuming Store<{Feature}Feature.State, {Feature}Feature.Action>
└── {Feature}Client.swift           # @DependencyClient for external data
```

**{Feature}Feature.swift stub:**
```swift
import ComposableArchitecture

@Reducer
struct {Feature}Feature {
    @ObservableState
    struct State: Equatable {
        // TODO: add state properties
    }

    enum Action {
        // TODO: add actions
    }

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            // TODO: handle actions
            }
        }
    }
}
```

---

### iOS — Clean + MVVM Template

```
{Feature}/
├── Domain/
│   ├── {Feature}UseCase.swift              # Protocol + concrete implementation
│   └── {Feature}RepositoryProtocol.swift   # Repository contract
├── Data/
│   ├── {Feature}Repository.swift           # Protocol implementation
│   ├── {Feature}RequestDTO.swift
│   └── {Feature}ResponseDTO.swift
├── Presentation/
│   ├── {Feature}ViewModel.swift            # @MainActor, @Observable
│   └── {Feature}View.swift                 # SwiftUI view + #Preview
└── Tests/
    └── {Feature}UseCaseTests.swift         # Stub with TODO
```

**{Feature}ViewModel.swift stub:**
```swift
import Foundation

@MainActor
@Observable
final class {Feature}ViewModel {
    private let useCase: {Feature}UseCaseProtocol

    init(useCase: {Feature}UseCaseProtocol) {
        self.useCase = useCase
    }

    // TODO: add @Published / observed properties and methods
}
```

---

### iOS — VIPER Template

```
{Feature}/
├── {Feature}Router.swift
├── {Feature}Presenter.swift
├── {Feature}Interactor.swift
├── {Feature}View.swift
└── {Feature}Entity.swift
```

---

### iOS — Plain MVVM Template

```
{Feature}/
├── {Feature}ViewModel.swift
├── {Feature}View.swift
└── {Feature}Model.swift
```

---

### Android — Clean + MVVM Template

```
{feature}/
├── domain/
│   ├── {Feature}UseCase.kt
│   └── {Feature}Repository.kt         # Interface
├── data/
│   ├── {Feature}RepositoryImpl.kt
│   ├── {Feature}RequestDto.kt
│   └── {Feature}ResponseDto.kt
├── presentation/
│   ├── {Feature}ViewModel.kt          # @HiltViewModel
│   └── {Feature}Screen.kt             # @Composable
└── di/
    └── {Feature}Module.kt             # @Module @InstallIn(SingletonComponent::class)
```

**{Feature}ViewModel.kt stub:**
```kotlin
@HiltViewModel
class {Feature}ViewModel @Inject constructor(
    private val useCase: {Feature}UseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<{Feature}UiState>({Feature}UiState.Loading)
    val uiState: StateFlow<{Feature}UiState> = _uiState.asStateFlow()

    // TODO: add methods and collect from useCase
}

sealed interface {Feature}UiState {
    data object Loading : {Feature}UiState
    data class Success(val data: Unit /* TODO */) : {Feature}UiState
    data class Error(val message: String) : {Feature}UiState
}
```

---

### Android — MVI Template

```
{feature}/
├── {Feature}Intent.kt                 # Sealed interface — user intents
├── {Feature}State.kt                  # Data class — full UI state
├── {Feature}ViewModel.kt              # Processes intents, emits state
└── {Feature}Screen.kt                 # @Composable
```

**{Feature}Intent.kt stub:**
```kotlin
sealed interface {Feature}Intent {
    // TODO: add user intents (e.g., data object LoadData : {Feature}Intent)
}
```

---

## Step 4: Delegate to Platform Agent

Use the `delegate_to_agent` tool:
```
delegate_to_agent(
  agent="ios-engineer",   // or "android-engineer"
  task="Create the following files for the {Feature} feature.
  Architecture: {detected architecture}
  Naming convention: {discovered from existing code — e.g., PaymentViewModel.swift}
  Directory layout: {flat | nested}

  Files to create:
  {file list with full stub contents}

  After creating all files, run:
    swift build                      // iOS
    ./gradlew assembleDebug          // Android
  to confirm the stubs compile without errors."
)
```

## Step 5: Verify

1. Confirm the build passes with no compilation errors
2. List all created files with their full paths

## Output Format

```
Feature Scaffold: {FeatureName}

Architecture: {detected} (confidence: HIGH / MEDIUM / LOW)
Platform: iOS / Android
Convention source: {existing feature used as naming reference}

Files created:
- {absolute/path/to/file1}
- {absolute/path/to/file2}
- ...

Build: PASS / FAIL
Next: implement business logic in {UseCase / Reducer / Interactor}
```

## Anti-Patterns

- Never hardcode architecture — always detect from source files before generating
- Never generate files that conflict with an existing module of the same name (check first)
- Never create test files beyond stubs — full test authoring is a separate concern
- If detection confidence is LOW, ask the user to confirm the architecture before proceeding

Also see: `references/architecture-patterns.md` for detailed detection rules and template stubs.
