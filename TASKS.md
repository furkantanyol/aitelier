# TASKS — aitelier

Track progress by checking off tasks as they're completed.

---

## Milestone 1: Core CLI — Init, Add, Rate

### M1.1 — Project Setup

- [x] Initialize monorepo (Turborepo + pnpm)
- [x] Set up `packages/cli` with TypeScript, Commander.js, Vitest
- [x] Configure ESLint, Prettier, tsconfig strict mode
- [x] Set up CI (GitHub Actions: lint + test)
- [x] Create initial README with project description

### M1.2 — `ait init` Command

- [x] Interactive prompts: project name, provider (together/openai), model, system prompt
- [x] Generate `.aitelier.json` config file
- [x] Create `data/` directory with `examples.jsonl`, `train.jsonl`, `val.jsonl`
- [x] Write tests for init flow

### M1.3 — `ait add` Command

- [x] Interactive mode: paste input → paste output → auto-format to chat JSONL
- [x] File mode: `ait add --input input.txt --output output.txt`
- [x] Auto-append to `data/examples.jsonl` with metadata (timestamp, rating: null, version)
- [x] Validate JSON structure on save
- [ ] Support for multi-turn conversations (array of messages)
- [x] Write tests

### M1.4 — `ait rate` Command

- [x] Show unrated examples one by one (interactive)
- [x] Display: system prompt + input + output, formatted in terminal
- [x] Rate 1-10, option to rewrite output inline
- [x] If rewrite: save rewritten version as training target, keep original as metadata
- [x] `ait rate --min 8` — only show examples rated below 8 for re-review
- [x] Summary stats after session
- [x] Write tests

### M1.5 — `ait stats` Command

- [x] Total examples, rated count, unrated count
- [x] Rating distribution (histogram in terminal)
- [x] Examples above quality threshold (configurable, default 8+)
- [x] Train/val split status
- [x] Write tests

---

## Milestone 2: Format, Split, Train

### M2.1 — `ait format` Command

- [x] Export rated examples (above threshold) to provider-specific JSONL
- [x] Together.ai format: standard chat messages
- [x] OpenAI format: standard chat messages with optional `weight` field
- [x] Validate output against provider schema
- [x] Output to `data/train.jsonl` and `data/val.jsonl`
- [x] Write tests

### M2.2 — `ait split` Command

- [x] Auto-split: 80/20 train/val by default
- [x] Stratified by rating if enough examples
- [x] `ait split --ratio 0.9` for custom splits
- [x] Lock validation set: once assigned, val examples don't move to train
- [x] `ait split --reshuffle` to force re-split (with confirmation)
- [x] Write tests

### M2.3 — `ait train` Command

- [x] Upload training file to Together.ai via API
- [x] Create LoRA fine-tune job with sensible defaults
- [x] Configurable: epochs, batch_size, learning_rate, lora_r, lora_alpha
- [x] Save job ID + config to `.aitelier.json` under `runs[]`
- [x] Requires `TOGETHER_API_KEY` env var
- [x] Write tests

### M2.4 — `ait status` Command

- [x] Check fine-tune job status via provider API
- [x] `ait status` — show latest job
- [x] `ait status --all` — show all runs with model IDs
- [x] When complete: save model ID to config
- [x] Write tests

---

## Milestone 3: Eval

### M3.1 — `ait eval` Command

- [x] Run fine-tuned model on all validation examples
- [x] Side-by-side display: expected output vs model output
- [x] Interactive scoring per example
- [x] Summary: average score, sendable rate
- [x] Save eval results to `data/evals/eval-{version}-{date}.json`
- [x] Write tests

### M3.2 — `ait eval --compare` Mode

- [x] Run base model AND fine-tuned model on same inputs
- [x] Show A vs B (blind, randomized order)
- [x] After scoring: reveal which was which + aggregate stats
- [x] Write tests

---

## Milestone 4: README, Examples, Polish

### M4.1 — README.md

- [x] One-line description + quick start
- [ ] CLI demo GIF/video (asciinema or vhs)
- [x] Architecture diagram (mermaid)
- [x] Provider setup guides (Together, OpenAI)
- [x] Example use cases (customer support, code review, domain Q&A)
- [x] Contributing guide
- [x] Comprehensive command documentation with examples
- [x] Troubleshooting section
- [x] Badges and table of contents
- [x] Updated features list and roadmap

### M4.2 — Example Projects

- [x] `examples/customer-support/` — 25 training examples + walkthrough
- [x] `examples/code-review/` — 5 training examples + walkthrough

### M4.3 — Package Publishing

- [x] Publish to npm as `aitelier`
- [x] `npx aitelier` works out of the box
- [x] GitHub releases with changelog
- [x] Badges: npm version, CI status, license

### M4.4 — Launch

- [ ] Hacker News (Show HN)
- [ ] r/LocalLLaMA, r/MachineLearning
- [ ] Twitter/X thread with GIF demo

---

## Web App — Design & UI Guidelines

- **Component library:** Shadcn/UI (new-york style) + Tailwind CSS
- **Design goal:** Elegant, polished, professional — not a developer tool aesthetic. Clean typography, generous whitespace, subtle animations, consistent color palette.
- **Dark mode** as default, with a refined dark palette (not harsh black — use zinc/slate tones)
- Every page should feel intentional and well-crafted, even placeholders

---

## Web App — Milestone 0: Foundation

### W0.1 — Scaffold Next.js 15 App
**Deps:** None · **Size:** S

- [x] Initialize Next.js 15 app (app router) at `packages/web/` with TypeScript, Tailwind CSS, ESLint, `src/` dir
- [x] Install and init Shadcn/UI (new-york style, neutral base color, CSS variables)
- [x] Ensure `pnpm turbo build` builds both CLI and web
- [x] Add `"lint": "eslint src/"` script (Next.js 16 dropped `next lint`)
- [x] Create `packages/web/CLAUDE.md` with web-specific guidelines

### W0.2 — Supabase Client Setup
**Deps:** W0.1 · **Size:** S

- [x] Install `@supabase/supabase-js` and `@supabase/ssr`
- [x] Create server-side client helper (`src/lib/supabase/server.ts`) using `createServerClient`
- [x] Create browser-side client helper (`src/lib/supabase/client.ts`) using `createBrowserClient`
- [x] Create middleware helper (`src/lib/supabase/middleware.ts`) for auth session refresh
- [x] Create placeholder `types.ts` with empty `Database` type
- [x] Add `.env.local.example` with Supabase env var placeholders

### W0.3 — Database Schema & Types
**Deps:** W0.2 · **Size:** M

- [x] Create SQL migration `supabase/migrations/001_initial_schema.sql` with tables: `projects`, `examples`, `training_runs`, `evaluations`, `project_members`
- [x] Add RLS policies (project membership + role-based access: owner/trainer/rater)
- [x] Auto-generate TypeScript types via `pnpm db:gen-types` (uses `supabase gen types`)

### W0.4 — Auth: Magic Link Login
**Deps:** W0.2 · **Size:** M

- [x] Create Next.js middleware (`src/middleware.ts`) for auth session refresh + redirect to `/login`
- [x] Create login page with email input + "Send Magic Link" button (Shadcn Card/Input/Button)
- [x] Create `/auth/callback` route to exchange code for session → redirect to `/dashboard`
- [x] Server action for `signInWithOtp`

### W0.5 — App Shell & Navigation
**Deps:** W0.4 · **Size:** M

- [x] Create `(app)` route group for authenticated pages
- [x] Create sidebar with nav links: Dashboard, Rate, Add, Train, Eval, Playground, Settings
- [x] Active link highlighting, collapsible on mobile
- [x] User menu (email + sign-out)
- [x] Dark mode as default
- [x] Placeholder dashboard page

---

## Web App — Milestone 1: Data Layer

### W1.1 — Project Setup Wizard (Steps 1-3: Basics, Provider, Model)
**Deps:** W0.5, W0.3 · **Size:** L

- [ ] Multi-step wizard (client component with step state)
- [ ] Step 1 — Basics: project name + description
- [ ] Step 2 — Provider: Together.ai selector, API key input + "Test Connection" validation
- [ ] Step 3 — Model: dropdown fetched from Together.ai API, highlight recommended models

### W1.2 — Project Setup Wizard (Steps 4-6: Prompt, Config, Invite + Save)
**Deps:** W1.1 · **Size:** M

- [ ] Step 4 — System Prompt: textarea with clickable template presets
- [ ] Step 5 — Training Config: defaults + expandable advanced section + live cost estimate
- [ ] Step 6 — Invite Team: email + role input, skip option
- [ ] Save action: insert project + members + send invites → redirect to dashboard

### W1.3 — Add Examples Page
**Deps:** W0.5, W0.3 · **Size:** M

- [ ] Manual add tab: input + output textareas, optional rating slider, "Add & Next" flow
- [ ] Bulk import tab: JSONL file upload + JSON paste with preview
- [ ] Server actions: `addExample`, `importExamples`
- [ ] Validation errors for malformed input

### W1.4 — Rating Interface (Card UI + Rating Controls)
**Deps:** W0.5, W0.3 · **Size:** L

- [ ] Server component page fetching unrated examples
- [ ] RatingCard: input display ("What the AI saw") + output display ("What the AI said")
- [ ] Quick buttons: Great (8-10), Okay (5-7), Bad (1-4) with color coding
- [ ] Precise 1-10 slider + Skip button
- [ ] Progress indicator + session stats
- [ ] Auto-advance to next card after rating

### W1.5 — Rating: Rewrite Flow + Keyboard Shortcuts
**Deps:** W1.4 · **Size:** M

- [ ] "Rewrite" button → slide-up textarea (Framer Motion) pre-filled with output
- [ ] Card transition animations (slide out/in)
- [ ] Keyboard shortcuts: `1`-`0` rating, `r` rewrite, `s` skip, `→` next
- [ ] Shortcut legend below card

### W1.6 — Rating Filters & Sorting
**Deps:** W1.4 · **Size:** S

- [ ] Filter dropdown: Unrated (default), All, Below threshold, Needs rewrite
- [ ] Sort dropdown: Newest (default), Random, By rating
- [ ] Filters modify Supabase query, persist in session

---

## Web App — Milestone 2: Dashboard & Visualization

### W2.1 — Dashboard: Key Metrics Cards
**Deps:** W0.5, W0.3 · **Size:** M

- [ ] Server actions for aggregate stats (total, rated, quality, models trained)
- [ ] 4 metric cards with label, number, description
- [ ] Skeleton loading state

### W2.2 — Dashboard: Rating Distribution Chart
**Deps:** W2.1 · **Size:** M

- [ ] Use ShadCDN Charts, create rating histogram (1-10, color-coded)
- [ ] Train/val split stacked bar
- [ ] Readiness indicator ("Ready to train" / "Need X more quality examples")

### W2.3 — Dashboard: Training Timeline + Activity Feed
**Deps:** W2.1 · **Size:** M

- [ ] Training timeline: horizontal visual of runs (version, count, status badge, clickable)
- [ ] Activity feed: last 20 items with relative timestamps
- [ ] Team leaderboard (if multi-user)

---

## Web App — Milestone 3: Training Pipeline

### W3.1 — Training: Pre-flight Check + Config Editor
**Deps:** W0.5, W0.3 · **Size:** M

- [ ] Pre-flight: quality count, train split count, cost estimate, duration, warnings, diff from last run
- [ ] Config editor: epochs, batch, lr, LoRA params with presets (Conservative/Aggressive)
- [ ] Live cost re-estimation on config change

### W3.2 — Training: Split Management
**Deps:** W0.5, W0.3 · **Size:** M

- [ ] Visual split editor (unassigned/train/val groups)
- [ ] Auto-split button (80/20 stratified)
- [ ] Lock/unlock validation set with confirmation
- [ ] Split quality indicators (count + avg rating per split)

### W3.3 — Training: Together.ai Integration
**Deps:** W3.1, W3.2 · **Size:** L

- [ ] Together.ai provider module: formatExamplesToJSONL, uploadTrainingFile, createFineTuneJob, getJobStatus
- [ ] `startTraining` server action: fetch → format → upload → create job → save run
- [ ] "Start Training" button with confirmation modal
- [ ] Redirect to `/train/[runId]` on launch

### W3.4 — Training: Live Status Page
**Deps:** W3.3 · **Size:** M

- [ ] Dynamic route `/train/[runId]` with status display
- [ ] Poll Together.ai every 10s, update DB as status changes
- [ ] Status badge progression: Uploading → Queued → Training → Complete/Failed
- [ ] Cancel button, completed run shows model ID + "Run Evaluation" CTA

### W3.5 — Training: Run History
**Deps:** W3.3 · **Size:** S

- [ ] Sortable table of all runs (version, status, model, count, duration, cost, eval score, date)
- [ ] Row click → `/train/[runId]`
- [ ] Copy model ID button on completed runs

---

## Web App — Milestone 4: Evaluation

### W4.1 — Eval: Setup Page
**Deps:** W0.5, W0.3 · **Size:** S

- [ ] Model A / Model B dropdowns (completed runs + baseline)
- [ ] Auto-select val set with count display
- [ ] "Start Evaluation" → generate outputs for both models → redirect to comparison UI

### W4.2 — Eval: Blind Comparison UI
**Deps:** W4.1 · **Size:** L

- [ ] Full-screen layout: input context + two response cards side-by-side
- [ ] Random A/B assignment (stored, not re-randomized)
- [ ] Preference buttons: "A is better" / "Tie" / "B is better" + optional 1-10 scores
- [ ] Keyboard shortcuts: `a`, `t`, `b`
- [ ] Progress indicator, save to `evaluations` table

### W4.3 — Eval: Results Reveal + Historical Trends
**Deps:** W4.2 · **Size:** M

- [ ] Reveal animation showing model identities
- [ ] Win/loss/tie bar (green/red/gray)
- [ ] Per-example expandable breakdown
- [ ] Verdict text ("SHIP IT" / "need more data")
- [ ] Historical trends line chart (ShadCDN Charts)

---

## Web App — Milestone 5: Playground

### W5.1 — Playground: Single Model Chat
**Deps:** W0.5, W0.3 · **Size:** M

- [ ] Input textarea + streaming output panel
- [ ] Model selector (completed runs + base model)
- [ ] Temperature + max tokens sliders
- [ ] Generate / Regenerate buttons
- [ ] "Save as Example" button → creates unrated example

### W5.2 — Playground: Side-by-Side Comparison
**Deps:** W5.1 · **Size:** S

- [ ] "Compare" toggle → two output panels with independent model selectors
- [ ] Same input → both models stream simultaneously
- [ ] Quick preference buttons + response time display

---

## Web App — Milestone 6: Settings & Team

### W6.1 — Settings Page
**Deps:** W0.5, W0.3 · **Size:** M

- [ ] Project settings: name, description
- [ ] Provider config: API key, model, "Test Connection"
- [ ] Training defaults: epochs, batch, lr, LoRA params
- [ ] Team management: list members, invite, change role, remove
- [ ] Export: "Download Dataset as JSONL"
- [ ] Danger zone: "Delete Project" with double confirmation

---

## Web App — Milestone 7: Polish

### W7.1 — Mobile-Responsive Rating + Animations
**Deps:** W1.5 · **Size:** M

- [ ] Full mobile-responsive rating interface (full-width cards, stacked buttons, 44px tap targets)
- [ ] Swipe gestures: right = good (8), left = bad (3) with tilt + color overlay
- [ ] Polish card transition animations

### W7.2 — Real-time Collaboration
**Deps:** W0.2 · **Size:** M

- [ ] `useRealtime` hook for Supabase Realtime subscriptions
- [ ] Dashboard: auto-update metrics on data changes
- [ ] Rating page: skip examples rated by others + toast notification
- [ ] Team activity toasts ("David just rated 3 examples")

### W7.3 — Empty States & Onboarding
**Deps:** W0.5 · **Size:** S

- [ ] Reusable `EmptyState` component (icon, title, description, action button)
- [ ] Empty states for all pages guiding to the correct next action
- [ ] "What's next?" contextual suggestion on dashboard based on project state

---

## Web Task Dependency Graph

```
W0.1 (Scaffold)
 ├── W0.2 (Supabase Client)
 │    ├── W0.3 (DB Schema + Types)
 │    │    ├── W1.1 → W1.2 (Setup Wizard)
 │    │    ├── W1.3 (Add Examples)
 │    │    ├── W1.4 → W1.5 (Rating + Rewrite)
 │    │    │         └── W1.6 (Rating Filters)
 │    │    │         └── W7.1 (Mobile Rating)
 │    │    ├── W2.1 → W2.2 (Dashboard Charts)
 │    │    │    └── W2.3 (Timeline + Feed)
 │    │    ├── W3.1 (Preflight + Config)
 │    │    │    └── W3.2 (Split Manager)
 │    │    │         └── W3.3 → W3.4 (Together.ai + Status)
 │    │    │              └── W3.5 (Run History)
 │    │    ├── W4.1 → W4.2 → W4.3 (Eval Pipeline)
 │    │    ├── W5.1 → W5.2 (Playground)
 │    │    └── W6.1 (Settings)
 │    └── W7.2 (Realtime)
 └── W0.4 (Auth)
      └── W0.5 (App Shell)
           └── (all page tasks)

W7.3 (Empty States) depends on W0.5
```
