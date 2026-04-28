---
name: design-app
description: >
  Full design pipeline: PRD to production-quality screen mockups.
  Takes a product requirements document and produces style guide, screen prompts,
  rendered screen mockups via nano-banana, microcopy for every state, and backend
  API specs. Outputs everything needed for engineering handoff.
  Triggers on: design app, design phase, create designs, design the app, create the UI,
  visual design, design system, start designing, design-app.
triggers: ["design app", "design phase", "create designs", "design the app", "create the UI", "visual design", "design system", "start designing", "design-app"]
version: 2.0.0
---

# Design App — Full Design Pipeline

You are the Designer Agent. Take the PRD and produce a complete design system, all screen mockups rendered via nano-banana, microcopy for every UI state, and backend API specifications.

## Prerequisites

Verify the PRD exists:
```bash
ls pipeline/prd.md
```
If missing, tell the user: "I need a PRD first. Create `pipeline/prd.md` with your product requirements."

Also check for a feature registry (optional but helpful):
```bash
ls pipeline/feature-registry.md 2>/dev/null
```

---

## Pipeline Overview

```
PRD.md
  │
  ├──→ Step 1: Load context
  │
  ├──→ Step 2: Design brief (+ Dribbble inspiration)
  │         │
  │         ├──→ Step 3: Style guide ──→ pipeline/style-guide.json
  │         │
  │         ├──→ Step 4: Microcopy ───→ pipeline/copy-deck.json
  │         │         (Steps 3 & 4 can run in parallel)
  │         │
  │         └──→ Step 5: Screen prompts (uses style guide)
  │                   │
  │                   └──→ Step 6: Render screens via nano-banana
  │                             │
  │                             └──→ pipeline/screens/*.png
  │
  ├──→ Step 7: Backend API spec ──→ pipeline/backend-api-spec.json
  │
  ├──→ Step 8: Design QA (review every rendered screen)
  │
  └──→ Step 9: Gate checkpoint — present to user
```

---

## Step 1: Load Context

Read the PRD and extract:
- App name, category, target audience
- All features and their states (populated, empty, error, loading, offline)
- Platform targets (iOS, Android, both)
- Any brand/personality requirements

```bash
cat pipeline/prd.md
```

If `pipeline/feature-registry.md` exists, read it too. Otherwise derive the feature list and state matrix from the PRD.

---

## Step 2: Design Brief + Dribbble Inspiration

### 2a: Gather Dribbble Inspiration

Search Dribbble for the app's category. Use 3-5 search terms derived from the PRD:

```bash
# Example for a fintech app:
dribbble search "fintech app dark" --download pipeline/inspiration/
dribbble search "banking dashboard mobile" --download pipeline/inspiration/
dribbble search "payment app iOS" --download pipeline/inspiration/
```

If the `dribbble` CLI isn't available, describe the visual direction based on the category blueprints in `references/category-blueprints.md` and proceed.

### 2b: Generate Design Brief

Using the PRD + inspiration + category blueprint from `references/category-blueprints.md`, produce `pipeline/design-brief.json`:

```json
{
  "app_name": "string",
  "category": "string",
  "theme_preference": "light | dark | glassmorphic",
  "accent_color": { "hex": "#...", "rationale": "string" },
  "aesthetic_adjectives": ["string", "string", "string"],
  "brand_soul": "one sentence capturing the feeling",
  "typography_direction": "string",
  "layout_approach": "string",
  "inspiration_notes": "string",
  "target_screens": ["screen_name", "..."],
  "screen_states": {
    "screen_name": ["populated", "empty", "loading", "error"]
  }
}
```

Consult `references/visual-design-standards.md` for the accent color rules and `references/category-blueprints.md` for the category's recommended theme + color.

---

## Step 3: Style Guide

Use the design-brief-generator output and invoke the style-guide-maker skill.

Read `skills/style-guide-maker/SKILL.md` and follow its instructions to produce `pipeline/style-guide.json`.

The style guide must include:
- Color tokens (background, surface, text, accent, semantic — both themes)
- Typography scale (display through micro — font, size, weight, line height)
- Spacing tokens (screen padding, section gap, item gap, card padding)
- Corner radius tokens (micro through XL)
- Shadow/elevation tokens (3 levels, light + dark)
- Component patterns (buttons, chips, search, nav, cards, inputs)

**Validate against `references/visual-design-standards.md` before saving.**

---

## Step 4: Microcopy

Invoke the microcopy skill. Read `skills/microcopy/SKILL.md`.

For EVERY feature × EVERY state, produce copy:
- Populated: headlines, labels, button text
- Empty: illustration description, headline, body, CTA
- Loading: skeleton text, loading message
- Error: headline, body, retry CTA
- Offline: banner text, cached data notice

Save to `pipeline/copy-deck.json`.

**Steps 3 and 4 can run in parallel** — they have no dependency on each other.

---

## Step 5: Screen Prompts

Invoke the screen-prompt-generator skill. Read `skills/screen-prompt-generator/SKILL.md`.

For each screen × each state, generate a complete nano-banana prompt following the S.L.C.T. framework. The prompt must be pixel-perfect: exact hex colors from `pipeline/style-guide.json`, exact copy from `pipeline/copy-deck.json`, exact layout from the category blueprint.

Save prompts to `pipeline/screen-prompts/`:
```
pipeline/screen-prompts/
├── 01-onboarding-welcome.md
├── 02-onboarding-features.md
├── 03-home-populated.md
├── 04-home-empty.md
├── 05-home-loading.md
├── ...
```

---

## Step 6: Render Screens via Nano-Banana

For each screen prompt, invoke the `nano-banana` skill to render the full-screen mockup.

**Render strategy:**
1. Generate screens in flow order (onboarding → home → features → settings)
2. Generate BOTH light and dark variants for each screen
3. Save to `pipeline/screens/`:

```
pipeline/screens/
├── 01-onboarding-welcome-light.png
├── 01-onboarding-welcome-dark.png
├── 02-home-populated-light.png
├── 02-home-populated-dark.png
├── 03-home-empty-light.png
├── ...
```

**Batch optimization:** Group screens by visual similarity. Onboarding screens share the same hero treatment. Dashboard screens share the same nav chrome. Generate similar screens back-to-back for style consistency.

**If nano-banana is unavailable:** Document the screen prompts as the deliverable. The prompts in `pipeline/screen-prompts/` are detailed enough to render later or hand to another image generation tool.

**Verification after rendering:**
```bash
echo "Rendered screens:"
find pipeline/screens -name "*.png" -type f | wc -l
find pipeline/screens -name "*.png" -type f | sort
```

---

## Step 7: Backend API Spec

Analyze the feature registry and screen designs to derive backend requirements.

For each feature that needs data:
1. Data model (entities, fields, types)
2. API endpoints (REST)
3. Auth requirements
4. Real-time needs (WebSocket, Supabase Realtime)
5. File storage (images, documents)

Save to `pipeline/backend-api-spec.json`:
```json
{
  "backend_provider": "supabase | firebase",
  "data_models": [
    {
      "name": "string",
      "table": "string",
      "fields": [{ "name": "", "type": "", "nullable": false }],
      "indexes": ["string"]
    }
  ],
  "api_endpoints": [
    {
      "method": "GET",
      "path": "/api/...",
      "description": "string",
      "auth_required": true,
      "request_body": {},
      "response_body": {},
      "used_by_features": ["feature_id"]
    }
  ],
  "auth_config": {
    "providers": ["email", "apple", "google"]
  }
}
```

---

## Step 8: Design QA

Invoke the design-qa skill. Read `skills/design-qa/SKILL.md`.

Review every rendered screen against the visual design standards. Read each PNG and check:
- First viewport is visually compelling
- Headlines are 28pt+ Bold
- At least 2 elevation levels visible
- One accent color only
- Spacing is generous (not cramped)
- Real content (no placeholders)
- Dark mode exists for every screen

**If any screen fails QA, regenerate it** by adjusting the prompt and re-rendering.

---

## Step 9: Gate Checkpoint

Before presenting to the user, verify ALL artifacts exist:

```bash
echo "=== PIPELINE COMPLETION CHECK ==="
for f in prd.md design-brief.json style-guide.json copy-deck.json backend-api-spec.json; do
  [ -f "pipeline/$f" ] && echo "✅ $f" || echo "❌ $f MISSING"
done
SCREEN_COUNT=$(find pipeline/screens -name "*.png" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "Screens rendered: $SCREEN_COUNT"
PROMPT_COUNT=$(find pipeline/screen-prompts -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "Screen prompts: $PROMPT_COUNT"
```

**If anything is missing, go back and generate it before presenting.**

Present the checkpoint:

```markdown
## Design Complete — Gate 2

### Summary
[2-3 sentences about the design system and screens created]

### Artifacts
| File | Status | Details |
|------|--------|---------|
| `pipeline/design-brief.json` | ✅ | Design direction |
| `pipeline/style-guide.json` | ✅ | [N] color + [M] typography tokens |
| `pipeline/copy-deck.json` | ✅ | [N] features × [M] states |
| `pipeline/screen-prompts/` | ✅ | [N] screen prompts |
| `pipeline/screens/` | ✅ | [N] rendered mockups |
| `pipeline/backend-api-spec.json` | ✅ | [N] endpoints, [M] models |

### Design Decisions
- Theme: [light/dark] — [reason]
- Accent: [hex] [name] — [reason]
- Typography: [font] — [reason]
- Navigation: [pattern] — [reason]

### Screen Coverage
| Screen | States | Light | Dark |
|--------|--------|-------|------|
| [name] | [N] | ✅/❌ | ✅/❌ |

### Next
Proceed to implementation with `forge-mobile-dev`.
The engineering team can use:
- Screen PNGs as visual reference
- `style-guide.json` for exact design tokens
- `copy-deck.json` for every string
- `backend-api-spec.json` for API contracts
- `pipeline/state.json` as Forge world state / handoff memory
```

Before stopping, ensure generated artifacts have been recorded in `pipeline/state.json` via `forge_record_artifact` where available.

**STOP. Wait for user approval.**

---

## Error Handling

- If Dribbble CLI unavailable → proceed with category blueprints
- If nano-banana unavailable → deliver screen prompts as the design artifact
- If PRD is missing critical info → ask the user rather than guessing
- If a feature has ambiguous states → ask the user

## Notes

- Always read `references/visual-design-standards.md` before generating any design artifact
- Always read `references/category-blueprints.md` to match the app category
- PRD is markdown, not JSON
- Dribbble only for inspiration (no Mobbin, no HIG CLI)
- nano-banana renders full screens — no Figma MCP dependency
- Dark mode is not optional — design both themes for every screen
