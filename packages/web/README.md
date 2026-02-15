# aitelier web

> Polished web app for collaborative LLM fine-tuning dataset curation

The web app is the team-facing side of aitelier. Non-technical collaborators can contribute training data, rate examples, monitor training runs, and evaluate models — all from a clean, dark-mode UI.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 (app router, server components, server actions)
- **Backend:** [Supabase](https://supabase.com/) (Postgres, Auth with magic links, Row Level Security)
- **Components:** [Shadcn/UI](https://ui.shadcn.com/) (new-york style, zinc palette, CSS variables)
- **Charts:** [Recharts](https://recharts.org/) via Shadcn Charts
- **Animations:** [Framer Motion](https://motion.dev/)
- **Provider:** [Together.ai](https://together.ai/) (fine-tuning, inference, streaming)
- **Language:** TypeScript (strict mode)
- **Monorepo:** Turborepo + pnpm

## Prerequisites

- **Node.js 20+**
- **pnpm 9+**
- **Supabase project** — [Create one](https://supabase.com/dashboard) (free tier works)
- **Together.ai account** — [Sign up](https://together.ai/) (needed for training + playground)

## Setup

### 1. Install dependencies

From the monorepo root:

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
# Required — from Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Required for team invites — from Supabase Dashboard → Settings → API → Service Role
SUPABASE_SECRET_KEY=your-secret-key

# Required for type generation
SUPABASE_PROJECT_ID=your-project-id
```

### 3. Set up the database

Run the migration against your Supabase project. You can either:

**Option A — Supabase CLI (recommended):**

```bash
supabase db push
```

**Option B — SQL Editor:**

Copy the contents of `supabase/migrations/001_initial_schema.sql` and run it in the Supabase Dashboard SQL Editor.

### 4. Configure Supabase Auth

In your Supabase Dashboard → Authentication → Providers:

1. Enable **Email** provider with magic link (OTP) sign-in
2. Set the **Site URL** to `http://localhost:3000`
3. Add `http://localhost:3000/auth/callback` to **Redirect URLs**

### 5. Run the dev server

```bash
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to the login page.

## Commands

```bash
pnpm --filter web dev           # Dev server (localhost:3000)
pnpm --filter web build         # Production build
pnpm --filter web lint          # Lint with ESLint
pnpm --filter web start         # Start production server
```

From the monorepo root:

```bash
pnpm turbo build                # Build all packages
pnpm turbo lint                 # Lint all packages
pnpm prettier --write .         # Format all code
```

Generate TypeScript types from your Supabase schema:

```bash
pnpm --filter web db:gen-types
```

## Pages

| Route | Page | Description |
| --- | --- | --- |
| `/login` | Login | Magic link email authentication |
| `/setup` | Project Setup | 6-step wizard (name, provider, model, prompt, config, team) |
| `/dashboard` | Dashboard | Metrics cards, rating chart, training timeline, activity feed |
| `/add` | Add Examples | Manual input or bulk JSONL import |
| `/rate` | Rate | Card-based rating with keyboard shortcuts and rewrite flow |
| `/train` | Training | Pre-flight checks, split management, config editor, run history |
| `/train/[runId]` | Run Status | Live training status with polling |
| `/eval` | Evaluation | A/B comparison setup |
| `/eval/[id]` | Blind Comparison | Side-by-side blind rating interface |
| `/eval/[id]/results` | Results | Win/loss reveal, per-example breakdown, historical trends |
| `/playground` | Playground | Single model chat + side-by-side comparison with streaming |
| `/settings` | Settings | Project config, provider, training defaults, team, export, delete |

## Architecture

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, metadata, Toaster)
│   ├── page.tsx                # Landing redirect
│   ├── globals.css             # Tailwind + Shadcn theme variables
│   ├── login/                  # Auth pages
│   │   ├── page.tsx            # Login form
│   │   └── actions.ts          # signInWithOtp
│   ├── auth/callback/          # OAuth/magic link callback
│   │   └── route.ts            # Exchange code for session
│   ├── api/
│   │   └── playground/
│   │       └── route.ts        # Streaming chat API (SSE)
│   └── (app)/                  # Authenticated route group
│       ├── layout.tsx          # App shell (sidebar, project provider)
│       ├── dashboard/
│       ├── add/
│       ├── rate/
│       ├── train/
│       ├── eval/
│       ├── playground/
│       ├── settings/
│       └── setup/
├── components/
│   ├── ui/                     # Shadcn/UI components (auto-installed)
│   ├── app-sidebar.tsx         # Navigation sidebar
│   ├── project-provider.tsx    # Global project context + cookie persistence
│   ├── project-selector.tsx    # Sidebar project dropdown
│   ├── user-menu.tsx           # User avatar + sign out
│   ├── add-examples.tsx        # Add page UI
│   ├── rating-session.tsx      # Rating page orchestrator
│   ├── rating-card.tsx         # Individual rating card with animations
│   ├── rating-controls.tsx     # Filter/sort controls
│   ├── empty-state.tsx         # Reusable empty state component
│   ├── whats-next.tsx          # Dashboard contextual suggestions
│   └── ...                     # Other feature components
├── lib/
│   ├── supabase/
│   │   ├── server.ts           # Server-side Supabase client
│   │   ├── client.ts           # Browser-side Supabase client
│   │   ├── middleware.ts       # Auth session refresh middleware
│   │   ├── admin.ts            # Admin client (bypasses RLS)
│   │   └── types.ts            # Generated database types
│   ├── providers/
│   │   └── together.ts         # Together.ai API (format, upload, train, status)
│   ├── projects.ts             # Shared getUserProjects query
│   ├── training-utils.ts       # Training cost/duration estimation
│   └── utils.ts                # cn() utility
└── hooks/                      # Custom React hooks
```

## Key Patterns

### Project Context

The active project is stored in a cookie (`active_project`) and exposed via React context. The `(app)/layout.tsx` server component reads the cookie, fetches projects, and wraps children in `<ProjectProvider>`. Client components use the `useProject()` hook:

```tsx
const { activeProjectId, activeProject, setActiveProject } = useProject();
```

Switching projects updates state + cookie + triggers `router.refresh()` to re-run server components.

### Server Actions

All database mutations go through server actions (files named `actions.ts` colocated with their route). Each action authenticates the user via `supabase.auth.getUser()` and operates through RLS — no admin client unless genuinely needed.

### Streaming

The playground uses a Next.js Route Handler (`/api/playground/route.ts`) for streaming chat responses via SSE, since server actions can't stream.

### Auth Flow

Magic link email → Supabase sends OTP → user clicks link → `/auth/callback` exchanges code for session → redirect to `/dashboard`. The middleware refreshes sessions on every request and redirects unauthenticated users to `/login`.

## Database Schema

Five core tables with Row Level Security:

| Table | Purpose | Key Columns |
| --- | --- | --- |
| `projects` | Workspace config | name, system_prompt, provider, base_model, provider_config, training_config |
| `project_members` | Team access | project_id, user_id, role (owner/trainer/rater) |
| `examples` | Training data | input, output, rewrite, rating, split (train/val), rated_by |
| `training_runs` | Fine-tuning jobs | provider_job_id, model_id, status, config, cost |
| `evaluations` | A/B comparison results | model_output, baseline_output, preferred, scores |

### RLS Roles

- **Owner** — Full access: CRUD on all tables, manage members, delete project
- **Trainer** — Add examples, create training runs, view everything
- **Rater** — Rate examples, create evaluations, view everything

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/publishable key |
| `SUPABASE_SECRET_KEY` | For invites | Service role key (enables team invites) |
| `SUPABASE_PROJECT_ID` | For types | Used by `db:gen-types` script |

The Together.ai API key is stored per-project in the database (encrypted in `provider_config`), not as an environment variable. Users enter it during project setup or in Settings.

## Adding Shadcn Components

Components are installed on demand:

```bash
pnpm dlx shadcn@latest add <component>
```

Installed components live in `src/components/ui/`. Don't pre-install everything.

## Deployment

The web app is a standard Next.js app. Deploy to any platform that supports Next.js:

- **Vercel** (recommended) — zero config, auto-deploys from GitHub
- **Railway**, **Fly.io**, **AWS Amplify** — set environment variables and deploy

Make sure to:

1. Set all environment variables in your deployment platform
2. Update the Supabase **Site URL** and **Redirect URLs** to your production domain
3. Run the database migration on your production Supabase project
