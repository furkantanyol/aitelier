<div align="center">

# aitelier

[![Made with VHS](https://vhs.charm.sh/vhs-TmiLHX4VFolJ31pnvwOmW.gif)](https://vhs.charm.sh)

> Your AI atelier - craft fine-tuned models with an intuitive CLI

[![npm version](https://img.shields.io/npm/v/aitelier.svg)](https://www.npmjs.com/package/aitelier)
[![CI](https://github.com/furkantanyol/aitelier/actions/workflows/ci.yml/badge.svg)](https://github.com/furkantanyol/aitelier/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)

</div>

## What is aitelier?

A workflow tool for the full lifecycle of fine-tuning LLMs — from collecting examples to shipping production models. Built for indie hackers and small teams fine-tuning open-source models (Llama, Mistral) via LoRA with 50-500 training examples.

**Stop manually managing JSONL files.** Get a clean, repeatable CLI workflow with built-in quality control, train/val splitting, and evaluation.

## Quick Start

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

## Features

- 🎨 **Beautiful CLI** — Color-coded output, progress bars, visual feedback
- 📊 **Quality Control** — Rate examples 1-10, rewrite poor outputs inline
- 📈 **Dataset Analytics** — Health checks, rating distributions, readiness assessment
- 🔄 **Smart Splitting** — Automatic 80/20 with stratification, locked validation sets
- 🚀 **Provider Integration** — Together.ai fine-tuning with LoRA (OpenAI coming soon)
- 📦 **JSONL Native** — No database, everything is portable JSONL files (git-friendly)
- 🧪 **Evaluation Workflow** — Interactive validation scoring with blind A/B testing

## Installation

### npm (recommended)

```bash
npm install -g aitelier
```

### Homebrew (macOS/Linux)

```bash
brew tap furkantanyol/aitelier
brew install aitelier
```

### npx (no install)

```bash
npx aitelier init
```

**Requirements:** Node.js 20+, Together.ai API key

## Commands

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

## Project Structure

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
4. Set environment variable:

```bash
export TOGETHER_API_KEY=your_api_key_here
```

**Recommended models:**

- `meta-llama/Llama-3.3-70B-Instruct` — Best quality
- `meta-llama/Llama-3.2-11B-Instruct` — Good balance
- `mistralai/Mistral-7B-Instruct-v0.3` — Fastest, cheapest

### OpenAI (Coming Soon)

OpenAI fine-tuning support is planned.

## Examples

See real-world examples in [`examples/`](examples/):

- [Customer Support Bot](examples/customer-support/) — Fine-tune on support tickets
- [Code Review Assistant](examples/code-review/) — Project-specific code review feedback

## Development

```bash
# Clone and install
git clone https://github.com/furkantanyol/aitelier.git
cd aitelier
pnpm install

# Build and test
pnpm turbo build
pnpm turbo test

# Run CLI locally
pnpm --filter aitelier exec tsx src/index.ts
```

See [CLAUDE.md](CLAUDE.md) for development guidelines.

## Troubleshooting

**Common issues:**

- **"Project not initialized"** — Run `ait init` first
- **"No rated examples"** — Run `ait rate` to rate your examples
- **"TOGETHER_API_KEY not found"** — Set your API key: `export TOGETHER_API_KEY=...`

For more help, [open an issue](https://github.com/furkantanyol/aitelier/issues).

## Roadmap

- [x] Core CLI commands (init, add, rate, stats)
- [x] Together.ai integration (train, status, eval)
- [x] Beautiful terminal UI with colors
- [ ] OpenAI provider support
- [ ] Web UI for rating interface
- [ ] Multi-turn conversation support
- [ ] Dataset versioning and diff tools

## Contributing

Contributions welcome! Please open an issue first to discuss major changes.

## License

MIT © [Furkan Tanyol](https://github.com/furkantanyol)

---

<div align="center">

**[Documentation](https://github.com/furkantanyol/aitelier#readme)** • **[Examples](examples/)** • **[Issues](https://github.com/furkantanyol/aitelier/issues)** • **[npm](https://www.npmjs.com/package/aitelier)**

</div>
