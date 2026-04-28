import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ensureForgeState, FORGE_STATE_PATH } from "../state/store.js";

interface DoctorCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  evidence: string;
}

const EXPECTED_PACKAGES = [
  {
    name: "forge-core",
    packageName: "@forge/forge-core",
    fallback: "/Users/olusegunsolaja-mini/Documents/Projects/forge-core",
    importantFiles: [
      "package.json",
      "extensions/forge-core/index.ts",
      "extensions/forge-core/tools/forge-status.ts",
      "extensions/forge-core/tools/forge-doctor.ts",
      "skills/forge-plan/SKILL.md",
      "skills/forge-review/SKILL.md",
    ],
  },
  {
    name: "forge-mobile-dev",
    packageName: "@forge/forge-mobile-dev",
    fallback: "/Users/olusegunsolaja-mini/Documents/Projects/forge-mobile-dev",
    importantFiles: [
      "package.json",
      "extensions/forge-mobile/index.ts",
      "extensions/forge-mobile/agents.ts",
      "skills/mobile-split/SKILL.md",
    ],
  },
  {
    name: "forge-design-studio",
    packageName: "@forge/forge-design-studio",
    fallback: "/Users/olusegunsolaja-mini/Documents/Projects/forge-design-studio",
    importantFiles: [
      "package.json",
      "extensions/design-pipeline/index.ts",
      "extensions/design-pipeline/tools/pipeline-status.ts",
      "skills/design-app/SKILL.md",
    ],
  },
];

export function registerForgeDoctorTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_doctor",
    label: "Forge Doctor",
    description:
      "Run read-only diagnostics for Forge package installation, package manifests, extension files, active tools, and pipeline/state.json health.",
    promptSnippet: "Diagnose Forge package install and harness health",
    promptGuidelines: [
      "Use forge_doctor when Forge packages, tools, commands, or skills are not loading as expected.",
      "forge_doctor is read-only; it reports issues but does not modify settings or files.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const checks: DoctorCheck[] = [];
      const settingsInfo = inspectSettings();
      checks.push(...settingsInfo.checks);

      const packagePaths = resolvePackagePaths(settingsInfo.packages, settingsInfo.settingsDir);
      for (const expected of EXPECTED_PACKAGES) {
        checks.push(...inspectPackage(expected, packagePaths));
      }

      checks.push(...inspectActiveTools(pi));
      checks.push(...await inspectForgeState(ctx.cwd));

      const summary = summarizeChecks(checks);
      return {
        content: [{ type: "text", text: formatReport(checks, summary) }],
        details: { summary, checks, settings: settingsInfo, packagePaths },
      };
    },
  });
}

function inspectSettings(): { checks: DoctorCheck[]; packages: string[]; settingsDir: string } {
  const settingsPath = "/Users/olusegunsolaja-mini/.pi/agent/settings.json";
  const checks: DoctorCheck[] = [];
  const settingsDir = dirname(settingsPath);

  if (!existsSync(settingsPath)) {
    return {
      checks: [{ name: "Global pi settings", status: "warn", evidence: `Missing ${settingsPath}` }],
      packages: [],
      settingsDir,
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8")) as { packages?: string[] };
    const packages = Array.isArray(parsed.packages) ? parsed.packages : [];
    checks.push({
      name: "Global pi settings",
      status: "pass",
      evidence: `${settingsPath} present with ${packages.length} package reference(s).`,
    });
    return { checks, packages, settingsDir };
  } catch (error) {
    checks.push({ name: "Global pi settings", status: "fail", evidence: `Could not parse ${settingsPath}: ${String(error)}` });
    return { checks, packages: [], settingsDir };
  }
}

function resolvePackagePaths(packages: string[], settingsDir: string): string[] {
  return packages.map((entry) => entry.startsWith("/") ? entry : resolve(settingsDir, entry));
}

function inspectPackage(expected: typeof EXPECTED_PACKAGES[number], installedPaths: string[]): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const packagePath = installedPaths.find((path) => path.endsWith(`/${expected.name}`)) ?? expected.fallback;
  const installed = installedPaths.includes(packagePath);

  checks.push({
    name: `${expected.name} package path`,
    status: existsSync(packagePath) ? (installed ? "pass" : "warn") : "fail",
    evidence: existsSync(packagePath)
      ? `${packagePath}${installed ? " is installed in settings." : " exists but is not listed in global settings."}`
      : `${packagePath} missing.`,
  });

  const manifestPath = resolve(packagePath, "package.json");
  if (!existsSync(manifestPath)) {
    checks.push({ name: `${expected.name} package manifest`, status: "fail", evidence: `Missing ${manifestPath}` });
  } else {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: string; pi?: unknown };
      const nameMatches = manifest.name === expected.packageName;
      checks.push({
        name: `${expected.name} package manifest`,
        status: nameMatches && manifest.pi ? "pass" : "warn",
        evidence: `name=${manifest.name ?? "missing"}, pi manifest=${manifest.pi ? "present" : "missing"}`,
      });
    } catch (error) {
      checks.push({ name: `${expected.name} package manifest`, status: "fail", evidence: `Could not parse package.json: ${String(error)}` });
    }
  }

  for (const file of expected.importantFiles) {
    const filePath = resolve(packagePath, file);
    checks.push({
      name: `${expected.name}: ${file}`,
      status: existsSync(filePath) ? "pass" : "fail",
      evidence: existsSync(filePath) ? "present" : `missing at ${filePath}`,
    });
  }

  return checks;
}

function inspectActiveTools(pi: ExtensionAPI): DoctorCheck[] {
  const toolNames = pi.getAllTools().map((tool) => tool.name);
  const required = [
    "forge_status",
    "forge_update_state",
    "forge_record_artifact",
    "forge_worktree_delegate",
    "forge_review_worktree",
    "forge_model_route",
    "forge_handoff",
    "forge_drift_decision",
    "forge_doctor",
  ];

  return required.map((name) => ({
    name: `Tool registered: ${name}`,
    status: toolNames.includes(name) ? "pass" : "fail",
    evidence: toolNames.includes(name) ? "registered in current pi runtime" : "not found in pi.getAllTools(); try /reload or check package install",
  }));
}

async function inspectForgeState(cwd: string): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const statePath = resolve(cwd, FORGE_STATE_PATH);
  const exists = existsSync(statePath);
  checks.push({
    name: "Forge state file",
    status: exists ? "pass" : "warn",
    evidence: exists ? `${FORGE_STATE_PATH} present` : `${FORGE_STATE_PATH} missing; forge-core can create it on demand`,
  });

  const state = await ensureForgeState(cwd);
  checks.push({
    name: "Forge state schema shape",
    status: state.version === 1 && Boolean(state.current_task) && Boolean(state.artifacts) ? "pass" : "fail",
    evidence: `version=${state.version}, task=${state.current_task?.title ?? "none"}, status=${state.current_task?.status ?? "unknown"}`,
  });
  checks.push({
    name: "Forge verification health",
    status: state.current_task.verification.failures.length === 0 ? "pass" : "warn",
    evidence: `verification=${state.current_task.verification.status}, failures=${state.current_task.verification.failures.length}`,
  });
  checks.push({
    name: "Forge drift health",
    status: state.current_task.drift.escalation_required ? "warn" : "pass",
    evidence: `drift=${state.current_task.drift.detected ? "detected" : "none"}, escalation=${state.current_task.drift.escalation_required ? "required" : "not required"}`,
  });
  return checks;
}

function summarizeChecks(checks: DoctorCheck[]) {
  return {
    pass: checks.filter((check) => check.status === "pass").length,
    warn: checks.filter((check) => check.status === "warn").length,
    fail: checks.filter((check) => check.status === "fail").length,
    total: checks.length,
  };
}

function formatReport(checks: DoctorCheck[], summary: ReturnType<typeof summarizeChecks>): string {
  const icon = (status: DoctorCheck["status"]) => status === "pass" ? "✅" : status === "warn" ? "⚠️" : "❌";
  return [
    "Forge Doctor Report",
    "═".repeat(50),
    `Summary: ${summary.pass} passed, ${summary.warn} warning(s), ${summary.fail} failure(s), ${summary.total} total`,
    "",
    ...checks.map((check) => `${icon(check.status)} ${check.name}\n   ${check.evidence}`),
  ].join("\n");
}
