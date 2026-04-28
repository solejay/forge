# Visual Verification Checklist

After capturing a screenshot via mobile-loop, analyze against these criteria.

## Layout
- [ ] Content is within safe area (no notch/home indicator overlap)
- [ ] No horizontal overflow or clipped text
- [ ] Spacing is consistent and aligned to grid
- [ ] Scroll content is reachable (not hidden behind tab bars or toolbars)

## Typography
- [ ] Text is readable at 1x resolution
- [ ] Dynamic Type: text scales without truncation at accessibility sizes
- [ ] No orphaned single words on a line (minor)

## Touch Targets
- iOS: minimum 44x44pt for all interactive elements
- Android: minimum 48x48dp for all interactive elements
- Adequate spacing between adjacent tap targets

## Platform Conventions
- iOS: navigation bar titles, back chevron, sheet presentations
- Android: top app bar, Material 3 components, bottom navigation

## Accessibility
- [ ] Sufficient color contrast (WCAG AA: 4.5:1 for text)
- [ ] Interactive elements have visible focus states
- [ ] Images have alt text / accessibility labels

## Severity Classification
| Severity | Definition | Action |
|----------|-----------|--------|
| **Blocking** | Unusable UI, overlapping controls, crash, blank screen | Fix before proceeding |
| **Minor** | Visual polish, spacing nit, non-ideal alignment | Log, fix if time permits |
