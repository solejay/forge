# Nano-Banana Prompt Guide for Screen Mockups

Guide for generating production-quality iOS/Android screen mockups using the `nano-banana` skill (Google Gemini 3 Pro Image).

---

## The S.L.C.T. Framework

Every image prompt follows: **Subject → Lighting → Camera → Text/Details**

```
GOOD: "iPhone 15 Pro screen mockup, no device frame, just the UI.
#0A0A0A dark background. Dark fintech aesthetic, confident and direct.
Status bar: 9:41 AM, light icons, Dynamic Island visible top center.
Navigation bar at top: back chevron + 'Home' label top left in SF Pro
Regular 17pt white, 'Send Money' centered in SF Pro Semibold 17pt white.
[...element-by-element layout description...]
High fidelity UI mockup. Pixel-perfect iOS design.
Real content — no lorem ipsum. No watermarks."

BAD: "A finance app send money screen"
```

---

## Screen Mockup Prompt Structure

Every screen prompt MUST follow this exact assembly order:

### Section 1 — Device + Global Context
```
"iPhone 15 Pro screen mockup, no device frame, just the UI.
<background hex> background. <aesthetic adjectives> aesthetic, <brand one-liner>.
Status bar: 9:41 AM, <light/dark> icons, Dynamic Island visible top center."
```

### Section 2 — Navigation Chrome
Choose one based on screen type:
- **Root screen:** "Large title '<Title>' top left. No back button."
- **Pushed screen:** "Navigation bar: back chevron + '<Previous>' top left, '<Title>' centered."
- **Modal:** "Navigation bar: '✕' close top right, '<Title>' centered. Drag indicator pill."
- **Onboarding:** "No navigation bar."
- **Full-screen moment:** "No navigation bar. No tab bar."

### Section 3 — Layout (top-to-bottom, element-by-element)
```
"Layout flows top to bottom with <padding>pt horizontal padding:

<Element>: <position>, <dimensions>, <background hex>, <corner radius>,
<padding>. Content: <exact text>, <font> <weight> <size>pt <color hex>.
[borders, shadows, icons, badges, avatars]

Spacing between elements: <n>pt."
```

### Section 4 — Interactive States
```
"<Element> shows <filled/empty/active/disabled/error> state.
<Element> contains <exact value or text>."
```

### Section 5 — Bottom Chrome
Choose one:
- **Tab bar:** tabs with SF Symbol names, active/inactive states, background
- **Floating CTA:** full-width button with exact label, color, radius
- **Home indicator only**

### Section 6 — Quality Directives
```
"High fidelity UI mockup. Pixel-perfect iOS design.
Real content — no lorem ipsum, no grey placeholder boxes.
Subtle shadows on elevated surfaces. Typography crisp and correctly weighted.
No watermarks, annotations, or device frames."
```

---

## Element Description Formula

Every element MUST follow:
```
<Role>: <position relative to previous>,
<width>×<height>pt, <background hex>, <radius>pt radius, <padding>pt padding.
Content: "<exact text>", <font> <weight> <size>pt <color hex>.
[Additional: borders, shadows, icons, badges]
```

**Example:**
```
Recipient card: 16pt below nav bar, full width minus 48pt margins,
72pt tall, #1A1A1A background, 12pt corner radius, 16pt padding.
Left: 44pt circle avatar, blue gradient, white initials "AO"
SF Pro Semibold 18pt. Right 12pt gap: "Amara Osei" SF Pro Semibold
16pt #FFFFFF. Below: "GTB •••• 4521" SF Pro Regular 13pt #888888.
Far right: chevron.right #444444.
```

---

## Real Content Rules

Never placeholder text. Always realistic:
- **Names:** Culturally appropriate for target market
- **Amounts:** Realistic ("$850.00", "₦125,000")
- **Dates:** Real dates ("Mar 28, 2026", "2h ago")
- **Labels:** Exact button/field labels from the PRD
- **Counts:** Plausible numbers ("3 transactions", "12 contacts")

---

## Device Specs

### iPhone 15 Pro (default)
- Screen: 393 × 852pt
- Dynamic Island: black pill, 37×12.5pt, centered top
- Status bar: 9:41 AM, signal + wifi + battery
- Safe area top: 59pt, bottom: 34pt
- Home indicator: pill centered at very bottom

### Tab Bar
- Height: 49pt content + 34pt safe area = 83pt total
- 3-5 items, SF Symbol icons (24×24) + labels (10pt)
- Active: accent icon + label. Inactive: #8E8E93

---

## Batch Generation Strategy

When generating all screens for an app:

1. **Generate the style constants first** — extract exact hex values, font specs from style-guide.json
2. **Group by screen type** — onboarding screens share look, dashboard screens share look
3. **Generate in flow order** — onboarding → home → key features → settings
4. **Maintain consistency** — every prompt includes the same global context (colors, font, aesthetic)
5. **Name outputs clearly** — `01-onboarding-welcome.png`, `02-onboarding-features.png`, etc.
6. **Generate both themes** — light + dark variant for every screen

---

## Common Pitfalls

- **Vague elements:** "a button" → always specify color, size, radius, label, font
- **Missing chrome:** forgetting status bar, Dynamic Island, or home indicator
- **Wrong nav for screen type:** using back button on root screen, missing close on modal
- **Placeholder text:** "Lorem ipsum" or "Button" — use real content
- **Missing spacing:** not specifying gaps between elements → cramped layout
- **Colors without hex:** "blue button" → always exact hex from style guide
