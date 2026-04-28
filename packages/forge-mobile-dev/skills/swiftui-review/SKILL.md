---
name: swiftui-review
description: >
  Review SwiftUI code for view decomposition, state management correctness,
  rendering performance, accessibility, and layout polish. Use after implementing
  SwiftUI features or when auditing existing SwiftUI code quality.
  Triggers on: review SwiftUI, SwiftUI audit, view decomposition, state management review.
triggers: ["review SwiftUI", "SwiftUI audit", "view decomposition", "state management review", "SwiftUI performance"]
version: 1.0.0
---

# SwiftUI Code Review

Systematic review checklist for SwiftUI code quality.

## 1. View Decomposition

- [ ] Views are under ~50 lines of body content
- [ ] Repeated UI patterns extracted into reusable subviews
- [ ] View modifiers extracted where they form logical groups
- [ ] No deeply nested closures (>3 levels) in body
- [ ] Preview provided with `#Preview` macro (not deprecated `PreviewProvider`)

## 2. State Management

- [ ] Correct property wrapper for each use case:
  - `@State` — view-local, value type, owned by this view
  - `@Binding` — two-way reference to parent's state
  - `@StateObject` — view-local, reference type, created once
  - `@ObservedObject` — injected reference type, owned elsewhere
  - `@EnvironmentObject` — injected via environment
  - `@Environment` — system values (colorScheme, dismiss, etc.)
- [ ] `@StateObject` used (not `@ObservedObject`) when the view creates the object
- [ ] `@MainActor` on all `ObservableObject` subclasses
- [ ] No unnecessary `@Published` properties (only publish what views observe)
- [ ] `@Observable` macro preferred over `ObservableObject` for new code (iOS 17+)

## 3. Rendering Performance

- [ ] No `AnyView` in lists or hot paths (use `@ViewBuilder` or conditional views)
- [ ] `LazyVStack`/`LazyHStack` inside `ScrollView` for long lists (not plain `VStack`)
- [ ] `equatable()` on views with expensive body computation
- [ ] `drawingGroup()` on complex Canvas or Path-heavy views
- [ ] `GeometryReader` used sparingly — prefer layout priorities and flexible frames
- [ ] No unnecessary state changes triggering recomputation

## 4. Accessibility

- [ ] All interactive elements have `.accessibilityLabel()` where the visual label is unclear
- [ ] Images have `.accessibilityLabel()` or are marked `.accessibilityHidden(true)` if decorative
- [ ] Buttons use `.accessibilityHint()` for non-obvious actions
- [ ] Dynamic Type supported — no hardcoded font sizes; use `.font(.body)` etc.
- [ ] Color contrast meets WCAG AA (4.5:1 ratio for text)
- [ ] VoiceOver navigation order makes logical sense
- For a comprehensive multi-platform accessibility audit, use the **accessibility-audit** skill

## 5. Layout Correctness

- [ ] Safe area respected (no content behind notch/home indicator)
- [ ] Keyboard avoidance handled (`.scrollDismissesKeyboard()` or manual offset)
- [ ] Landscape orientation works or is explicitly locked
- [ ] iPad layout considered (sidebar, split view)
- [ ] Content doesn't clip at largest Dynamic Type sizes

## 6. Navigation

- [ ] Uses `NavigationStack` (not deprecated `NavigationView`)
- [ ] `NavigationPath` for programmatic navigation
- [ ] Deep links handled via `onOpenURL` or `NavigationPath` manipulation
- [ ] No double-push bugs (guard against repeated navigation triggers)

## Output Format

```
SwiftUI Review: {file or feature name}

Decomposition:  PASS / {issues}
State:          PASS / {issues}
Performance:    PASS / {issues}
Accessibility:  PASS / {issues}
Layout:         PASS / {issues}
Navigation:     PASS / {issues}

Critical: {list of blocking issues}
Suggested: {list of improvements}
```
