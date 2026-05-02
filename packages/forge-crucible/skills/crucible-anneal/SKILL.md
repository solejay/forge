---
name: crucible-anneal
description: Apply Forge Crucible proposals that a human explicitly marked [APPLY] in pipeline/crucible-proposals.md. Use when the user asks to anneal, apply approved crucible proposals, or close the ouroboros self-improvement loop.
version: 0.1.0
---

# Crucible Anneal

You are applying only human-approved Forge self-improvement proposals.

## Workflow

1. Read or inspect `pipeline/crucible-proposals.md` if needed.
2. Confirm that desired proposals are marked exactly `[APPLY]`.
3. Run `forge_anneal`.
4. Inspect changed files with git/status/diff.
5. Summarize exactly what was applied, skipped, and what still requires manual review.
6. If generated skill stubs were created, remind the user they are drafts until edited.

## Safety Rules

- Never apply unchecked `[ ]` proposals.
- Never silently patch AGENTS.md, CLAUDE.md, secrets files, or broad orchestration prompts unless the tool explicitly supports it and the user approved it.
- Route proposals may create human-fillable placeholders in `pipeline/model-routes.json`; do not pretend placeholder models are final.
- Skill proposals create stubs only; they require human/agent editing before operational use.

## Completion

End with:

```markdown
## Crucible Anneal Complete

Applied:
- ...

Skipped/manual:
- ...

Verification:
- reviewed changed files
- anneal signal recorded in pipeline/signal-log.jsonl
```
