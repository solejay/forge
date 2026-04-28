# Forge

Forge is a set of [pi](https://github.com/badlogic/pi-mono) packages for building an extensible agentic harness around coding, design, and mobile engineering workflows.

## Packages

```txt
packages/
├── forge-core/           # shared harness primitives
├── forge-design-studio/  # PRD → design artifacts pipeline
└── forge-mobile-dev/     # iOS/Android engineering harness
```

## What Forge provides

### `@forge/forge-core`

- `pipeline/state.json` world state
- planning/review skills
- drift detection and drift decisions
- worktree-isolated delegation
- reviewer merge gate
- role-based model routing
- context handoff / context-rot management
- install/package doctor

### `@forge/forge-design-studio`

- design app pipeline
- design brief generation
- style guide generation
- microcopy generation
- screen prompt generation
- design QA

### `@forge/forge-mobile-dev`

- iOS/Android prompt routing
- mobile specialist agents
- simulator/emulator visual verification loop
- crash triage
- deployment helpers
- accessibility/performance/motion/code-signing skills

## Install

### Recommended: one-command GitHub install

```bash
pi install git:github.com/solejay/forge@v0.1.0
```

For the latest development version:

```bash
pi install git:github.com/solejay/forge
```

The root package manifest exposes all Forge extensions and skills from `packages/`.

### Local checkout install

From this repository root:

```bash
pi install .
```

or from anywhere:

```bash
pi install /path/to/forge
```

### Advanced: install individual subpackages

Use this only if you want a subset of Forge:

```bash
pi install /path/to/forge/packages/forge-core
pi install /path/to/forge/packages/forge-design-studio
pi install /path/to/forge/packages/forge-mobile-dev
```

Do not install both the root `forge` package and the individual subpackages at the same time, or tools/commands may be registered twice.

After installing or updating extensions, run:

```txt
/reload
```

or restart pi.

## Usage examples

Forge is designed around a simple loop:

```txt
route → plan → execute → verify → update world state → escalate or continue
```

The shared memory for that loop is:

```txt
pipeline/state.json
```

### 1. Start any meaningful task with a plan

In pi:

```txt
/forge-plan
```

Or ask directly:

```txt
Add offline caching to the transactions screen. Use Forge planning first, then implement.
```

Useful tools:

```txt
forge_status
forge_update_state
```

Typical flow:

```txt
forge_status
  ↓
write plan contract to pipeline/state.json
  ↓
execute focused changes
  ↓
/forge-review
```

### 2. Check current harness state

```txt
/forge-status
```

or ask:

```txt
Run forge_status and tell me what task is active, what step we are on, and whether verification passed.
```

### 3. Handle drift safely

If Forge detects that a task changed shape, it blocks and asks for a decision:

```txt
continue / replan / stop
```

You can record the decision explicitly:

```txt
forge_drift_decision decision=continue reason="accepted expanded scope"
forge_drift_decision decision=replan reason="this became an architecture change"
forge_drift_decision decision=clear reason="false positive from planned edits"
```

Use `replan` when a bug turns into a refactor or a small feature turns into an architecture change.

### 4. Run parallel work in isolated worktrees

Use `forge_worktree_delegate` when multiple agents may edit the repo at the same time:

```txt
forge_worktree_delegate \
  isolation=worktree \
  role=implement \
  task="Implement the iOS half of the notifications feature."
```

For mobile split work:

```txt
delegate_to_agent agent=ios-engineer isolation=worktree role=implement task="Implement this feature for iOS only."
delegate_to_agent agent=android-engineer isolation=worktree role=implement task="Implement this feature for Android only."
```

Each delegated result returns:

```txt
worktree path
branch name
base branch
review instructions
```

### 5. Review, validate, then merge worktree branches

Stage 4 adds a reviewer merge gate. Default action is review-only:

```txt
forge_review_worktree \
  action=review \
  worktreePath=/path/to/worktree \
  baseBranch=main \
  branchName=forge/my-task
```

Run validation commands before merge:

```txt
forge_review_worktree \
  action=validate \
  worktreePath=/path/to/worktree \
  baseBranch=main \
  branchName=forge/my-task \
  validationCommands=["npm test", "npm run lint"]
```

Merge only after validation passes and you want the branch accepted:

```txt
forge_review_worktree \
  action=merge \
  worktreePath=/path/to/worktree \
  baseBranch=main \
  branchName=forge/my-task \
  validationCommands=["npm test"] \
  cleanupAfterMerge=true
```

### 6. Route work to different models by role

Create an optional route file:

```txt
pipeline/model-routes.json
```

Example:

```json
{
  "quick": { "modelString": "openrouter/openai/gpt-5.5-mini", "thinkingLevel": "low" },
  "plan": { "modelString": "openrouter/openai/gpt-5.5", "thinkingLevel": "high" },
  "review": { "modelString": "openrouter/anthropic/claude-sonnet-4.5", "thinkingLevel": "high" }
}
```

Inspect routes:

```txt
forge_model_route action=show role=review
```

Switch the current session model explicitly:

```txt
forge_model_route action=switch role=plan
```

Use a role for a delegated agent:

```txt
forge_worktree_delegate role=review task="Review this branch for correctness and risk."
```

### 7. Handoff before context rot

When a session gets long:

```txt
/forge-handoff continue implementing the mobile checkout flow
```

This creates a fresh session prompt from `pipeline/state.json`, not from the full transcript.

For a non-interactive snapshot:

```txt
forge_handoff action=snapshot goal="continue from the current step"
```

### 8. Use the design pipeline

Create a PRD:

```txt
pipeline/prd.md
```

Then run:

```txt
/design-app
```

Artifacts produced for engineering:

```txt
pipeline/design-brief.json
pipeline/style-guide.json
pipeline/copy-deck.json
pipeline/screen-prompts/
pipeline/screens/
pipeline/backend-api-spec.json
```

Check progress:

```txt
/design-status
```

### 9. Implement mobile UI from design artifacts

When `pipeline/style-guide.json`, `copy-deck.json`, and `screens/` exist, `forge-mobile-dev` injects them as source-of-truth context.

Example prompt:

```txt
Implement the Home screen from the Forge design artifacts. Use the style guide tokens and copy deck exactly. After the UI change, run mobile_loop.
```

Visual verification:

```txt
mobile_loop platform=ios
mobile_loop platform=android
```

### 10. Diagnose Forge itself

```txt
/forge-doctor
```

or:

```txt
forge_doctor
```

Checks include installed packages, package manifests, important files, active tools, and `pipeline/state.json` health.

## Smoke tests

```bash
npm run smoke
```

This verifies:

- each individual package extension loads in print mode
- the root monorepo package manifest loads all Forge resources
- Forge tools are discoverable

## Doctor

```bash
npm run doctor
```

or in pi:

```txt
/forge-doctor
```

## Release/versioning

See [`RELEASE.md`](RELEASE.md).

Current release:

```txt
v0.1.0
```

Bump all package versions with:

```bash
scripts/bump-version.sh 0.2.0
```

## Safety

Forge state and diagnostics should never store or commit:

- API keys
- provider tokens
- full transcripts
- private logs
- generated session JSONL files

## License

MIT
