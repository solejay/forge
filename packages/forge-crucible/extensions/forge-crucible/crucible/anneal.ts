import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PROPOSALS_PATH, ROUTES_PATH, type Proposal } from "../signal/types.js";

export interface AnnealResult {
  applied: Array<{ id: string; type: string; action: string; path?: string }>;
  skipped: Array<{ id: string; reason: string }>;
  proposalPath: string;
}

interface ParsedProposal extends Proposal {
  approved: boolean;
}

export async function annealApprovedProposals(cwd: string): Promise<AnnealResult> {
  const proposalPath = resolve(cwd, PROPOSALS_PATH);
  if (!existsSync(proposalPath)) {
    return { applied: [], skipped: [{ id: "none", reason: `${PROPOSALS_PATH} does not exist. Run forge_crucible first.` }], proposalPath };
  }

  const markdown = await readFile(proposalPath, "utf8");
  const proposals = parseProposalMarkdown(markdown);
  const applied: AnnealResult["applied"] = [];
  const skipped: AnnealResult["skipped"] = [];

  for (const proposal of proposals) {
    if (!proposal.approved) {
      skipped.push({ id: proposal.id, reason: "not marked [APPLY]" });
      continue;
    }

    if (proposal.type === "route") {
      const result = await applyRouteProposal(cwd, proposal);
      applied.push(result);
      continue;
    }

    if (proposal.type === "skill") {
      const result = await applySkillProposal(cwd, proposal);
      applied.push(result);
      continue;
    }

    skipped.push({ id: proposal.id, reason: `${proposal.type} proposals are manual in this version` });
  }

  return { applied, skipped, proposalPath };
}

export function parseProposalMarkdown(markdown: string): ParsedProposal[] {
  const proposals: ParsedProposal[] = [];
  const headingRegex = /^### \[( |APPLY)\] ([a-z]+-\d+): (.+)$/gm;
  const matches = [...markdown.matchAll(headingRegex)];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const blockStart = (match.index ?? 0) + match[0].length;
    const blockEnd = next?.index ?? markdown.length;
    const block = markdown.slice(blockStart, blockEnd);
    const type = extractListValue(block, "Type") as Proposal["type"] | null;
    const confidence = extractListValue(block, "Confidence") as Proposal["confidence"] | null;
    const finding = extractListValue(block, "Finding") ?? "";
    const rationale = extractListValue(block, "Rationale") ?? "";
    const apply = extractListValue(block, "Apply") ?? "";
    const metadata = extractJsonBlock(block);

    proposals.push({
      id: match[2],
      type: type ?? "observation",
      title: match[3],
      confidence: confidence ?? "low",
      finding,
      rationale,
      apply,
      metadata,
      approved: match[1] === "APPLY",
    });
  }

  return proposals;
}

async function applyRouteProposal(cwd: string, proposal: Proposal): Promise<AnnealResult["applied"][number]> {
  const role = stringMetadata(proposal.metadata.suggested_role) ?? stringMetadata(proposal.metadata.task_type) ?? "default";
  const routesPath = resolve(cwd, ROUTES_PATH);
  let routes: Record<string, unknown> = {};

  if (existsSync(routesPath)) {
    try {
      routes = JSON.parse(await readFile(routesPath, "utf8")) as Record<string, unknown>;
    } catch {
      routes = {};
    }
  }

  if (!routes[role]) {
    routes[role] = {
      modelString: "TODO/provider-model",
      thinkingLevel: "high",
      description: `Crucible proposal ${proposal.id}: ${proposal.title}`,
    };
  } else if (typeof routes[role] === "object" && routes[role] !== null) {
    routes[role] = {
      ...(routes[role] as Record<string, unknown>),
      description: `${String((routes[role] as Record<string, unknown>).description ?? "Existing route")} | Review prompted by ${proposal.id}`,
    };
  }

  await mkdir(dirname(routesPath), { recursive: true });
  await writeFile(routesPath, JSON.stringify(routes, null, 2) + "\n", "utf8");
  return { id: proposal.id, type: proposal.type, action: `updated route '${role}' with human-fillable model placeholder/review note`, path: ROUTES_PATH };
}

async function applySkillProposal(cwd: string, proposal: Proposal): Promise<AnnealResult["applied"][number]> {
  const skillName = sanitizeSkillName(stringMetadata(proposal.metadata.skill_name) ?? `generated-${proposal.id}`);
  const skillDir = resolve(cwd, "packages/forge-crucible/skills/generated", skillName);
  const skillPath = resolve(skillDir, "SKILL.md");

  if (!existsSync(skillPath)) {
    const keywords = Array.isArray(proposal.metadata.keywords) ? proposal.metadata.keywords.map(String).join(", ") : "";
    const content = [
      "---",
      `name: ${skillName}`,
      "description: >",
      `  Generated Forge Crucible skill stub from proposal ${proposal.id}. Edit this description, triggers, and playbook before relying on it.`,
      `triggers: ["${skillName}", "${stringMetadata(proposal.metadata.task_type) ?? "specialist"}"]`,
      "version: 0.1.0",
      "---",
      "",
      `# ${skillName}`,
      "",
      "This is a human-editable skill stub generated by Forge Crucible.",
      "",
      "## Finding",
      "",
      proposal.finding,
      "",
      "## Rationale",
      "",
      proposal.rationale,
      "",
      "## Keywords Observed",
      "",
      keywords || "None recorded.",
      "",
      "## Playbook TODO",
      "",
      "1. Define the exact task pattern this skill should handle.",
      "2. Add trigger phrases that are specific enough to avoid false positives.",
      "3. Add step-by-step guidance, verification checks, and drift boundaries.",
      "4. Remove this TODO section when the skill is ready.",
      "",
    ].join("\n");
    await mkdir(skillDir, { recursive: true });
    await writeFile(skillPath, content, "utf8");
  }

  return { id: proposal.id, type: proposal.type, action: `scaffolded skill stub '${skillName}'`, path: `packages/forge-crucible/skills/generated/${skillName}/SKILL.md` };
}

function extractListValue(block: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`^- ${escaped}: (.*)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function extractJsonBlock(block: string): Record<string, unknown> {
  const match = block.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function stringMetadata(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sanitizeSkillName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "generated-skill";
}
