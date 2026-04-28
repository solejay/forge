---
name: accessibility-audit
description: >
  Deep accessibility audit for iOS and Android apps: VoiceOver/TalkBack traversal
  order, Dynamic Type / font scaling, color contrast (WCAG AA), touch targets,
  semantic grouping, focus management. Triggers on: accessibility audit, VoiceOver,
  TalkBack, Dynamic Type, color contrast, WCAG, a11y, accessibility review.
triggers: ["accessibility audit", "VoiceOver", "TalkBack", "Dynamic Type", "color contrast", "WCAG", "a11y", "accessibility review"]
version: 1.0.0
---

# Accessibility Audit

Comprehensive accessibility audit across 6 dimensions for iOS and Android.
See `references/accessibility-standards.md` for WCAG thresholds and platform guidelines.

## Platform Detection
`.xcodeproj` → iOS, `build.gradle` → Android, both → both.

## Dimension 1: Screen Reader (VoiceOver / TalkBack)

### iOS Static Checks
- Every interactive element has `.accessibilityLabel()` or meaningful text
- Decorative images: `.accessibilityHidden(true)`
- Grouped content: `.accessibilityElement(children: .combine)`
- Custom gestures: `.accessibilityAction()`
- Reading order: `.accessibilitySortPriority()`
- Headings: `.accessibilityAddTraits(.isHeader)` on section headers

### Android Static Checks
- `contentDescription` on `ImageView` / `IconButton`
- `importantForAccessibility` for decorative elements
- Compose: `semantics { }` on custom components
- `Modifier.clearAndSetSemantics { }` for grouped content
- `Modifier.heading()` on section headers
- `android:labelFor` on `TextInputLayout` (Views)

### Detection Commands
```bash
# iOS: Find images without accessibility labels
grep -rn "Image(" --include="*.swift" . | grep -v "accessibilityLabel\|accessibilityHidden"

# iOS: Find buttons without labels
grep -rn "Button(" --include="*.swift" . | grep -v "accessibilityLabel"

# Android: Find Icon/Image without contentDescription
grep -rn "Icon(\|Image(" --include="*.kt" . | grep -v "contentDescription\|semantics"

# Android: Find ImageView without contentDescription (XML)
grep -rn "ImageView" --include="*.xml" . | grep -v "contentDescription"
```

## Dimension 2: Dynamic Type / Font Scaling

### iOS
- No hardcoded font sizes: grep for `.font(.system(size:` — should be `.font(.body)` etc.
- `.minimumScaleFactor()` where truncation matters
- `@ScaledMetric` for custom spacing that should scale
- Layout must not break at `.accessibilityExtraExtraExtraLarge`

### Android
- No hardcoded `sp` in Compose: check `fontSize = N.sp` — should use `MaterialTheme.typography`
- XML: `sp` for text (correct), `dp` for spacing
- `android:autoSizeTextType` for constrained text areas
- Layout survives Settings > Display > Font Size at maximum

### Detection Commands
```bash
# iOS: Find hardcoded font sizes
grep -rn "\.system(size:" --include="*.swift" .
grep -rn "Font\.custom.*size:" --include="*.swift" .

# Android: Find hardcoded text sizes in Compose
grep -rn "fontSize\s*=\s*[0-9]" --include="*.kt" .
```

## Dimension 3: Color Contrast (WCAG AA)

### Standards
- Normal text (< 18pt / 14pt bold): ratio >= 4.5:1
- Large text (>= 18pt or >= 14pt bold): ratio >= 3:1
- UI components and graphical objects: ratio >= 3:1

### Static Checks
- Extract color definitions from:
  - iOS: `Assets.xcassets/*/Contents.json` or `Color(red:green:blue:)` in code
  - Android: `colors.xml` or `Color(0xFF...)` in Compose
- Check text/background pairs against thresholds
- Dark mode variants must ALSO pass contrast checks
- Never convey information by color alone — add icons or patterns

See `references/accessibility-standards.md` for contrast ratio calculation formula.

## Dimension 4: Touch Targets

### Standards
| Platform | Minimum Size | Source |
|---|---|---|
| iOS | 44 x 44 pt | Apple HIG |
| Android | 48 x 48 dp | Material Design |

### iOS Checks
- Small buttons need: `.frame(minWidth: 44, minHeight: 44)` or `.contentShape(Rectangle())`
- Custom controls: adequate hit area
- Adjacent targets: >= 8pt spacing

### Android Checks
- Compose: `Modifier.sizeIn(minWidth = 48.dp, minHeight = 48.dp)`
- `Modifier.clickable()` with adequate size
- Views: `minHeight="48dp"` and `minWidth="48dp"`

### Detection Commands
```bash
# iOS: Find small explicit frames on interactive elements
grep -rn "\.frame(width:\s*[0-3][0-9]" --include="*.swift" .

# Android: Find small explicit sizes
grep -rn "\.size([0-3][0-9]\.dp)" --include="*.kt" .
```

## Dimension 5: Semantic Grouping

### iOS
- Related content grouped: `.accessibilityElement(children: .combine)`
- List items: each is one accessibility element
- Cards: single navigable unit
- Action + label combined

### Android
- Compose: `Modifier.semantics(mergeDescendants = true)` on containers
- Cards: `clickable` on surface, not individual children
- Related text: grouped as one `contentDescription`
- Live regions: `Modifier.liveRegion = LiveRegionMode.Polite` for dynamic content

## Dimension 6: Focus Management

### iOS
- `.focused()` for programmatic focus
- `@AccessibilityFocusState` for VoiceOver focus control
- After modal dismissal, focus returns to trigger element
- After navigation, focus moves to new screen title

### Android
- `FocusRequester` for programmatic focus in Compose
- `requestFocus()` in Views
- After dialog dismissal, focus returns appropriately
- `android:windowSoftInputMode` for keyboard focus

## Delegation

Delegate fixes to platform agents:
Use the `delegate_to_agent` tool:
```
delegate_to_agent(
  agent="ios-engineer",  // or "android-engineer"
  task="Fix accessibility issue: {description}
  File: {path}:{line}
  Current: {problematic_code}
  WCAG requirement: {standard}
  Fix: {approach}"
)
```

## Output Report

```markdown
# Accessibility Audit Report

Platform: iOS / Android / Both
WCAG Level: AA
Date: {timestamp}

| Dimension | Status | Issues | Severity |
|---|---|---|---|
| Screen Reader | PASS/WARN/FAIL | {count} | {highest} |
| Font Scaling | PASS/WARN/FAIL | {count} | {highest} |
| Color Contrast | PASS/WARN/FAIL | {count} | {highest} |
| Touch Targets | PASS/WARN/FAIL | {count} | {highest} |
| Semantic Grouping | PASS/WARN/FAIL | {count} | {highest} |
| Focus Management | PASS/WARN/FAIL | {count} | {highest} |

## Issues
{numbered list: file, line, issue, WCAG criterion, severity, fix}

## Score: {X}/6 dimensions passing
```
