# Accessibility Standards Reference

## WCAG 2.1 AA Requirements

### Contrast Ratios
- Normal text: >= 4.5:1
- Large text (18pt+ or 14pt+ bold): >= 3:1
- UI components / graphical objects: >= 3:1

### Contrast Ratio Formula
```
L = 0.2126 * R + 0.7152 * G + 0.0722 * B  (where R,G,B are linearized)
ratio = (L1 + 0.05) / (L2 + 0.05)  (L1 = lighter, L2 = darker)
```

### Touch Target Minimums
| Platform | Minimum | Recommended | Source |
|---|---|---|---|
| iOS | 44x44 pt | 48x48 pt | Apple HIG |
| Android | 48x48 dp | 48x48 dp | Material Design |
| WCAG 2.5.8 | 24x24 CSS px | 44x44 CSS px | WCAG AAA |

## Platform-Specific Guidelines

### iOS (Apple HIG)
- VoiceOver: every control must be labeled
- Dynamic Type: all text must scale from xSmall to xxxLarge
- Reduce Motion: respect `UIAccessibility.isReduceMotionEnabled` / `@Environment(\.accessibilityReduceMotion)`
- Color: never use color as the only indicator
- Haptics: pair with visual feedback

### Android (Material Design)
- TalkBack: `contentDescription` on all non-text interactive elements
- Font scaling: text in `sp`, spacing in `dp`
- Reduce animations: respect `Settings.Global.ANIMATOR_DURATION_SCALE`
- Color: same as iOS — never color-only
- Switch Access: all controls reachable via switch navigation

## Success Criteria Quick Reference

| WCAG Criterion | Requirement | iOS API | Android API |
|---|---|---|---|
| 1.1.1 Non-text Content | Alt text for images | `.accessibilityLabel()` | `contentDescription` |
| 1.3.1 Info and Relationships | Semantic structure | `.accessibilityAddTraits(.isHeader)` | `Modifier.heading()` |
| 1.4.3 Contrast (Minimum) | 4.5:1 normal, 3:1 large | Named colors in asset catalog | `colors.xml` / Material tokens |
| 1.4.4 Resize Text | Up to 200% without loss | Dynamic Type support | `sp` units |
| 2.1.1 Keyboard | All operable by keyboard | Full VoiceOver traversal | TalkBack + Switch Access |
| 2.4.3 Focus Order | Logical focus sequence | `.accessibilitySortPriority()` | `Modifier.focusOrder()` |
| 2.5.5 Target Size | 44x44pt / 48x48dp | `.frame(minWidth:minHeight:)` | `Modifier.sizeIn()` |
| 4.1.2 Name, Role, Value | Programmatic name + role | `.accessibilityLabel() + .accessibilityAddTraits()` | `semantics { role = ... }` |

## Testing Tools
- iOS: Xcode Accessibility Inspector, VoiceOver (triple-click home/side)
- Android: TalkBack (Settings > Accessibility), Accessibility Scanner app
- Both: Manual traversal with screen reader is the gold standard
