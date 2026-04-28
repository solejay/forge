---
name: microcopy
description: >
  Generates microcopy for every state of every feature: headlines, labels, button text,
  empty states, error messages, loading text, offline notices, and accessibility labels.
  Triggers on: microcopy, copy deck, UI text, button labels, error messages, empty state copy.
triggers: ["microcopy", "copy deck", "UI text", "button labels", "error messages", "empty state copy"]
version: 1.0.0
---

# Microcopy Generator

Produce copy for EVERY state of EVERY feature. The copy deck is as important as the visual design — it defines the user experience in edge cases.

## Inputs

- `pipeline/prd.md` — product requirements
- `pipeline/design-brief.json` — app personality, aesthetic adjectives, brand soul
- `pipeline/feature-registry.md` — feature list with states (if available)

## Voice Calibration

From the design brief, derive the copy voice:

```
VOICE
  Personality : <from brief — e.g. "confident", "warm", "precise">
  Tone        : <e.g. "professional but approachable" / "playful and casual">
  Formality   : <formal / semi-formal / casual>
  Humor       : <none / subtle / playful>
  Perspective : <first person "I/We" / second person "You" / impersonal>
```

**Category voice defaults:**
- Fintech: confident, precise, reassuring. "Your balance is up 12% this month."
- Food: warm, appetizing, casual. "Craving something new? We've got you."
- Fitness: motivating, energetic, direct. "You crushed it! 4-day streak."
- Social: friendly, playful, inclusive. "Your friends are waiting!"
- Health: calm, supportive, empathetic. "Let's check in on how you're feeling."
- Productivity: clear, efficient, actionable. "3 tasks remaining today."

## State Coverage

For EVERY feature, generate copy for ALL of these states:

### Populated (default)
- Screen headline
- Section headers
- Button labels (primary + secondary)
- Field labels and placeholders
- Navigation labels
- Tooltip/hint text
- Accessibility labels for all interactive elements

### Empty
- Illustration description (for nano-banana to render)
- Headline: empathetic, not blaming ("No transactions yet" NOT "You have no data")
- Body: helpful, suggests action (1-2 sentences)
- CTA button: clear action ("Add your first transaction" NOT "Get started")

### Loading
- Skeleton placeholder text (if any visible)
- Loading message (if explicit): brief and reassuring
- Pull-to-refresh text: "Updating..."

### Error
- Headline: clear and calm ("Something went wrong" NOT "ERROR 500")
- Body: helpful, explains what happened without jargon
- Retry CTA: "Try Again"
- Help link: "Contact Support" (if applicable)
- Specific error variants:
  - Network: "No internet connection. Check your connection and try again."
  - Server: "We're having trouble right now. Please try again in a moment."
  - Auth: "Your session has expired. Please sign in again."
  - Permission: "We need [permission] to [do thing]. You can enable this in Settings."

### Offline
- Banner text: "You're offline. Showing cached data."
- Stale data notice: "Last updated [time ago]"
- Offline action blocked: "This requires an internet connection."

### Onboarding (if applicable)
- Walkthrough step headlines (bold, 2-3 words max per line)
- Walkthrough body text (1 sentence max)
- Skip button: "Skip" or "Not now"
- Progress text: implicit (dots) not explicit ("Step 2 of 4")
- Final CTA: "Get Started" / "Let's Go" / "Continue"

### Search (if applicable)
- Empty search: "Search for [relevant noun]"
- No results: "No results for '[query]'" + suggestion text
- Recent searches header: "Recent"

## Output

Save to `pipeline/copy-deck.json`. After saving, run `forge_record_artifact` with `key="copy_deck"` and `path="pipeline/copy-deck.json"`.

Output shape:

```json
{
  "meta": {
    "app_name": "string",
    "voice": {
      "personality": ["string"],
      "tone": "string",
      "formality": "string"
    }
  },
  "features": {
    "feature_id": {
      "populated": {
        "headline": "string",
        "section_headers": ["string"],
        "cta_primary": "string",
        "cta_secondary": "string",
        "labels": { "field_name": "label text" },
        "placeholders": { "field_name": "placeholder text" },
        "accessibility": { "element_id": "accessibility label" }
      },
      "empty": {
        "illustration_prompt": "string (for nano-banana)",
        "headline": "string",
        "body": "string",
        "cta": "string"
      },
      "loading": {
        "message": "string",
        "pull_to_refresh": "string"
      },
      "error": {
        "network": { "headline": "", "body": "", "cta": "" },
        "server": { "headline": "", "body": "", "cta": "" },
        "auth": { "headline": "", "body": "", "cta": "" },
        "generic": { "headline": "", "body": "", "cta": "" }
      },
      "offline": {
        "banner": "string",
        "stale_notice": "string",
        "action_blocked": "string"
      }
    }
  },
  "global": {
    "loading": "Loading...",
    "pull_to_refresh": "Pull to refresh",
    "offline_banner": "You're offline",
    "retry": "Try Again",
    "cancel": "Cancel",
    "done": "Done",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit",
    "share": "Share",
    "settings": "Settings",
    "sign_out": "Sign Out"
  }
}
```

## Rules

- Every string must be real copy — never "Button" or "Label" or "Text here"
- Headlines: short and scannable (5 words or fewer)
- Body text: 1-2 sentences max per state
- CTAs: start with a verb ("Add", "Send", "Try", "View")
- Error messages: never blame the user, never show technical details
- Empty states: always suggest the next action
- Accessibility labels: describe what the element DOES, not what it looks like
- Consistency: same action = same label across the entire app
