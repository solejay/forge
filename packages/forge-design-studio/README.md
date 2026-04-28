# forge-design-studio

A [pi](https://github.com/badlogic/pi-mono) package for the design phase — from PRD to production-quality screen mockups, style guides, and engineering handoff artifacts.

## Install

```bash
# From git
pi install git:github.com/yourorg/forge-design-studio

# Or locally during development
pi install -l .
```

## The Pipeline

```
pipeline/prd.md (you write this)
    │
    ├→ Step 2: Design Brief  ──→ pipeline/design-brief.json
    │    (+ Dribbble inspiration)
    │
    ├→ Step 3: Style Guide   ──→ pipeline/style-guide.json
    │
    ├→ Step 4: Microcopy     ──→ pipeline/copy-deck.json
    │    (Steps 3 & 4 run in parallel)
    │
    ├→ Step 5: Screen Prompts ─→ pipeline/screen-prompts/*.md
    │
    ├→ Step 6: Render via     ─→ pipeline/screens/*.png
    │    nano-banana
    │
    ├→ Step 7: Backend Spec   ─→ pipeline/backend-api-spec.json
    │
    └→ Step 8: Design QA      ─→ validated screens
```

**No Figma MCP.** nano-banana renders full-screen mockups directly from detailed prompts. The screen-prompt-generator skill produces prompts so precise that every hex value, font size, and element position is specified.

## What's Included

### Extension (`extensions/design-pipeline/`)

| Feature | Description |
|---------|-------------|
| Input routing | Detects design keywords → suggests design-app skill |
| `pipeline_status` tool | Scans `pipeline/` directory, reports progress + next step |
| `/design-app` | Start the full pipeline |
| `/design-status` | Check pipeline progress |
| `/design-brief` | Generate design brief |
| `/style-guide` | Create style guide |
| `/screen-prompts` | Generate nano-banana prompts |
| `/design-qa` | Validate rendered screens |

### Skills (`skills/`)

| Skill | Input | Output |
|-------|-------|--------|
| `design-app` | PRD | Orchestrates the full pipeline |
| `design-brief-generator` | PRD + Dribbble | `design-brief.json` |
| `style-guide-maker` | Design brief | `style-guide.json` |
| `screen-prompt-generator` | Style guide + copy deck | Screen prompts for nano-banana |
| `microcopy` | PRD + design brief | `copy-deck.json` |
| `design-qa` | Rendered screens | QA report + fixes |

### References (`references/`)

| File | Purpose |
|------|---------|
| `visual-design-standards.md` | The quality bar — color, typography, layout, components |
| `category-blueprints.md` | Category patterns — fintech, food, fitness, e-commerce, AI, etc. |
| `nano-banana-guide.md` | S.L.C.T. prompt framework for screen rendering |

## Handoff to forge-mobile-dev

The pipeline outputs everything an engineer needs:

| Artifact | Used by engineer for |
|----------|---------------------|
| `pipeline/screens/*.png` | Visual reference — what each screen looks like |
| `pipeline/style-guide.json` | Exact design tokens → SwiftUI/Compose theme |
| `pipeline/copy-deck.json` | Every string for every state → Localizable.strings / strings.xml |
| `pipeline/backend-api-spec.json` | API contracts → networking layer |
| `pipeline/state.json` | Forge world state → task state, artifact registry, verification status |

```bash
# Designer runs:
pi install git:github.com/yourorg/forge-design-studio
# ... completes pipeline ...

# Engineer runs:
pi install git:github.com/yourorg/forge-mobile-dev
# ... implements from the artifacts ...
```

## Prerequisites

- **nano-banana skill** — for rendering screens (requires `GEMINI_API_KEY`)
- **dribbble CLI** — for gathering inspiration (optional, degrades gracefully)

## Development

```bash
# Test the extension locally
pi -e ./extensions/design-pipeline/index.ts

# Or install as local package
pi install -l .
```

## License

MIT
