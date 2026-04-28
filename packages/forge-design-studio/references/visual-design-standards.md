# Visual Design Aesthetic Standards

These standards define the quality bar for ALL designs. Every screen must adhere to these. Designs that feel generic, flat, or template-like are failures.

---

## Color Philosophy

**The One-Accent Rule:** ONE dominant accent color paired with neutrals. Never multiple competing accents.

**Light Theme:**
- Background: Off-white (`#F5F7FA`, `#F2F2F7`, `#F0EDE8`) — never pure `#FFFFFF` for base
- Card/Surface: Pure white (`#FFFFFF`) floating on off-white
- Primary text: Near-black (`#1A1A2E`, `#2D2D2D`) — never pure `#000000`
- Secondary text: Warm gray (`#8E8E93`, `#6B7280`)
- Accent: Muted/sophisticated — NOT saturated primaries

**Dark Theme:**
- Background: Warm near-black (`#0D0D0D`, `#111111`) — NEVER `#000000`
- Card/Surface: Dark layers (`#1C1C1E`, `#2C2C2E`) — depth through surface color, not shadows
- Primary text: Near-white (`#FFFFFF`, `#F5F5F5`)
- Accent: Warm tones on dark — gold (`#D4A853`), coral (`#FF6B6B`)

**Semantic Colors:**
- Success: `#34C759` / `#30D158`
- Warning: `#FF9500` / `#FFD60A`
- Error: `#FF3B30` / `#FF453A`
- Info: `#007AFF` / `#0A84FF`

---

## Typography System

| Level | Size | Weight | Use |
|-------|------|--------|-----|
| Display/Hero | 34–40pt | Bold/Black | Screen titles, hero sections |
| Title 1 | 28–32pt | Bold | Section headers |
| Title 2 | 22–24pt | Semibold | Subsection headers |
| Title 3 | 18–20pt | Semibold | Card titles |
| Body | 16–17pt | Regular | Primary content |
| Callout | 14–15pt | Regular/Medium | Secondary content |
| Caption | 12–13pt | Regular | Timestamps |
| Micro | 10–11pt | Medium | Badges, tags |

**Rules:**
- Mixed weight contrast — Bold headlines with Regular body
- Left-aligned always — center only for short labels
- Large numeric displays (36-48pt Bold) as visual anchors in dashboards
- Line height — Headlines: 1.1-1.2x. Body: 1.5-1.7x
- Serif + sans-serif for premium apps (serif headlines, sans body)

---

## Layout Architecture

**Card-Based:** All content in rounded cards on layered backgrounds. Never flat on plain surface.

**Spatial Rhythm:**
- Screen padding: 20-24px
- Section gaps: 28-40px
- Item gaps: 12-16px
- Card padding: 16-24px
- Top breathing: 40-80px before first content

**70/30 Rule:** ~70% whitespace, ~30% content. No divider lines.

**Content as Hero:** One element per screen gets dramatically large. Everything else small.

**Patterns:**
1. Hero + Scroll — 40-50% viewport hero with scrollable below
2. Horizontal Carousels — Card width 65-75% screen, peek from right
3. Grid Browse — 2-column equal cards
4. Full-Bleed Photo — Edge-to-edge with text/gradient overlay
5. Asymmetric Feature — 60% + 40% side by side
6. Bento Grid — Mixed 1x1, 2x1, 1x2 widget cards

---

## Components

**Buttons:**
- Primary: Accent fill, 48-56px height, pill or 12-16px radius
- Arrow CTA: text + → (most common CTA pattern)
- Secondary: subtle border or light fill
- Icon: 44x44pt minimum

**Filter Chips:** Pill-shaped, 36-40px height. Active: accent fill. Inactive: light fill.

**Search Bars:** Filled background (NOT bordered), 44-52px, 12-16px radius.

**Navigation:** Bottom tab bar, 3-5 items, 83px with safe area. Active: accent + label.

**Cards:** Image → Title → Description → Action. 16-20px radius. Soft shadow (light) or surface elevation (dark).

**Inputs:** 48-52px height, 12px radius, filled background, floating label, 2px accent border on focus.

---

## Corner Radius

| Element | Radius |
|---------|--------|
| Badges, tags | 6-8px |
| Chips, small buttons | Full pill |
| Cards, inputs, buttons | 12-16px |
| Hero cards, images | 20-24px |
| Sheets, modals | 28-32px (top only) |

---

## Elevation

**Light (shadows):** Level 1: Y:4, blur:16. Level 2: Y:8, blur:24. Level 3: Y:12, blur:32. Always soft/diffused.

**Dark (surface color):** Level 0: `#0D0D0D`. Level 1: `#1C1C1E`. Level 2: `#2C2C2E`. Level 3: `#3A3A3C`. NO shadows.

---

## Modern Techniques

1. **Glassmorphism** — Gradient mesh blobs + frosted card (`backdrop-filter: blur(20-40px)` + white 15-25% opacity)
2. **Gradient Mesh Backgrounds** — 2-3 soft blobs, muted pastels, overlapping at 30-50% opacity
3. **Large Numeric Displays** — 36-48pt Bold numbers as visual anchors with sparkline context
4. **Floating Pill Navigation** — Centered 60-70% width, dark fill, 60px height
5. **Bento Grid Dashboards** — Mixed widget sizes for visual rhythm
6. **Immersive Product Photography** — Products bleeding off screen, dark gradient overlay

---

## Anti-Patterns — NEVER

1. Harsh saturated primaries (`#0000FF`, `#FF0000`)
2. Pure black backgrounds (`#000000`)
3. Cramped spacing — if tight, add 50% more space
4. Sharp corners on interactive elements
5. Heavy borders instead of shadows/surface color
6. Centered paragraph text
7. Multiple competing accent colors
8. Small timid typography — headlines should be LARGE
9. Flat layouts without depth — need 2+ elevation levels
10. Template-looking UIs
11. Ignoring the fold — first viewport must be compelling
12. Uniform grid monotony — break with hero cards, carousels, section headers
