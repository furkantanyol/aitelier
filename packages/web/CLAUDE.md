# CLAUDE.md — Aitelier Web

## Overview

Next.js latest web app for LLM fine-tuning dataset curation. Part of the aitelier monorepo. This is the primary product — a polished app that lets non-technical collaborators contribute training data and evaluate models without a terminal.

## Code Principles

KISS, DRY, YAGNI, clean code. Simplest solution that works. No premature abstractions.

## Tech Stack

- **Framework:** Next.js 15 (app router, server actions, server components by default)
- **Styling:** Tailwind CSS
- **Components:** Shadcn/UI (new-york style, CSS variables)
- **Backend:** Supabase (Postgres, Auth, Realtime)
- **Charts:** ShadCDN Charts
- **Animations:** Framer Motion
- **Language:** TypeScript strict mode

## Design Philosophy

- **Elegant and polished** — this is a product, not a developer tool. Every page should feel intentional and well-crafted.
- **Dark mode default** with a refined palette — zinc/slate tones, not harsh black. Generous whitespace, clean typography, subtle shadows.
- **Shadcn/UI as the foundation** — use its components consistently. Customize via Tailwind, don't fight the component library.
- **Hierarchy through typography and spacing**, not heavy borders or loud colors. Let content breathe.
- **Subtle animations** — transitions should feel smooth and natural, never flashy. Use Framer Motion sparingly for meaningful interactions (card transitions, reveals, slide-ins).
- **Mobile-aware** — responsive layouts, touch-friendly targets (min 44px), but desktop is the primary viewport.

## Commands

```bash
pnpm --filter web dev          # Dev server (localhost:3000)
pnpm --filter web build        # Production build
pnpm --filter web lint         # Lint
pnpm turbo build               # Build entire monorepo
```

## Conventions

- **Server components by default** — add `"use client"` only when you need interactivity, hooks, or browser APIs.
- **Colocate server actions** in the same file or a nearby `actions.ts` within the route directory.
- **Supabase access:** server client in server components/actions, browser client in client components. Never expose credentials to the client.
- **All database access** goes through server actions or API routes.
- **Shadcn/UI components** live in `src/components/ui/`. App-specific components live in `src/components/`.
- **Install Shadcn components as needed:** `pnpm dlx shadcn@latest add <component>` — don't pre-install everything.

## Architecture

```
packages/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (fonts, metadata)
│   │   ├── page.tsx              # Landing / redirect
│   │   ├── globals.css           # Tailwind + Shadcn theme
│   │   ├── login/                # Auth pages
│   │   ├── auth/callback/        # OAuth/magic link callback
│   │   └── (app)/                # Authenticated route group
│   │       ├── layout.tsx        # App shell (sidebar + main)
│   │       ├── dashboard/
│   │       ├── add/
│   │       ├── rate/
│   │       ├── train/
│   │       ├── eval/
│   │       ├── playground/
│   │       └── settings/
│   ├── components/               # App-specific components
│   │   └── ui/                   # Shadcn/UI components
│   ├── lib/
│   │   ├── supabase/             # Supabase client helpers + types
│   │   └── providers/            # Provider API modules (together.ts)
│   └── hooks/                    # Custom React hooks
├── supabase/
│   └── migrations/               # SQL migration files
├── public/
├── components.json               # Shadcn/UI config
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

## Database

Supabase Postgres with RLS. Five core tables:

- `projects` — workspace config (name, provider, model, system prompt, training config)
- `examples` — training data (input, output, rating, rewrite, split)
- `training_runs` — fine-tuning jobs (provider, status, config, cost)
- `evaluations` — A/B comparison results
- `project_members` — team access (owner, trainer, rater roles)

## Provider Integration

Together.ai is the primary provider. API calls go through server actions (never client-side). The provider module in `src/lib/providers/together.ts` handles JSONL formatting, file upload, job creation, and status polling.


## Docs

[NextJS](https://nextjs.org/docs)
[TailwindCSS](https://tailwindcss.com/docs/installation/using-vite)
[Supabase](https://supabase.com/docs)
[ShadCDN](https://ui.shadcn.com/docs)
[ShadCDN Charts](https://ui.shadcn.com/docs/components/radix/chart)
[Framer Motion](https://motion.dev/docs/react)