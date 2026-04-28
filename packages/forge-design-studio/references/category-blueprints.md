# Category-Specific Design Blueprints

Proven patterns from top Dribbble mobile designs. Match the app category to a blueprint and use it as the structural foundation.

---

## Accent Color + Theme Selection

| Category | Theme | Accent | Hex |
|----------|-------|--------|-----|
| Health/Wellness | Light (70%) | Muted teal | `#2A6F6F` |
| Finance/Banking | **Dark (65%)** | Navy / Lime on dark | `#1A3A5C` / `#C8FF00` |
| Food/Delivery | Light (80%) | Orange / Fresh green | `#E8873D` / `#4CAF50` |
| Fitness/Sports | **Dark (70%)** | Lime / Coral | `#C8FF00` / `#FF6B6B` |
| E-commerce/Fashion | Light (90%) | Black CTAs, minimal accent | `#1A1A1A` (CTA) |
| AI/Chatbot | Light + glass (70%) | Blue / Teal / Purple | `#4A6FA5` / `#7B68EE` |
| Smart Home/IoT | **Dark (80%)** | Warm amber | `#C4873D` / `#D4A853` |
| Education | Light (85%) | Teal / Mint | `#00897B` |
| Social/Dating | Light (60%) | Soft purple | `#7B68EE` |
| Real Estate | Light (85%) | Green + dark CTAs | `#059669` |
| Lifestyle/Beauty | Light (90%) | Dusty rose | `#C4727F` |
| Audio/Music | **Dark (85%)** | Purple-blue / Neon | `#7B68EE` |
| Parenting/Family | Light (95%) | Teal / Warm green | `#009688` |
| Productivity | Light (75%) | Slate blue | `#4A6FA5` |
| Travel | Light (75%) | Warm coral | `#E07A5F` |

---

## FINTECH / BANKING

**Theme:** Dark primary. **Accent:** Navy, lime on dark, gradient cards.

**Home Screen:**
```
[Status Bar]
[Greeting: "Hello, [Name]" — 16pt + Avatar right]
[Balance Card: "$312,021.00" — 42pt Bold, glassmorphic or gradient background]
[Quick Actions: 4 circles (Send, Receive, Pay, Top-up) — 56px each]
[AI Insight Banner: glassmorphic card — "Let's check your Financial Insight →"]
[Section: "Recent Transactions" + "View All"]
[Transaction List: Avatar + Merchant + Amount, each in card row]
[Tab Bar: Home, Cards, Analytics, Profile]
```

**Card Management:** Horizontal carousel of gradient credit cards (300x190px, 16-20px radius). Card stats below (Income/Expense 2-column).

**Analytics:** Period selector → Area/line chart → Stat cards (2-col) → Category breakdown.

---

## FOOD DELIVERY

**Theme:** Light with warm photography. **Accent:** Orange or fresh green.

**Product Detail:**
```
[Full-Bleed Food Photo: 50% screen height]
[Dark Gradient Overlay: bottom 40%]
[Product Name: 24pt Bold White on overlay]
[Price: "$5.33" — 32pt Bold accent]
[Rating + Delivery Time + Distance: icon+text pills]
[Size Selector: "Small | Medium | Large" pills]
[Description Card: white, floats up with 24px radius top]
[Bottom Bar: dark floating pill — "3 Items | $15.99 [Cart]"]
```

**Cart:** Item cards (thumbnail + name + qty stepper + price) → Promo code → Order summary → CTA.

---

## FITNESS / WELLNESS

**Theme:** Dark for workouts (lime accents), light for wellness (teal accents).

**Dashboard:**
```
[Greeting + streak badge]
[Hero Card: workout photo + overlay — "You're On Fire!" + "Start Workout" CTA]
[Stats Row: 3 cards — Steps, Calories, Heart Rate (large numbers)]
[Weekly Activity: bar/bubble chart (S M T W T F S)]
[Section: "Personalized Plan" + carousel of workout cards]
[Tab Bar: Home, Activity, Stats, Profile — dark with lime active]
```

**Wellness variant:** Mood emoji row (5-7 faces) + Bento grid widgets + Calendar strip.

---

## E-COMMERCE / FASHION

**Theme:** Light dominant, black CTAs. **Accent:** Minimal.

**Browse:**
```
[Search Bar: pill, gray fill, filter icon right]
[Category Pills: horizontal scroll — "Trending | Shoes | Bags"]
[Product Grid: 2-column — image (square) + heart top-right + name + price]
[Tab Bar: Home, Categories, Cart (badge), Profile]
```

**Detail:** Hero image (50%, swipeable) → Brand + name + price → Color circles → Size squares (XS-XL) → Description → Bottom: "Add to Cart" + "Buy Now" side by side.

---

## AI / CHATBOT

**Theme:** Light with glassmorphism. **Accent:** Blue/teal/purple.

**Home:**
```
[Gradient mesh background (pastel blobs at 30%)]
[Greeting: "Hi [Name]"]
[Prompt Bar: glassmorphic, avatar + "Ask anything" + mic]
[Category Chips: "Generated Image", "Social", "AI Assistant"]
[Feature Cards: 2-col — "Voice Recognition", "Image Generator"]
```

**Voice:** Large gradient orb (180px) center → Pulsing glow → Transcription below → Emoji + actions bottom.

**Chat:** User bubbles (right, accent fill, white text) → AI bubbles (left, gray/glass fill) → Suggestion chips → Input bar with send.

---

## REAL ESTATE

**Theme:** Light, warm neutrals, photography-heavy. **Accent:** Green + dark CTAs.

**Home:**
```
[Greeting + avatar]
[Search Bar: location icon]
[Type Filters: "Any | Rent | Buy | House" pills]
[Property Cards: large photo (60%) + rating overlay + name + location + bed/bath + price]
[Tab Bar: Home, Explore, Wishlist, Account]
```

**Detail:** Photo gallery → Info (name, location, price) → Amenities grid (4-col icons) → Description → "Booking Now" CTA.

---

## SMART HOME / IoT

**Theme:** Dark with warm amber accents.

```
[Warm dark gradient background]
[Greeting + avatar — "Welcome back"]
[Room Selector: warm white pills — "All | Living Room | Kitchen"]
[Scene Cards: horizontal — "Movie Night", "Good Morning", "Away"]
[Device Grid: 2-col cards with icon + name + toggle switch]
```

---

## Screen Composition Templates

| Screen Type | Layout Pattern |
|-------------|---------------|
| Home/Dashboard | Hero card → Horizontal carousel → 2-col grid → Carousel |
| Browse/Search | Search → Filter chips → Featured hero → Grid/list |
| Detail | Full-bleed hero → Floating info card → Sections → Sticky CTA |
| Profile | Avatar header → Stats row → Settings list → Actions |
| Onboarding | Full-screen image/gradient → Bold tagline → CTA + skip |
| Settings | Grouped list sections → Toggle rows → Destructive at bottom |
| Empty State | Centered: illustration → headline → body → CTA |
| Checkout | Payment radio list → Address card → Summary → Sticky CTA |
| Analytics | Period selector → Chart → Stat cards (2x2 bento) → Breakdown |
