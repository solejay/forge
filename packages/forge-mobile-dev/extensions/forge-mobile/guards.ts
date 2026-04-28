/**
 * guards.ts — File protection and post-edit linting
 *
 * Replaces pbxproj-guard.mjs (PreToolUse hook) and lint-guard.mjs (PostToolUse hook).
 *
 * - Blocks direct .pbxproj edits with safe alternatives
 * - Runs SwiftLint/ktlint after Swift/Kotlin file edits
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

export function registerGuards(pi: ExtensionAPI) {
  // ─── pbxproj guard (replaces pbxproj-guard.mjs) ───────────────────────

  pi.on("tool_call", async (event, _ctx) => {
    let paths: string[] = [];

    if (isToolCallEventType("write", event)) {
      paths.push(event.input.path || "");
    } else if (isToolCallEventType("edit", event)) {
      paths.push(event.input.path || "");
    }

    const isPbxproj = paths.some((p) => p.endsWith(".pbxproj"));
    if (!isPbxproj) return;

    return {
      block: true,
      reason: `Direct .pbxproj edits are blocked. The .pbxproj format is fragile XML that breaks silently when edited as text.

Safe alternatives:

OPTION 1 — Tuist (if project uses it):
  Edit the manifest file (Project.swift) and run: tuist generate

OPTION 2 — XcodeGen (if project uses it):
  Edit project.yml and run: xcodegen generate

OPTION 3 — xcodeproj gem (Ruby):
  ruby -e "
    require 'xcodeproj'
    project = Xcodeproj::Project.open('YourApp.xcodeproj')
    target = project.targets.find { |t| t.name == 'YourApp' }
    group = project.main_group['YourApp']
    ref = group.new_file('NewFile.swift')
    target.source_build_phase.add_file_reference(ref)
    project.save
  "

OPTION 4 — Manual instruction:
  Describe the change needed and instruct the user to add the file in Xcode GUI.`,
    };
  });

  // ─── Lint guard (replaces lint-guard.mjs) ─────────────────────────────

  pi.on("tool_result", async (event, _ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const path: string = (event.input as Record<string, unknown>)?.path as string || "";
    if (!path) return;

    const isSwift = path.endsWith(".swift");
    const isKotlin = path.endsWith(".kt") || path.endsWith(".kts");
    if (!isSwift && !isKotlin) return;

    const violations: LintViolation[] = [];

    if (isSwift) {
      try {
        const result = await pi.exec("swiftlint", ["lint", "--path", path, "--reporter", "json", "--quiet"], {
          timeout: 10_000,
        });
        if (result.stdout) {
          const results = JSON.parse(result.stdout) as SwiftLintResult[];
          for (const r of results) {
            violations.push({
              file: r.file || path,
              line: r.line || 0,
              severity: r.severity === "Error" ? "ERROR" : "WARNING",
              rule: r.rule_id || "unknown",
              message: r.reason || r.message || "",
            });
          }
        }
      } catch {
        // SwiftLint not installed or failed — skip silently
      }
    }

    if (isKotlin) {
      try {
        const result = await pi.exec("ktlint", ["--reporter=json", path], { timeout: 10_000 });
        if (result.stdout) {
          const results = JSON.parse(result.stdout) as KtlintFileResult[];
          for (const fileResult of results) {
            for (const err of fileResult.errors || []) {
              violations.push({
                file: fileResult.file || path,
                line: err.line || 0,
                severity: "WARNING",
                rule: err.rule || "unknown",
                message: err.message || "",
              });
            }
          }
        }
      } catch {
        // ktlint not installed or failed — skip silently
      }
    }

    if (violations.length === 0) return;

    // Build lint context to append to tool result
    const errors = violations.filter((v) => v.severity === "ERROR");
    const warnings = violations.filter((v) => v.severity === "WARNING");

    let context = "\n[Lint Violations Detected]";
    if (errors.length > 0) {
      context += `\n\n${errors.length} error(s) — should fix before proceeding:`;
      for (const e of errors) {
        context += `\n  ERROR ${e.file}:${e.line} [${e.rule}] ${e.message}`;
      }
    }
    if (warnings.length > 0) {
      context += `\n\n${warnings.length} warning(s) — consider fixing:`;
      for (const w of warnings.slice(0, 10)) {
        context += `\n  WARN  ${w.file}:${w.line} [${w.rule}] ${w.message}`;
      }
      if (warnings.length > 10) {
        context += `\n  ... and ${warnings.length - 10} more warnings`;
      }
    }

    return {
      content: [...event.content, { type: "text" as const, text: context }],
    };
  });
}

// --- Types ---

interface LintViolation {
  file: string;
  line: number;
  severity: "ERROR" | "WARNING";
  rule: string;
  message: string;
}

interface SwiftLintResult {
  file?: string;
  line?: number;
  severity?: string;
  rule_id?: string;
  reason?: string;
  message?: string;
}

interface KtlintFileResult {
  file?: string;
  errors?: Array<{
    line?: number;
    rule?: string;
    message?: string;
  }>;
}
