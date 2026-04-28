---
name: design-brief-generator
description: >
  Generates a design brief from a PRD and Dribbble inspiration.
  Determines theme, accent color, typography, layout approach, and screen inventory.
  Triggers on: design brief, create brief, visual direction, design-brief.
triggers: ["design brief", "create brief", "visual direction", "design-brief"]
version: 1.0.0
---

# Design Brief Generator

Transform a PRD into a focused design brief that drives all downstream design decisions.

## Inputs

- `pipeline/prd.md` — the product requirements document
- `pipeline/inspiration/` — Dribbble screenshots (if gathered)
- `references/category-blueprints.md` — category-specific patterns
- `references/visual-design-standards.md` — aesthetic rules

## Process

### 1. Extract App Identity

From the PRD, extract:
- **App name** and tagline
- **Category** (fintech, food, fitness, etc.)
- **Target audience** (age, demographics, preferences)
- **Core value proposition** (one sentence)
- **Personality** (3-4 adjectives: confident, playful, clinical, warm, etc.)

### 2. Match Category Blueprint

Look up the app's category in `references/category-blueprints.md`:
- Theme preference (light/dark/glassmorphic)
- Recommended accent color direction + hex
- Visual techniques that work for this category

### 3. Choose Accent Color

Follow the One-Accent Rule from `references/visual-design-standards.md`:
- Muted/sophisticated tones only — never saturated primaries
- Match the category's recommended direction
- Consider the audience (younger = slightly more saturated, professional = more muted)
- Verify contrast against both light and dark backgrounds

### 4. Define Typography Direction

- Default: SF Pro (iOS) / Inter (cross-platform)
- Premium apps: consider serif for headlines + sans for body
- Playful apps: rounded sans-serif
- Professional: clean geometric sans-serif

### 5. Build Screen Inventory

From the PRD features, list every screen needed with ALL states:

For each screen, determine:
- **Type:** Root / Pushed / Modal / Onboarding / Full-screen moment
- **States:** Populated, Empty, Loading, Error, Offline (minimum)
- **Nav chrome:** Large title / Standard + back / Close button / None
- **Tab bar:** Yes (which tab active) / No

### 6. Define Layout Approach

Based on category blueprint:
- Primary layout pattern (Hero + Scroll, Grid Browse, etc.)
- Navigation pattern (Tab bar, Sidebar, etc.)
- Content density (sparse/medium/dense)

## Output

After saving, run `forge_record_artifact` with `key="design_brief"` and `path="pipeline/design-brief.json"`.

Save to `pipeline/design-brief.json`:

```json
{
  "app_name": "string",
  "tagline": "string",
  "category": "string",
  "target_audience": "string",
  "value_proposition": "string",
  "personality": ["adjective", "adjective", "adjective"],
  "theme_preference": "light | dark | glassmorphic",
  "accent_color": {
    "hex": "#...",
    "name": "descriptive name",
    "rationale": "why this color for this app"
  },
  "aesthetic_adjectives": ["string", "string", "string"],
  "brand_soul": "one sentence capturing the feeling",
  "typography_direction": {
    "headline_font": "string",
    "body_font": "string",
    "rationale": "string"
  },
  "layout_approach": {
    "primary_pattern": "string",
    "navigation": "string",
    "content_density": "sparse | medium | dense"
  },
  "screens": [
    {
      "name": "string",
      "type": "root | pushed | modal | onboarding | fullscreen",
      "states": ["populated", "empty", "loading", "error"],
      "nav_chrome": "large_title | standard_back | close | none",
      "tab_bar": true,
      "active_tab": "Home",
      "description": "what this screen shows"
    }
  ],
  "inspiration_notes": "key observations from Dribbble research"
}
```
