/**
 * routing.ts — Design keyword detection for forge-design-studio
 */

const designSignals: [string, number][] = [
  ["design app", 3],
  ["design phase", 3],
  ["create designs", 3],
  ["design the app", 3],
  ["create the ui", 3],
  ["visual design", 3],
  ["design system", 3],
  ["start designing", 3],
  ["design-app", 3],
  ["style guide", 3],
  ["color system", 2],
  ["typography system", 2],
  ["design tokens", 2],
  ["screen mockup", 3],
  ["screen prompt", 3],
  ["render screen", 3],
  ["nano-banana prompt", 3],
  ["microcopy", 3],
  ["copy deck", 3],
  ["empty state copy", 2],
  ["error messages", 2],
  ["design brief", 3],
  ["visual direction", 2],
  ["design qa", 3],
  ["review designs", 2],
  ["check screens", 2],
  ["design review", 2],
  ["dribbble", 3],
  ["dribbble inspiration", 3],
  ["figma", 2],
  ["mockup", 2],
  ["wireframe", 2],
  ["prototype", 2],
  ["ui design", 3],
  ["ux design", 2],
];

const DESIGN_THRESHOLD = 3;

export interface DesignRoutingScores {
  designScore: number;
  isDesign: boolean;
}

export function scoreDesignPrompt(prompt: string): DesignRoutingScores {
  const p = prompt.toLowerCase();
  let total = 0;
  for (const [pattern, weight] of designSignals) {
    if (p.includes(pattern)) {
      total += weight;
    }
  }
  return {
    designScore: total,
    isDesign: total >= DESIGN_THRESHOLD,
  };
}

export function buildDesignRoutingContext(scores: DesignRoutingScores): string | null {
  if (!scores.isDesign) return null;

  return (
    "[Design Pipeline Mode]\n" +
    "Design signals detected. Use the design-app skill to orchestrate the full pipeline:\n" +
    "1. Load PRD from pipeline/prd.md\n" +
    "2. Generate design brief (+ Dribbble inspiration)\n" +
    "3. Create style guide (pipeline/style-guide.json)\n" +
    "4. Generate microcopy (pipeline/copy-deck.json)\n" +
    "5. Generate screen prompts (screen-prompt-generator skill)\n" +
    "6. Render screens via nano-banana\n" +
    "7. Design QA — validate every screen\n\n" +
    "Or use individual skills: style-guide-maker, screen-prompt-generator, microcopy, design-qa"
  );
}
