# Architecture Patterns Reference

Grep commands, detection signals, and stub templates for auto-detecting project architecture.
Used by the `feature-scaffold` skill and architecture detection scripts.

---

## iOS Architectures

### TCA (The Composable Architecture)

**Detection greps:**
```bash
grep -rl "import ComposableArchitecture" . --include="*.swift" | wc -l
grep -rl "@Reducer" . --include="*.swift" | wc -l
grep -rl "ViewStore<" . --include="*.swift" | wc -l
grep -rl "Store<" . --include="*.swift" | wc -l
find . -name "*Feature.swift" | head -5
```

**Confidence scoring:**
- Any 2 of the above signals present → HIGH
- Only 1 signal → MEDIUM (could be partial migration)
- 0 signals → not TCA

**File naming conventions:**
- `{Feature}Feature.swift` — the Reducer
- `{Feature}View.swift` — the SwiftUI View
- `{Feature}Client.swift` — `@DependencyClient` for external services
- `{Feature}Tests.swift` — uses `TestStore`

**Directory structure (typical):**
```
Features/
└── Payment/
    ├── PaymentFeature.swift
    ├── PaymentView.swift
    └── PaymentClient.swift
```

**Stub template — PaymentFeature.swift:**
```swift
import ComposableArchitecture

@Reducer
struct PaymentFeature {
    @ObservableState
    struct State: Equatable {
        var isLoading = false
        // TODO: add state
    }

    enum Action {
        case loadTapped
        case dataLoaded(Result<PaymentData, Error>)
        // TODO: add actions
    }

    @Dependency(\.paymentClient) var paymentClient

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .loadTapped:
                state.isLoading = true
                return .run { send in
                    // TODO: call paymentClient
                }
            case .dataLoaded:
                state.isLoading = false
                return .none
            }
        }
    }
}
```

---

### VIPER

**Detection greps:**
```bash
find . -name "*Router.swift" | head -5
find . -name "*Presenter.swift" | head -5
find . -name "*Interactor.swift" | head -5
grep -rl "protocol.*RouterProtocol" . --include="*.swift" | head -3
grep -rl "protocol.*PresenterProtocol" . --include="*.swift" | head -3
grep -rl "protocol.*InteractorProtocol" . --include="*.swift" | head -3
```

**Confidence scoring:**
- `*Router.swift` + `*Presenter.swift` + `*Interactor.swift` all found → HIGH
- Any 2 of the 3 → HIGH
- Only `*Presenter.swift` → MEDIUM (could be MVP)
- 0 signals → not VIPER

**File naming conventions:**
- `{Feature}Router.swift`
- `{Feature}Presenter.swift`
- `{Feature}Interactor.swift`
- `{Feature}View.swift` (UIViewController)
- `{Feature}Entity.swift`

**Directory structure (typical):**
```
Modules/
└── Payment/
    ├── PaymentRouter.swift
    ├── PaymentPresenter.swift
    ├── PaymentInteractor.swift
    ├── PaymentViewController.swift
    └── PaymentEntity.swift
```

---

### Clean + MVVM (iOS)

**Detection greps:**
```bash
find . -name "*UseCase.swift" | head -5
find . -name "*Repository.swift" | head -5
find . -name "*ViewModel.swift" | head -5
find . -type d -name "Domain" | head -3
find . -type d -name "Data" | head -3
```

**Confidence scoring:**
- `*UseCase.swift` + `*Repository.swift` + `*ViewModel.swift` all found → HIGH
- UseCase + ViewModel (no explicit Repository) → MEDIUM
- Only ViewModel → falls through to plain MVVM

**File naming conventions:**
- `{Feature}UseCase.swift` (or `{Feature}UseCaseProtocol.swift` + `Default{Feature}UseCase.swift`)
- `{Feature}RepositoryProtocol.swift`
- `{Feature}Repository.swift`
- `{Feature}RequestDTO.swift` / `{Feature}ResponseDTO.swift`
- `{Feature}ViewModel.swift`
- `{Feature}View.swift`

**Directory structure (typical):**
```
Features/
└── Payment/
    ├── Domain/
    │   ├── PaymentUseCase.swift
    │   └── PaymentRepositoryProtocol.swift
    ├── Data/
    │   ├── PaymentRepository.swift
    │   ├── PaymentRequestDTO.swift
    │   └── PaymentResponseDTO.swift
    └── Presentation/
        ├── PaymentViewModel.swift
        └── PaymentView.swift
```

**Stub — PaymentViewModel.swift:**
```swift
import Foundation

@MainActor
@Observable
final class PaymentViewModel {
    private let useCase: PaymentUseCaseProtocol

    var isLoading = false
    var errorMessage: String?

    init(useCase: PaymentUseCaseProtocol) {
        self.useCase = useCase
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            // TODO: call useCase
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
```

---

### Plain MVVM (iOS)

**Detection greps:**
```bash
find . -name "*ViewModel.swift" | head -5
find . -name "*UseCase.swift" | wc -l   # expect 0
find . -name "*Repository.swift" | wc -l # expect 0
```

**Confidence scoring:**
- `*ViewModel.swift` found, UseCase count = 0, Repository count = 0 → MEDIUM (plain MVVM confirmed)
- ViewModel found alongside UseCase/Repository → upgrade to Clean+MVVM

**File naming conventions:**
- `{Feature}ViewModel.swift`
- `{Feature}View.swift`
- `{Feature}Model.swift`

---

## Android Architectures

### Clean + MVVM (Android)

**Detection greps:**
```bash
find . -name "*UseCase.kt" | head -5
find . -name "*Repository.kt" | head -5
find . -name "*RepositoryImpl.kt" | head -5
find . -name "*ViewModel.kt" | head -5
find . -type d -name "domain" | head -3
find . -type d -name "data" | head -3
find . -type d -name "presentation" | head -3
grep -rl "@HiltViewModel" . --include="*.kt" | head -3
```

**Confidence scoring:**
- `domain/`, `data/`, `presentation/` packages + UseCase + Repository + ViewModel all found → HIGH
- UseCase + Repository + ViewModel (no package structure) → MEDIUM
- Only ViewModel → falls through to plain MVVM

**File naming conventions:**
- `{Feature}UseCase.kt`
- `{Feature}Repository.kt` (interface)
- `{Feature}RepositoryImpl.kt`
- `{Feature}RequestDto.kt` / `{Feature}ResponseDto.kt`
- `{Feature}ViewModel.kt`
- `{Feature}Screen.kt` (Compose) or `{Feature}Fragment.kt` (Views)
- `{Feature}Module.kt` (Hilt DI module)

**Directory structure (typical):**
```
payment/
├── domain/
│   ├── PaymentUseCase.kt
│   └── PaymentRepository.kt
├── data/
│   ├── PaymentRepositoryImpl.kt
│   ├── PaymentRequestDto.kt
│   └── PaymentResponseDto.kt
├── presentation/
│   ├── PaymentViewModel.kt
│   └── PaymentScreen.kt
└── di/
    └── PaymentModule.kt
```

**Stub — PaymentViewModel.kt:**
```kotlin
@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val useCase: PaymentUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<PaymentUiState>(PaymentUiState.Loading)
    val uiState: StateFlow<PaymentUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.value = PaymentUiState.Loading
            // TODO: call useCase and update _uiState
        }
    }
}

sealed interface PaymentUiState {
    data object Loading : PaymentUiState
    data class Success(val data: Unit /* TODO */) : PaymentUiState
    data class Error(val message: String) : PaymentUiState
}
```

---

### MVI (Android)

**Detection greps:**
```bash
find . -name "*Intent.kt" | head -5
find . -name "*State.kt" | head -5
find . -name "*SideEffect.kt" | head -5
grep -rl "sealed interface.*Intent" . --include="*.kt" | head -3
grep -rl "sealed class.*Intent" . --include="*.kt" | head -3
```

**Confidence scoring:**
- `*Intent.kt` + `*State.kt` both found → HIGH
- `sealed.*Intent` pattern in ViewModel files → HIGH
- Only `*State.kt` → MEDIUM (could be Clean+MVVM with sealed state)

**File naming conventions:**
- `{Feature}Intent.kt` — sealed interface of user actions
- `{Feature}State.kt` — data class representing full UI state
- `{Feature}ViewModel.kt` — receives intents, emits state
- `{Feature}Screen.kt` — collects state and fires intents

**Stub — PaymentIntent.kt:**
```kotlin
sealed interface PaymentIntent {
    data object LoadPayment : PaymentIntent
    data class SubmitPayment(val amount: Double) : PaymentIntent
    // TODO: add intents
}
```

---

### Plain MVVM (Android)

**Detection greps:**
```bash
find . -name "*ViewModel.kt" | head -5
find . -name "*UseCase.kt" | wc -l    # expect 0
find . -name "*Repository.kt" | wc -l # expect 0 or only 1-2
```

**Confidence scoring:**
- ViewModel found, UseCase count = 0, no `domain/` package → MEDIUM (plain MVVM)

---

## Confidence Scoring

| Level | Meaning | Action |
|---|---|---|
| HIGH | 2+ independent structural signals agree | Generate immediately |
| MEDIUM | 1 signal or ambiguous structure | Generate with a note; offer to confirm |
| LOW | No clear signals, or conflicting patterns | Ask user before generating |

### Decision Tree

```
Has .xcodeproj / .xcworkspace?
└─ YES → iOS
   ├─ ComposableArchitecture import OR @Reducer found?
   │   └─ YES → TCA (HIGH if 2+ signals)
   ├─ *Router.swift + *Presenter.swift found?
   │   └─ YES → VIPER (HIGH if 2+ signals)
   ├─ *UseCase.swift + *Repository.swift + *ViewModel.swift found?
   │   └─ YES → Clean+MVVM (HIGH)
   ├─ *ViewModel.swift found (no UseCase/Repository)?
   │   └─ YES → Plain MVVM (MEDIUM)
   └─ Fallback → MVC (LOW — ask user)

Has build.gradle / build.gradle.kts?
└─ YES → Android
   ├─ domain/ + data/ + presentation/ packages?
   │   └─ YES → Clean+MVVM (HIGH if UseCase+Repository+ViewModel all present)
   ├─ *Intent.kt + *State.kt found?
   │   └─ YES → MVI (HIGH)
   ├─ *ViewModel.kt found (no UseCase/domain)?
   │   └─ YES → Plain MVVM (MEDIUM)
   └─ Fallback → ask user

Both present?
└─ Ask user which to scaffold, or run mobile-split for both in parallel
```

---

## Notes on Mixed Projects

Some projects migrate incrementally. Common signals of a migration in progress:
- Both `*Interactor.swift` (VIPER) and `*ViewModel.swift` (MVVM) present → ask user which pattern new features should follow
- Both `GlobalScope.launch` and `viewModelScope` in Android project → prefer `viewModelScope` for new code
- Mix of `LiveData` and `StateFlow` in Android → use `StateFlow` for new ViewModels

When in doubt, read the most recently modified feature file and match its pattern exactly.
