# Task Implementer Memory

## Project Structure

- **Monorepo:** Turborepo + pnpm workspace
- **CLI package:** `/Users/ftanyol/Projects/ft-pipeline/packages/cli/`
- **Task tracking:** TASKS.md in project root
- **Project rules:** CLAUDE.md defines code standards and workflow

## Task Management System

- Tasks tracked in `/Users/ftanyol/Projects/ft-pipeline/TASKS.md`
- Format: Markdown checklist with `[ ]` (pending) and `[x]` (completed)
- Organized by milestones (M1, M2, M3, M4)
- Update TASKS.md after completing each task

## Implementation Patterns

### Command Structure

- All CLI commands in `packages/cli/src/commands/`
- Pattern: one file per command (e.g., `rate.ts`, `stats.ts`)
- Each command exports `register{CommandName}(program: Command)` function
- Use Commander.js for CLI framework, Inquirer.js for interactive prompts

### Testing Pattern

- Tests colocated with commands (e.g., `rate.test.ts`, `stats.test.ts`)
- Use Vitest for testing
- Create temp directories for each test with `mkdtemp`
- Mock Inquirer prompts with `vi.spyOn(inquirer, 'prompt')`
- Test both success and error paths

### Validation Pattern

- When validating data structures, check structure validity BEFORE checking for specific required fields
- Example: Check if message roles are valid before checking if specific roles exist
- This provides clearer error messages and catches structural issues first

### Code Verification Workflow

After every change, run this command sequence:

```bash
pnpm turbo build && pnpm prettier --write . && pnpm turbo lint && pnpm turbo test
```

## Common File Paths

- Config file: `.ftpipeline.json` (contains qualityThreshold)
- Examples file: `data/examples.jsonl`
- Train/val files: `data/train.jsonl`, `data/val.jsonl`
- Storage modules: `src/storage/dataset.ts`, `src/storage/config.ts`

## Code Style

- Use TypeScript strict mode
- Follow KISS, DRY, YAGNI principles
- No emojis in output unless explicitly requested
- Use helper functions for cleaner code organization
- Prefix unused parameters with underscore for linting (only works for function args, not destructured vars)
- For unused destructured variables, use `.values()` or refactor to avoid the variable entirely
- Use `as const` for message role literals in tests to satisfy TypeScript strict typing

## Completed Tasks

### Task #6: ft eval command (M3.1)

- Implemented interactive evaluation command that runs fine-tuned models on validation examples
- Uses Together.ai chat completions API via `provider.runInference()` method
- Side-by-side comparison of expected vs actual outputs
- 1-5 scoring system (different from 1-10 rating system for examples)
- Calculates average score and sendable rate (4+ out of 5)
- Saves detailed results to `data/evals/eval-{modelId}-{date}.json`
- Handles API errors gracefully by skipping failed examples
- Supports skip and quit actions during evaluation
- Comprehensive test coverage with 8 test cases

### Task #7: ft eval --compare command (M3.2)

- Implemented blind A/B testing between base model and fine-tuned model
- Runs inference on both models in parallel using `Promise.all()`
- Randomly assigns outputs to "Model A" and "Model B" for blind scoring
- User scores both outputs without knowing which is which
- After all evaluations, reveals which was which
- Shows comparison statistics: average scores, win rates, head-to-head, improvement percentage
- Saves results to `data/evals/compare-{modelId}-{date}.json`
- Base model ID comes from `config.model`, fine-tuned from latest completed run
- Comprehensive test coverage with 6 test cases including randomization verification

### Task #8: Update README.md with complete documentation (M4.1)

- Added badges for npm version, license, Node version, TypeScript
- Created comprehensive table of contents
- Expanded "Why This Exists" section with problem/solution format
- Added concrete use cases: customer support bot, code review assistant, domain-specific Q&A
- Updated features list to show all completed features (✅)
- Rewrote all command documentation with:
  - Detailed examples showing actual command output
  - All options with descriptions
  - Prerequisites and requirements
  - Actions available per command
- Added mermaid architecture diagram showing workflow, storage, and provider integration
- Expanded Provider Setup section with cost estimates, recommended models, setup steps
- Created comprehensive Troubleshooting section with 7+ common issues and solutions
- Updated Development section with prerequisites, workflow, project structure
- Updated Roadmap to show v0.1.0 features complete, in-progress items, and future plans
- Enhanced Contributing section with guidelines
- Fixed `--compare` flag documentation (boolean flag, not argument)

## Documentation Standards

### README.md Structure

- Include badges at top (npm version, license, Node version, TypeScript)
- Add table of contents for easy navigation
- Use clear sections: Why This Exists, Use Cases, Features, Installation, Quick Start, Commands, Provider Setup, Architecture, Development, Troubleshooting, Roadmap, Contributing
- Each command should have:
  - Basic description
  - Example usage with actual command output
  - Options with descriptions
  - Prerequisites/requirements where applicable
- Include mermaid diagram for system architecture
- Provide troubleshooting section with common errors and solutions
- Show practical use cases with concrete examples

## Common Patterns

### Error Handling

```typescript
try {
  await commandFunction();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
```

### Project Initialization Check

```typescript
try {
  await access(join(cwd, CONFIG_FILE));
} catch {
  throw new Error('Project not initialized. Run `ft init` first...');
}
```

### Display Formatting

- Use `═` for major section dividers (70 chars)
- Use `━` for minor section dividers (70 chars)
- Use `│` for histogram bars and data separators
- Use `█` for histogram bar characters
