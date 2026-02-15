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

### Shadcn Charts Integration

- Install charts with `pnpm dlx shadcn@latest add chart` (will also install recharts dependency)
- Use `ChartContainer`, `ChartConfig`, `ChartTooltip`, `ChartLegend` from `@/components/ui/chart`
- Bar charts use `BarChart`, `Bar`, `CartesianGrid`, `XAxis`, `YAxis` from recharts
- Define color scheme in `chartConfig` with CSS variables like `hsl(var(--chart-1))`
- Chart components are client-side (`"use client"`)

## Completed Tasks

### Task W2.3: Dashboard Training Timeline + Activity Feed (Web)

- Created `getTrainingRuns()` server action in dashboard actions.ts
- Returns last 10 training runs with status, example count, model ID, timestamps, errors
- Created `getRecentActivity()` server action for activity feed
- Aggregates events from examples (created, rated) and training runs (started, completed)
- Sorts by timestamp descending, returns last 20 events
- Created `TrainingTimeline` component with horizontal run cards
- Status badges with color coding: pending, uploading, queued, training, completed, failed, cancelled
- Animated spinner for active runs (training, uploading)
- Shows run number, example count, relative date, model ID (if completed)
- Created `ActivityFeed` component with icon-coded events
- Event types: example_added (Plus), example_rated (Star), training_started (Zap), training_completed (CheckCircle2)
- Relative timestamps: "just now", "5m ago", "2h ago", "3d ago", "1w ago"
- Empty states for both components with helpful messaging
- Integrated into dashboard with Suspense and skeleton loading states
- Two-column grid layout on desktop for timeline + activity feed
- TypeScript type casting needed for Supabase status field (returns generic string, not union type)
- Note: Team leaderboard deferred for later multi-user work

### Task W2.2: Dashboard Rating Distribution Chart (Web)

- Created `getRatingDistribution()` server action in dashboard actions.ts
- Returns rating distribution (1-10 with train/val counts) and split stats (train/val/unassigned counts)
- Created `RatingDistributionChart` component using Shadcn Charts with stacked bar chart
- Created `ReadinessIndicator` component with three states: ready (20+ quality, 10+ train, 2+ val), almost ready, not ready
- Used color-coded cards with CheckCircle2/AlertCircle/XCircle icons
- Integrated into dashboard with Suspense and skeleton loading states
- Layout: 2/3 chart, 1/3 readiness indicator on desktop

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

### Task W2.1: Dashboard Key Metrics Cards (Web)

- Created `getDashboardMetrics()` server action in `/dashboard/actions.ts`
- Queries: total examples, rated count, quality count (above threshold), completed training runs
- Created reusable `MetricCard` component with icon, label, value, description
- Created `MetricCardSkeleton` for loading state
- Dashboard displays 4 metric cards in responsive grid (2 cols on tablet, 4 on desktop)
- Icons: Database (total), CheckCircle2 (rated), BarChart3 (quality), Sparkles (models)
- Rated card shows percentage calculation dynamically
- Uses Suspense for async data loading with skeleton fallback
- Dashboard reads active project from cookie (same pattern as rate page)

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
