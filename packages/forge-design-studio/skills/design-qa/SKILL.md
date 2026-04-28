---
name: design-qa
description: >
  Quality audit for rendered screen mockups. Reviews every screen against
  visual design standards. Catches missing images, wrong colors, cramped layouts,
  and generic-looking UIs before the user sees them.
  Triggers on: design QA, review designs, check screens, design review, visual audit, design quality.
triggers: ["design QA", "review designs", "check screens", "design review", "visual audit", "design quality"]
version: 1.0.0
---

# Design QA — Visual Quality Audit

Review every rendered screen mockup against the visual design standards. Catch and fix issues before presenting to the user.

## Inputs

- `pipeline/screens/*.png` — the rendered screen mockups
- `pipeline/style-guide.json` — the expected design tokens
- `pipeline/copy-deck.json` — the expected copy
- `references/visual-design-standards.md` — the quality bar

## Process

### 1. Inventory Check

```bash
echo "=== Screen Inventory ==="
find pipeline/screens -name "*.png" -type f | sort
TOTAL=$(find pipeline/screens -name "*.png" -type f | wc -l | tr -d ' ')
echo "Total: $TOTAL screens"
```

Verify:
- [ ] Every screen from `pipeline/design-brief.json` has at least a populated-state render
- [ ] Both light AND dark variants exist for every screen
- [ ] Empty, loading, and error states exist for key screens

### 2. Visual Inspection

Read each screen PNG and check against this checklist:

**Visual Impact (must pass ALL):**
- [ ] First viewport is visually compelling — not empty/sparse
- [ ] Headlines are large and bold (28pt+ Bold/Black)
- [ ] At least 2 elevation levels visible (background + cards)
- [ ] Content organized in cards, not raw text on flat background
- [ ] At least one non-list layout element (carousel, hero card, featured item)

**Color & Theme:**
- [ ] Accent color matches style-guide.json
- [ ] Accent is muted/sophisticated — NOT saturated primary
- [ ] Light: off-white background with white card surfaces
- [ ] Dark: warm near-black background with surface-color depth (no shadows)
- [ ] Only ONE accent color used (plus semantic colors)
- [ ] Dark mode looks intentionally designed, not auto-inverted

**Typography:**
- [ ] Full type scale used: Display → Title → Body → Caption (not all same size)
- [ ] Body text is left-aligned
- [ ] Bold headlines, Regular body — clear weight hierarchy
- [ ] Comfortable line heights

**Spacing:**
- [ ] Screen horizontal padding is 20-24px
- [ ] Section gaps are 28-40px
- [ ] Card padding is 16-24px
- [ ] Nothing feels cramped

**Components:**
- [ ] Buttons are 48-56px height
- [ ] Filter chips are pill-shaped
- [ ] Search bars use filled background (not just border)
- [ ] Tab bar has 3-5 items with clean icons
- [ ] Cards have proper radius (16-24px) and elevation

**Content:**
- [ ] Real content — no "Lorem ipsum", no "Button", no gray placeholders
- [ ] Copy matches `pipeline/copy-deck.json`
- [ ] Images look contextually appropriate (not random)

**Device Chrome:**
- [ ] Status bar present (9:41 AM)
- [ ] Dynamic Island visible (not notch)
- [ ] Home indicator at bottom
- [ ] Correct nav chrome for screen type (root vs pushed vs modal)

**Empty/Error States:**
- [ ] Empty states have illustration + headline + body + CTA (not just text)
- [ ] Error states are sympathetic, not alarming
- [ ] Loading states show skeleton shimmer or spinner

### 3. Fix and Regenerate

For each failing screen:
1. Identify the specific issue
2. Adjust the screen prompt in `pipeline/screen-prompts/`
3. Re-render via nano-banana
4. Re-check until it passes

### 4. Common Issues and Fixes

| Issue | Prompt Fix |
|-------|-----------|
| Cramped layout | Increase spacing values in the prompt ("32pt between sections") |
| Wrong colors | Double-check hex values against style-guide.json |
| Generic/template look | Add more specific layout patterns from category blueprint |
| Missing elevation | Add explicit shadow specs or surface color specs |
| Timid typography | Increase headline sizes, specify Bold/Black weight |
| Centered body text | Add "left-aligned" to body text specs |
| Saturated accent | Replace with muted variant from standards |
| Dark mode = inverted | Write dark-specific prompt, don't rely on color swap |

## Output

After all screens pass QA:

```markdown
## Design QA Report

Total screens: [N]
Passed: [N] | Fixed and re-rendered: [N] | Remaining issues: [N]

| Screen | State | Theme | Status | Notes |
|--------|-------|-------|--------|-------|
| Home | populated | light | ✅ | — |
| Home | populated | dark | ✅ | Fixed: cramped spacing |
| Home | empty | light | ✅ | — |
| ... | | | | |

Quality bar: references/visual-design-standards.md
All screens validated against checklist.
```
