---
name: crash-triage
description: >
  Analyze mobile crash reports, symbolicated stack traces, Crashlytics exports, 
  and Instruments traces to identify root cause and delegate targeted fixes.
  Triggers on: crash, stack trace, .crash file, Crashlytics, signal SIGSEGV, 
  EXC_BAD_ACCESS, ANR, fatal exception, OOM.
triggers: ["crash", "stack trace", "SIGSEGV", "EXC_BAD_ACCESS", "ANR", "fatal", "Crashlytics", "symbolicate", "tombstone"]
version: 1.0.0
---

# Crash Triage Skill

Implement the coordinator pattern for crash debugging:
Research (analyze crash) → Synthesize (identify root cause) → Delegate (targeted fix).

## Input Detection

Detect what type of crash data is provided:

| Input | Indicators |
|-------|-----------|
| iOS `.crash` file | `Hardware Model:`, `OS Version:`, `Exception Type:` |
| iOS Crashlytics | `Fatal Exception:`, `#0 0x`, `com.apple.` in frames |
| Android tombstone | `*** *** ***`, `pid:`, `signal`, `Abort message:` |
| Android Crashlytics | `Fatal Exception:`, `java.lang.`, `at com.` |
| Android ANR | `ANR in`, `Reason:`, `DALVIK THREADS:` |
| Instruments trace | `Time Profiler`, `Allocations`, Instruments XML/trace format |

## Phase 1: Symbolication

### iOS — symbolicate if needed
Raw crash frames look like: `0x000000010012ab34`
Symbolicated frames look like: `MyApp.PaymentViewController.processPayment() + 128`

```bash
# Check if crash is already symbolicated (look for method names in frames)
grep -c "+" crash.txt || echo "may need symbolication"

# Symbolicate using atos (requires dSYM)
# Find dSYM
find ~/Library/Developer/Xcode/Archives -name "*.dSYM" | head -5

# Symbolicate a specific frame
atos -arch arm64 -o {PATH_TO_DSYM}/Contents/Resources/DWARF/{BINARY_NAME} \
  -l {LOAD_ADDRESS} {FRAME_ADDRESS}

# Or use symbolicatecrash (comes with Xcode)
export DEVELOPER_DIR=$(xcode-select -p)
$DEVELOPER_DIR/Platforms/iPhoneOS.platform/Developer/Library/PrivateFrameworks/\
DVTFoundation.framework/symbolicatecrash crash.crash > symbolicated.crash
```

### Android — symbolicate native crashes
```bash
# For native crashes in .so files
ndk-stack -sym {PATH_TO_SYMBOLS} -dump tombstone.txt

# For Java/Kotlin crashes — no symbolication needed if ProGuard mapping available
# Apply ProGuard mapping:
retrace.sh mapping.txt stacktrace.txt
```

## Phase 2: Parse & Classify

Extract the crash signature:

### iOS Crash Parser
```bash
# Exception type
grep "Exception Type:" crash.txt

# Crashing thread
awk '/Thread [0-9]+ Crashed/,/Thread [0-9]+:/' crash.txt | head -20

# Top frame (most specific)
grep "^0 " crash.txt | head -1
```

### Crash Classification

| Pattern | Classification | Likely Cause |
|---------|---------------|--------------|
| `EXC_BAD_ACCESS (SIGSEGV)` | Memory | Dangling pointer, use-after-free, nil dereference |
| `EXC_BAD_ACCESS (SIGBUS)` | Memory | Unaligned memory access |
| `EXC_CRASH (SIGABRT)` | Assert/State | Failed assertion, NSException, precondition failure |
| `EXC_BREAKPOINT` | Swift | Swift runtime check failure (forced unwrap, OOB index) |
| `com.apple.main-thread-checker` | Threading | UI update off main thread |
| Android `NullPointerException` | Null safety | Missing null check, Kotlin nullable misuse |
| Android `IllegalStateException` | State | Wrong lifecycle state, fragment transaction after save |
| Android `OutOfMemoryError` | Memory | Memory leak, large bitmap, unbounded cache |
| Android ANR | Threading | Main thread blocked >5s |

## Phase 3: Synthesize Root Cause

Read the symbolicated stack trace. Identify:

1. **The crashing frame** — the specific file and line in YOUR code (not framework code)
2. **The trigger** — what user action or system event caused this call path
3. **The invariant violation** — what assumption was broken (nullable was nil, index was out of bounds, etc.)
4. **The frequency signal** — is this 100% reproducible or intermittent?

Write a concise root cause statement:
```
ROOT CAUSE: PaymentViewController.processPayment() force-unwraps self.currentCard 
at PaymentViewController.swift:142. This crashes when user navigates away before 
payment completes, deallocating the card reference. Fix: guard let or weak capture.
```

## Phase 4: Delegate Targeted Fix

Build a precise fix prompt for the platform agent. Include:
- File path and line number
- The exact crashing expression
- The invariant that was violated  
- The suggested fix approach
- Any relevant context (threading, lifecycle, state)

**Example iOS delegation:**

Use the `delegate_to_agent` tool:
```
delegate_to_agent(
  agent="ios-engineer",
  task="Fix crash in PaymentViewController.swift:142\n\nCRASH: Force unwrap of optional `currentCard` causes EXC_BREAKPOINT\nStack trace shows: PaymentViewController.processPayment() → line 142\n\nCurrent code:\n  let card = currentCard!  // line 142\n\nContext: This is called from a background URLSession completion handler.\nThe ViewController may have been deallocated by the time this runs.\n\nFix approach:\n1. Change to guard let: `guard let card = currentCard else { return }`\n2. Ensure the background handler captures [weak self]\n3. Add MainActor annotation to processPayment() or dispatch UI updates explicitly\n\nRun tests after fix: swift test --filter PaymentViewControllerTests"
)
```

## Phase 5: Verify Fix

After fix is applied:
1. Run the test suite targeting the fixed component
2. If crash was reproducible via a specific flow, document the reproduction steps
3. Check for related call sites that have the same pattern (search codebase for `currentCard!`)
4. Recommend adding a crash-prevention test:

```swift
// iOS: Test that processPayment handles nil currentCard gracefully
func testProcessPaymentWithNilCard() {
    let vc = PaymentViewController()
    vc.currentCard = nil
    XCTAssertNoThrow(vc.processPayment()) // should not crash
}
```

## Output Report

```markdown
# Crash Triage Report

## Crash Signature
- Platform: iOS/Android
- Exception: {type}
- Frequency: {if known}

## Root Cause
{1-3 sentence root cause statement}

## Crashing Frame
- File: {path}:{line}
- Expression: {the crashing code}
- Invariant violated: {what assumption broke}

## Fix Applied
{description of what was changed}

## Verification
- Tests run: {list}
- Result: PASS/FAIL
- Regression risk: LOW/MEDIUM/HIGH

## Recommendations
- {any related code patterns to audit}
- {suggested test to prevent regression}
```
