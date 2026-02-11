# TASKS — ft-pipeline

Track progress by checking off tasks as they're completed.

---

## Milestone 1: Core CLI — Init, Add, Rate

### M1.1 — Project Setup

- [x] Initialize monorepo (Turborepo + pnpm)
- [x] Set up `packages/cli` with TypeScript, Commander.js, Vitest
- [x] Configure ESLint, Prettier, tsconfig strict mode
- [x] Set up CI (GitHub Actions: lint + test)
- [x] Create initial README with project description

### M1.2 — `ft init` Command

- [x] Interactive prompts: project name, provider (together/openai), model, system prompt
- [x] Generate `.ftpipeline.json` config file
- [x] Create `data/` directory with `examples.jsonl`, `train.jsonl`, `val.jsonl`
- [x] Write tests for init flow

### M1.3 — `ft add` Command

- [x] Interactive mode: paste input → paste output → auto-format to chat JSONL
- [x] File mode: `ft add --input input.txt --output output.txt`
- [x] Auto-append to `data/examples.jsonl` with metadata (timestamp, rating: null, version)
- [x] Validate JSON structure on save
- [ ] Support for multi-turn conversations (array of messages)
- [x] Write tests

### M1.4 — `ft rate` Command

- [x] Show unrated examples one by one (interactive)
- [x] Display: system prompt + input + output, formatted in terminal
- [x] Rate 1-10, option to rewrite output inline
- [x] If rewrite: save rewritten version as training target, keep original as metadata
- [x] `ft rate --min 8` — only show examples rated below 8 for re-review
- [x] Summary stats after session
- [x] Write tests

### M1.5 — `ft stats` Command

- [x] Total examples, rated count, unrated count
- [x] Rating distribution (histogram in terminal)
- [x] Examples above quality threshold (configurable, default 8+)
- [x] Train/val split status
- [x] Write tests

---

## Milestone 2: Format, Split, Train

### M2.1 — `ft format` Command

- [x] Export rated examples (above threshold) to provider-specific JSONL
- [x] Together.ai format: standard chat messages
- [x] OpenAI format: standard chat messages with optional `weight` field
- [x] Validate output against provider schema
- [x] Output to `data/train.jsonl` and `data/val.jsonl`
- [x] Write tests

### M2.2 — `ft split` Command

- [x] Auto-split: 80/20 train/val by default
- [x] Stratified by rating if enough examples
- [x] `ft split --ratio 0.9` for custom splits
- [x] Lock validation set: once assigned, val examples don't move to train
- [x] `ft split --reshuffle` to force re-split (with confirmation)
- [x] Write tests

### M2.3 — `ft train` Command

- [x] Upload training file to Together.ai via API
- [x] Create LoRA fine-tune job with sensible defaults
- [x] Configurable: epochs, batch_size, learning_rate, lora_r, lora_alpha
- [x] Save job ID + config to `.ftpipeline.json` under `runs[]`
- [x] Requires `TOGETHER_API_KEY` env var
- [x] Write tests

### M2.4 — `ft status` Command

- [x] Check fine-tune job status via provider API
- [x] `ft status` — show latest job
- [x] `ft status --all` — show all runs with model IDs
- [x] When complete: save model ID to config
- [x] Write tests

---

## Milestone 3: Eval

### M3.1 — `ft eval` Command

- [ ] Run fine-tuned model on all validation examples
- [ ] Side-by-side display: expected output vs model output
- [ ] Interactive scoring per example
- [ ] Summary: average score, sendable rate
- [ ] Save eval results to `data/evals/eval-{version}-{date}.json`
- [ ] Write tests

### M3.2 — `ft eval --compare` Mode

- [ ] Run base model AND fine-tuned model on same inputs
- [ ] Show A vs B (blind, randomized order)
- [ ] After scoring: reveal which was which + aggregate stats
- [ ] Write tests

---

## Milestone 4: README, Examples, Polish

### M4.1 — README.md

- [ ] One-line description + quick start
- [ ] CLI demo GIF/video (asciinema or vhs)
- [ ] Architecture diagram (mermaid)
- [ ] Provider setup guides (Together, OpenAI)
- [ ] Example use cases (customer support, code review)
- [ ] Contributing guide

### M4.2 — Example Projects

- [ ] `examples/customer-support/` — 20 training examples + walkthrough
- [ ] `examples/code-review/` — 20 training examples + walkthrough

### M4.3 — Package Publishing

- [ ] Publish to npm as `ft-pipeline`
- [ ] `npx ft-pipeline` works out of the box
- [ ] GitHub releases with changelog
- [ ] Badges: npm version, CI status, license

### M4.4 — Launch

- [ ] Hacker News (Show HN)
- [ ] r/LocalLLaMA, r/MachineLearning
- [ ] Twitter/X thread with GIF demo
