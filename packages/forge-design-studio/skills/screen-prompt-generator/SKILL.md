---
name: screen-prompt-generator
description: >
  Converts screen specs into pixel-perfect image generation prompts for nano-banana.
  Every visual decision is made — nothing left for the image model to guess.
  Triggers on: screen prompt, generate prompt, screen mockup, create screen prompt,
  nano-banana prompt, render screen.
triggers: ["screen prompt", "generate prompt", "screen mockup", "create screen prompt", "nano-banana prompt", "render screen"]
version: 1.0.0
---

# Screen Prompt Generator

Convert screen specs into fully-detailed nano-banana prompts that render production-quality iOS screen mockups on the first pass.

## Prerequisites

Read before generating any prompt:
- `pipeline/design-brief.json` — theme, accent color, aesthetic adjectives
- `pipeline/style-guide.json` — exact hex values, typography, spacing
- `pipeline/copy-deck.json` — exact copy for this screen's state
- `references/nano-banana-guide.md` — the S.L.C.T. framework and prompt structure
- `references/category-blueprints.md` — layout blueprint for this app category

## Visual Constants

Extract and hold from style-guide.json:

```
VISUAL CONSTANTS
  Device            : iPhone 15 Pro, 393×852pt — Dynamic Island (no notch)
  Background color  : <hex from style guide>
  Surface color     : <hex from style guide>
  Primary text      : <hex from style guide>
  Secondary text    : <hex from style guide>
  Accent color      : <hex from style guide>
  Font family       : <from style guide>
  Grid unit         : <from style guide>
  Card radius       : <from style guide>
  Aesthetic         : <adjectives from design brief>
  Brand soul        : <from design brief>
```

## Screen Classification (5 Axes)

Before writing each prompt, classify on ALL 5 axes:

### Axis 1: Navigation Chrome

| Type | Chrome |
|------|--------|
| Root screen | Large title, no back button |
| Pushed screen | Nav bar + back chevron + previous title |
| Modal | Nav bar + ✕ close + drag pill |
| Pushed in modal | Back chevron + persistent ✕ |
| Onboarding | None (optional progress indicator) |
| Full-screen moment | None. No tab bar. |

### Axis 2: Tab Bar

Show ONLY on root screens. Specify: tab count, labels, SF Symbol icon names, active tab, active/inactive colors, background treatment.

### Axis 3: Status Bar

Always include: `9:41 AM`, light or dark icons, signal + wifi + battery.

### Axis 4: Device Chrome

Always: Dynamic Island (37×12.5pt centered), home indicator (pill at bottom). Safe area top: 59pt, bottom: 34pt. NEVER show device frame.

### Axis 5: Keyboard

If active: type (number/default/email), height (~291-336pt), content shift up, CTA above keyboard.

## Prompt Assembly

Follow this EXACT order for every prompt. See `references/nano-banana-guide.md` for the full framework.

```
[1. DEVICE + GLOBAL]
"iPhone 15 Pro screen mockup, no device frame, just the UI.
<background hex> background. <aesthetic> aesthetic, <brand soul>.
Status bar: 9:41 AM, <light/dark> icons, Dynamic Island top center."

[2. NAVIGATION CHROME]
<Axis 1 classification output>

[3. LAYOUT — top to bottom, element by element]
"Layout flows top to bottom with <padding>pt horizontal padding:

<Element>: <position>, <W>×<H>pt, <bg hex>, <radius>pt radius, <padding>pt padding.
Content: '<exact text>', <font> <weight> <size>pt <color hex>.
[icons, badges, avatars, borders, shadows]

Spacing between: <n>pt."

[4. INTERACTIVE STATES]
"<Element> shows <state>. <Element> contains '<exact value>'."

[5. BOTTOM CHROME]
<Tab bar OR floating CTA OR home indicator only>

[6. QUALITY]
"High fidelity UI mockup. Pixel-perfect iOS design.
Real content — no lorem ipsum, no grey placeholder boxes.
Subtle shadows on elevated surfaces. Typography crisp.
No watermarks, annotations, or device frames."
```

## Element Description Formula

EVERY element must specify:
```
<Role>: <position relative to previous>,
<width>×<height>pt, <background hex>, <radius>pt, <padding>pt.
Content: "<exact text>", <font> <weight> <size>pt <color hex>.
[borders, shadows, icons with SF Symbol names, avatar specs]
```

**Example:**
```
Balance card: 16pt below greeting, full width minus 48pt margins,
160pt tall, #1A1A1A background, 20pt radius, 24pt padding.
Top left: "Total Balance" SF Pro Regular 14pt #888888.
Below 8pt: "$312,021.00" SF Pro Bold 42pt #FFFFFF.
Below 16pt: "+$2,450 this month" SF Pro Medium 14pt #00C853.
Bottom right: 32pt circle, #1E1E1E background, arrow.up.right
SF Symbol 16pt #FFFFFF.
Elevation: level 2 shadow.
```

## Real Content Rules

- **Names:** Culturally appropriate for the target market
- **Amounts:** Realistic ("$850.00", "₦125,000")
- **Dates:** Real dates ("Mar 28, 2026", "2h ago")
- **Labels:** Exact text from `pipeline/copy-deck.json`
- **Counts:** Plausible ("3 transactions", "12 contacts")

## Batch Mode

When generating all screens:

1. Read the full screen inventory from `pipeline/design-brief.json`
2. Classify every screen on all 5 axes
3. Generate one prompt per screen × per state × per theme (light + dark)
4. Save to `pipeline/screen-prompts/`. For each prompt file created, run `forge_record_artifact` with `key="screen_prompts"` and the prompt path:
   - `01-<screen>-<state>-<theme>.md`
5. Output summary:

```
SCREEN PROMPTS GENERATED

# | Screen           | State     | Theme | Nav Chrome  | Tab Bar
──────────────────────────────────────────────────────────────────
1 | Home             | populated | light | Large title | Yes (tab 1)
2 | Home             | populated | dark  | Large title | Yes (tab 1)
3 | Home             | empty     | light | Large title | Yes (tab 1)
4 | Send Money       | populated | light | Nav + back  | No
...

Total: [N] prompts
Next: Feed each to nano-banana skill to render
```

## Hard Rules

- Never "a button" — always color, size, radius, label, font
- Never "some text" — always exact copy, font, size, weight, color hex
- Never leave nav chrome ambiguous — classify every screen
- Always Dynamic Island (not notch) for iPhone 15 Pro
- Always top-to-bottom layout order
- Always real content — never grey boxes or lorem ipsum
- All colors as hex from style-guide.json
- Every prompt is self-contained — no assumed context
