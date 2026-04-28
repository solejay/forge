---
name: mobile-doctor
description: >
  Diagnose forge-mobile-dev package installation and iOS/Android toolchain issues.
  Use when the extension isn't triggering, routing isn't working, agents aren't activating,
  or the build/deploy toolchain needs verification.
  Triggers on: diagnose, doctor, why isn't triggering, check toolchain, mobile setup,
  mobile doctor, extension not working.
triggers: ["diagnose", "doctor", "why isn't triggering", "check toolchain", "mobile setup", "mobile doctor", "extension not working"]
version: 1.0.0
---

# Mobile Doctor

Diagnose why forge-mobile-dev isn't working as expected.

## When to Use

- "Why isn't my mobile extension triggering?"
- "Diagnose my iOS toolchain"
- "Check simulator/build/deploy setup"
- "Keyword routing isn't detecting my prompts"
- "Agent personas aren't being injected"

## Run Diagnostic

```bash
bash scripts/mobile-doctor.sh
```

## Interpret Results

The script checks 7 layers:

1. **Files** — are agent personas, skills, and scripts present in the package?
2. **Extension Loading** — is the pi extension loaded? (check `pi` startup output)
3. **Pi Installation** — is forge-mobile-dev installed? (`pi list`)
4. **Tool Registration** — are `delegate_to_agent`, `mobile_loop`, `discover_mobile_project` tools available?
5. **Agent Personas** — do agent files exist in `agents/` directory?
6. **Skill Validity** — do skill files have correct frontmatter (name, description)?
7. **Toolchain** — are Xcode, simulators, SwiftLint, etc. available?

## Common Fixes

| Issue | Fix |
|-------|-----|
| Package not listed | Re-run `pi install -l .` from the package directory |
| Extension not loading | Check pi startup output for errors; run `pi -e ./extensions/forge-mobile/index.ts` to test |
| Tools not registered | Run `/reload` in pi to reload extensions |
| Routing not triggering | Check keyword thresholds — prompt may not have enough mobile signals |
| Agent personas missing | Ensure `agents/*.md` files exist in the package directory |
| Skills not found | Run `pi list` and verify the package is installed |
