<div align="center">

# aitelier

[![Made with VHS](https://vhs.charm.sh/vhs-TmiLHX4VFolJ31pnvwOmW.gif)](https://vhs.charm.sh)

> Your AI atelier — craft fine-tuned models with CLI + web app

[![npm version](https://img.shields.io/npm/v/aitelier.svg)](https://www.npmjs.com/package/aitelier)
[![CI](https://github.com/furkantanyol/aitelier/actions/workflows/ci.yml/badge.svg)](https://github.com/furkantanyol/aitelier/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)

</div>

## What is aitelier?

A complete toolkit for the full lifecycle of fine-tuning LLMs — from collecting examples to shipping production models. Ships as a **CLI** for terminal power users and a **web app** for team collaboration. Built for indie hackers and small teams fine-tuning open-source models (Llama, Mistral) via LoRA with 50-500 training examples.

**Two ways to work:**

- **CLI** (`ait`) — Fast, local, git-friendly. JSONL files as the database. Perfect for solo work.
- **Web app** — Polished UI with Supabase backend. Project sharing, team roles, visual dashboards. Perfect for collaborative curation.

## Packages

| Package | Description | Docs |
| --- | --- | --- |
| [`packages/cli`](packages/cli) | CLI tool — `npx aitelier` | [CLI Quick Start](#cli-quick-start) |
| [`packages/web`](packages/web) | Next.js web app | [Web README](packages/web/README.md) |

## CLI Quick Start

```bash
# Install
npm install -g aitelier

# Initialize project
ait init

# Add training examples
ait add

# Check dataset health
ait stats

# Train your model
ait split && ait format && ait train

# Evaluate results
ait eval
```

## Web App Quick Start

```bash
# Clone and install
git clone https://github.com/furkantanyol/aitelier.git
cd aitelier && pnpm install

# Set up environment
cp packages/web/.env.local.example packages/web/.env.local
# Edit .env.local with your Supabase credentials

# Run dev server
pnpm --filter web dev
```

See [packages/web/README.md](packages/web/README.md) for full setup instructions.

## Features

### CLI

- 🎨 **Beautiful terminal UI** — Color-coded output, progress bars, visual feedback
- 📦 **JSONL native** — No database, everything is portable JSONL files (git-friendly)
- 📊 **Quality control** — Rate examples 1-10, rewrite poor outputs inline
- 🔄 **Smart splitting** — Automatic 80/20 with stratification, locked validation sets
- 🧪 **Blind evaluation** — A/B test fine-tuned model vs baseline

### Web App

- 🖥️ **Dashboard** — Metrics cards, rating distribution charts, training timeline, activity feed
- ⭐ **Rating interface** — Card-based UI with keyboard shortcuts, rewrite flow, filters/sorting
- 🚀 **Training pipeline** — Pre-flight checks, config editor, live status monitoring, run history
- 🔬 **Evaluation** — Blind A/B comparison UI with results reveal and historical trends
- 💬 **Playground** — Single model chat and side-by-side comparison with streaming
- 👥 **Team collaboration** — Project sharing with owner/trainer/rater roles
- ⚙️ **Settings** — Provider config, training defaults, team management, dataset export

### Shared

- 🚀 **Together.ai integration** — LoRA fine-tuning with full API support
- 📈 **Dataset analytics** — Health checks, rating distributions, readiness assessment

## CLI Commands

| Command      | Description                          |
| ------------ | ------------------------------------ |
| `ait init`   | Initialize a new fine-tuning project |
| `ait add`    | Add training examples interactively  |
| `ait rate`   | Review and rate examples             |
| `ait stats`  | Show dataset health overview         |
| `ait split`  | Create train/validation split        |
| `ait format` | Export to provider format (JSONL)    |
| `ait train`  | Start fine-tuning job                |
| `ait status` | Monitor training progress            |
| `ait eval`   | Evaluate model on validation set     |

Run `ait <command> --help` for detailed options.

## CLI Project Structure

```
your-project/
├── .aitelier.json       # Project config
└── data/
    ├── examples.jsonl   # Raw examples with ratings
    ├── train.jsonl      # Training split
    ├── val.jsonl        # Validation split (locked)
    └── evals/           # Evaluation results
```

## Provider Setup

### Together.ai

1. Sign up at [together.ai](https://together.ai)
2. Add credits (fine-tuning requires minimum $10)
3. Get API key from Settings → API Keys
4. **CLI:** Set environment variable: `export TOGETHER_API_KEY=your_key`
5. **Web:** Enter API key in project setup wizard or Settings → Provider Config

**Recommended models:**

- `meta-llama/Llama-3.3-70B-Instruct-Turbo` — Best quality
- `meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo` — Good balance
- `mistralai/Mistral-7B-Instruct-v0.3` — Fastest, cheapest

## Monorepo Structure

```
aitelier/
├── packages/
│   ├── cli/              # CLI package (npm: aitelier)
│   │   └── src/
│   │       ├── commands/  # One file per CLI command
│   │       ├── providers/ # Provider API integrations
│   │       ├── storage/   # JSONL read/write + project config
│   │       └── index.ts   # CLI entrypoint
│   └── web/              # Next.js web app
│       ├── src/
│       │   ├── app/       # App router pages
│       │   ├── components/ # React components + Shadcn/UI
│       │   ├── lib/       # Supabase clients, provider modules
│       │   └── hooks/     # Custom React hooks
│       └── supabase/
│           └── migrations/ # SQL schema + RLS policies
├── examples/             # Example projects for the CLI
├── turbo.json            # Turborepo config
└── package.json          # Monorepo root
```

## Development

```bash
# Install dependencies
pnpm install

# Build everything
pnpm turbo build

# Run tests (CLI)
pnpm turbo test

# Lint everything
pnpm turbo lint

# Format code
pnpm prettier --write .

# Run CLI locally
pnpm --filter aitelier exec tsx src/index.ts

# Run web dev server
pnpm --filter web dev
```

## Examples

See real-world CLI examples in [`examples/`](examples/):

- [Customer Support Bot](examples/customer-support/) — Fine-tune on support tickets
- [Code Review Assistant](examples/code-review/) — Project-specific code review feedback

## Troubleshooting

**CLI issues:**

- **"Project not initialized"** — Run `ait init` first
- **"No rated examples"** — Run `ait rate` to rate your examples
- **"TOGETHER_API_KEY not found"** — Set your API key: `export TOGETHER_API_KEY=...`

**Web app issues:**

- **Auth not working** — Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`
- **Team invites failing** — Requires `SUPABASE_SECRET_KEY` to be set (service role key)
- **Build errors** — Run `pnpm install` then `pnpm turbo build`

For more help, [open an issue](https://github.com/furkantanyol/aitelier/issues).

## Roadmap

- [x] Core CLI commands (init, add, rate, stats, split, format, train, status, eval)
- [x] Together.ai integration with LoRA fine-tuning
- [x] Web app with dashboard, rating, training, eval, playground
- [x] Team collaboration with role-based access
- [ ] OpenAI provider support
- [ ] Mobile-responsive rating interface with swipe gestures
- [ ] Real-time collaboration (live updates, activity toasts)
- [ ] Multi-turn conversation support
- [ ] Dataset versioning and diff tools

## Contributing

Contributions welcome! Please open an issue first to discuss major changes.

## License

MIT © [Furkan Tanyol](https://github.com/furkantanyol)

---

<div align="center">

**[Web App Docs](packages/web/README.md)** · **[CLI Examples](examples/)** · **[Issues](https://github.com/furkantanyol/aitelier/issues)** · **[npm](https://www.npmjs.com/package/aitelier)**

</div>
