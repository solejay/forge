# Design Studio Context

This project provides a pi package for the design phase of mobile app development.

## Pipeline: PRD → Rendered Screen Mockups

1. Write your PRD as `pipeline/prd.md`
2. Run `/design-app` to start the full pipeline
3. Or run individual steps: `/design-brief`, `/style-guide`, `/screen-prompts`, `/design-qa`
4. Check progress anytime: `/design-status`

## Routing Rules
- Full pipeline tasks → use design-app skill
- Design brief / visual direction → use design-brief-generator skill
- Style guide / design tokens → use style-guide-maker skill
- Screen mockup prompts → use screen-prompt-generator skill
- Microcopy / UI text → use microcopy skill
- Quality review → use design-qa skill

## Key References
- `references/visual-design-standards.md` — the quality bar for all designs
- `references/category-blueprints.md` — category-specific patterns (fintech, food, fitness, etc.)
- `references/nano-banana-guide.md` — prompt framework for screen rendering

## Dependencies
- `nano-banana` skill — for rendering screen mockups (requires GEMINI_API_KEY)
- `dribbble` CLI — for gathering inspiration (optional, pipeline degrades gracefully)

## Handoff to Engineering
The pipeline produces artifacts consumed by `forge-mobile-dev`:
- `pipeline/style-guide.json` → design tokens for SwiftUI/Compose
- `pipeline/copy-deck.json` → every string for every state
- `pipeline/screens/*.png` → visual reference for implementation
- `pipeline/backend-api-spec.json` → API contracts
