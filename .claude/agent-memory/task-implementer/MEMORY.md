# Task Implementer Memory

## Project Structure

- **Monorepo:** Turborepo + pnpm workspace
- **CLI package:** `/Users/ftanyol/Projects/aitelier/packages/cli/`
- **Task tracking:** TASKS.md in project root
- **Project rules:** CLAUDE.md defines code standards and workflow

## Task Management System

- Tasks tracked in `/Users/ftanyol/Projects/aitelier/TASKS.md`
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

## Web App Implementation Patterns

### React Hooks and ESLint Rules

- When using event handlers in `useEffect` that depend on component functions, wrap those functions with `useCallback` to avoid stale closures
- ESLint rule `react-hooks/exhaustive-deps` requires all dependencies to be listed
- ESLint rule `react-hooks/immutability` prevents accessing variables before they are declared
- Functions must be declared before being referenced in `useEffect`, or use `useCallback` with proper dependencies

### Framer Motion Integration

- Install with `pnpm add framer-motion`
- Use `AnimatePresence` with `mode="wait"` to animate between different components
- Wrap animated components with `motion.div` and set `initial`, `animate`, `exit` props
- Key prop is essential for AnimatePresence to track component identity changes
- Typical slide-in animation: `initial={{ opacity: 0, x: 20 }}`, `animate={{ opacity: 1, x: 0 }}`, `exit={{ opacity: 0, x: -20 }}`
- Use `transition={{ duration: 0.2 }}` for smooth, subtle animations

### Server Actions with Optional Parameters

- When server actions have optional parameters (e.g., `rewrite?: string`), build update object conditionally
- Example pattern:
  ```typescript
  const updateData: { required: type; optional?: type } = { required: value };
  if (optional !== undefined) {
    updateData.optional = optional;
  }
  ```

### Keyboard Shortcuts Implementation

- Add event listener to `window` in `useEffect`, clean up in return function
- Check `e.target instanceof HTMLTextAreaElement` to avoid triggering shortcuts while typing
- Use `e.preventDefault()` to prevent default browser behavior
- Support modifier key checks: `!e.metaKey && !e.ctrlKey`
- Number keys: `e.key >= '1' && e.key <= '9'` for 1-9, special case for 0 = 10
- Common shortcuts: `r` for action, `s` for skip, `Escape` to cancel, arrow keys for navigation

### URL Search Params for Filters/Sorting

- Use Next.js `searchParams` in page.tsx (async prop)
- Parse params with defaults: `const filter = (params.filter ?? 'unrated') as FilterType`
- Pass filter/sort to server action for Supabase query
- Client component uses `useRouter()` and `useSearchParams()` to update URL
- Update URL with `router.push(\`/path?${params.toString()}\`)`
- Include filter/sort in Suspense key to trigger re-fetch: `key={\`${projectId}-${filter}-${sort}\`}`
- Define filter/sort types in actions.ts and export for type safety

## Completed Tasks

### Task W1.6: Rating Filters & Sorting (Web)

- Implemented filter dropdown: Unrated (default), All, Below threshold, Needs rewrite
- Implemented sort dropdown: Newest, Oldest, Random, Rating (low to high), Rating (high to low)
- Created `RatingControls` client component with shadcn Select components
- Extended server action `getExamples()` to accept filter and sort parameters
- Filter logic: unrated checks null rating, below-threshold uses project's quality_threshold
- Sort logic: newest/oldest use created_at, rating sorts use rating field, random sorts client-side
- URL search params persist filter/sort state across navigation
- Suspense key includes filter/sort to trigger re-fetch on change
- Type-safe filter and sort enums exported from actions.ts

### Task W1.5: Rating Rewrite Flow + Keyboard Shortcuts (Web)

- Installed Framer Motion for animations
- Implemented slide-up rewrite panel with `AnimatePresence` and height animation
- Added textarea for editing output with auto-focus on activation
- Card transition animations using `motion.div` with slide effect
- Comprehensive keyboard shortcuts: 1-0 for ratings, R for rewrite, S for skip, → for next, Escape to cancel
- Visual keyboard legend displayed below rating controls
- Updated server action to accept optional `rewrite` parameter
- All handlers wrapped with `useCallback` to satisfy ESLint exhaustive-deps rule
- Rewrite disables rating buttons until saved or cancelled

### Task #6: ait eval command (M3.1)

- Implemented interactive evaluation command that runs fine-tuned models on validation examples
- Uses Together.ai chat completions API via `provider.runInference()` method
- Side-by-side comparison of expected vs actual outputs
- 1-5 scoring system (different from 1-10 rating system for examples)
- Calculates average score and sendable rate (4+ out of 5)
- Saves detailed results to `data/evals/eval-{modelId}-{date}.json`
- Handles API errors gracefully by skipping failed examples
- Supports skip and quit actions during evaluation
- Comprehensive test coverage with 8 test cases

### Task #7: ait eval --compare command (M3.2)

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
  throw new Error('Project not initialized. Run `ait init` first...');
}
```

### Display Formatting

- Use `═` for major section dividers (70 chars)
- Use `━` for minor section dividers (70 chars)
- Use `│` for histogram bars and data separators
- Use `█` for histogram bar characters
