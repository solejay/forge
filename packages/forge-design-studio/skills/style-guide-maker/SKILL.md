---
name: style-guide-maker
description: >
  Creates a complete design token system from a design brief.
  Produces style-guide.json with color, typography, spacing, radius, elevation,
  and component tokens for both light and dark themes.
  Triggers on: style guide, design tokens, create style guide, color system, typography system.
triggers: ["style guide", "design tokens", "create style guide", "color system", "typography system"]
version: 1.0.0
---

# Style Guide Maker

Create the complete design token system that drives all screen generation.

## Inputs

- `pipeline/design-brief.json` — theme, accent color, typography direction
- `references/visual-design-standards.md` — the aesthetic rules and constraints

## Process

### 1. Build Color System

From the brief's accent color, derive the full palette:

**Light theme:**
- `background`: Off-white (never pure `#FFFFFF`) — `#F5F7FA` or `#F2F2F7`
- `surface`: Pure white `#FFFFFF` (for cards floating on background)
- `textPrimary`: Near-black (`#1A1A2E` or `#1C1C1E`)
- `textSecondary`: Warm gray (`#8E8E93` or `#6B7280`)
- `textTertiary`: Light gray (`#C7C7CC`)
- `accent`: From brief (must be muted/sophisticated)
- `accentLight`: Accent at 10-15% opacity for backgrounds
- `separator`: `#3C3C43` at 12% opacity
- `success`, `warning`, `error`, `info`: From standards

**Dark theme:**
- `background`: Warm near-black (`#0D0D0D` or `#111111`)
- `surface`: `#1C1C1E`
- `surfaceElevated`: `#2C2C2E`
- `textPrimary`: `#FFFFFF` at 95% opacity
- `textSecondary`: `#8E8E93`
- `accent`: May need slight lightening for contrast on dark
- Same semantic colors adjusted for dark

### 2. Build Typography Scale

Use the brief's font choice. Define every level:

```json
{
  "display":  { "size": 38, "weight": "Black",    "lineHeight": 1.1, "tracking": -0.5 },
  "title1":   { "size": 30, "weight": "Bold",     "lineHeight": 1.15, "tracking": 0 },
  "title2":   { "size": 22, "weight": "Semibold",  "lineHeight": 1.2, "tracking": 0 },
  "title3":   { "size": 19, "weight": "Semibold",  "lineHeight": 1.25, "tracking": 0 },
  "body":     { "size": 17, "weight": "Regular",   "lineHeight": 1.5, "tracking": 0 },
  "callout":  { "size": 15, "weight": "Regular",   "lineHeight": 1.4, "tracking": 0 },
  "caption":  { "size": 12, "weight": "Regular",   "lineHeight": 1.3, "tracking": 0.5 },
  "micro":    { "size": 10, "weight": "Medium",    "lineHeight": 1.2, "tracking": 1.0 }
}
```

### 3. Build Spacing Tokens

```json
{
  "screenPadding": 24,
  "sectionGap": 32,
  "itemGap": 12,
  "cardPadding": 20,
  "cardPaddingCompact": 16,
  "topBreathing": 48,
  "gridUnit": 8
}
```

### 4. Build Corner Radius Tokens

```json
{
  "micro": 6,
  "small": 999,
  "medium": 14,
  "large": 20,
  "xl": 28
}
```
(`999` = pill shape / half-height)

### 5. Build Elevation Tokens

**Light:**
```json
{
  "level1": { "color": "rgba(0,0,0,0.04)", "y": 4, "blur": 16 },
  "level2": { "color": "rgba(0,0,0,0.08)", "y": 8, "blur": 24 },
  "level3": { "color": "rgba(0,0,0,0.12)", "y": 12, "blur": 32 }
}
```

**Dark:**
```json
{
  "level1": "#1C1C1E",
  "level2": "#2C2C2E",
  "level3": "#3A3A3C"
}
```

### 6. Build Component Tokens

Define the key component specs:

- **Button primary:** height, radius, font, padding, colors
- **Button secondary:** same structure
- **Filter chip:** height, radius, font, active/inactive colors
- **Search bar:** height, radius, background, placeholder color
- **Tab bar:** height, icon size, label font, active/inactive colors, background
- **Card:** radius, padding, shadow/surface, image radius
- **Input:** height, radius, background, focus border, label font

## Output

Save to `pipeline/style-guide.json`. After saving, run `forge_record_artifact` with `key="style_guide"` and `path="pipeline/style-guide.json"`.

Output shape:

```json
{
  "meta": {
    "app_name": "string",
    "generated_from": "pipeline/design-brief.json",
    "version": "1.0.0"
  },
  "colors": {
    "light": { "background": "#...", "surface": "#...", "..." },
    "dark":  { "background": "#...", "surface": "#...", "..." }
  },
  "typography": {
    "fontFamily": { "headline": "string", "body": "string" },
    "scale": { "display": {}, "title1": {}, "..." }
  },
  "spacing": { "screenPadding": 24, "..." },
  "cornerRadius": { "micro": 6, "..." },
  "elevation": {
    "light": { "level1": {}, "..." },
    "dark": { "level1": "#...", "..." }
  },
  "components": {
    "buttonPrimary": {},
    "buttonSecondary": {},
    "filterChip": {},
    "searchBar": {},
    "tabBar": {},
    "card": {},
    "input": {}
  }
}
```

## Validation

Before saving, check against `references/visual-design-standards.md`:
- [ ] Accent is muted, not saturated primary
- [ ] Light background is off-white, not pure white
- [ ] Dark background is warm near-black, not `#000000`
- [ ] Headlines are 28pt+
- [ ] Card radius is 12px+
- [ ] Shadows are soft (blur 16px+)
- [ ] Spacing tokens enforce generous whitespace
