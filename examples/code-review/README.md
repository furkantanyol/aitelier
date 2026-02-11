# Code Review Assistant Example

A complete example project demonstrating how to fine-tune an LLM for automated code review using aitelier.

## Scenario

You want to create an AI code reviewer that provides constructive feedback on code quality, security issues, and best practices. This example shows how to fine-tune a model to review code in multiple languages with specific, actionable feedback.

## What's Included

This example contains:

- **5 pre-rated training examples** covering common code review scenarios
- **Pre-configured `.ftpipeline.json`** with system prompt optimized for code review
- **Realistic variety**: SQL injection, modern JavaScript, error handling, React hooks, password validation

## Training Data Overview

The 5 examples include:

- Security vulnerabilities (SQL injection) - 1 example
- Modern JavaScript best practices - 1 example
- Error handling improvements - 1 example
- React component issues - 1 example
- Password validation - 1 example

**Rating distribution:**

- 10/10: 2 examples (critical security issues with clear fixes)
- 9/10: 2 examples (important improvements with good explanations)
- 8/10: 1 example (solid style improvements)

Average rating: **9.2/10** (exceeds the 8.0 quality threshold)

## Quick Start

### 1. Navigate to this directory

```bash
cd examples/code-review
```

### 2. Set up your API key

```bash
export TOGETHER_API_KEY=your_api_key_here
```

### 3. Check the dataset

```bash
ait stats
```

You should see:

```
Dataset Overview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total examples: 5
Rated: 5 (100%)
Unrated: 0 (0%)

Rating Distribution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 10 ████████████████████████ 2 (40%)
  9 ████████████████████████ 2 (40%)
  8 ████████████ 1 (20%)
  7
  6
  5
  4
  3
  2
  1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Average rating: 9.2/10

Quality Threshold: 8/10
Examples meeting threshold: 5 (100%)
```

### 4. Create train/val split

```bash
ait split
```

With only 5 examples, you'll get:

```
Split 5 examples: 4 train, 1 val (80/20)
```

### 5. Format for training

```bash
ait format
```

This exports the split examples to Together.ai format:

```
Exported 4 examples to data/train.jsonl
Exported 1 example to data/val.jsonl
```

### 6. Start fine-tuning

```bash
ait train --epochs 3
```

Output:

```
Uploading data/train.jsonl... ✓
Uploading data/val.jsonl... ✓
Creating fine-tune job... ✓

Job ID: ft-abc123xyz
Model will be available as: username/Meta-Llama-3.1-8B-Instruct-Turbo-code-review-assistant-abc123

Run `ait status` to check progress.
```

### 7. Monitor training

```bash
ait status
```

### 8. Evaluate the model

Once training completes:

```bash
ait eval
```

This will run your fine-tuned model on the validation set and let you score the outputs.

## Expected Results

With proper training data (you'd want 50-100 examples in production), you should see:

- **Before fine-tuning:** Generic, surface-level code review comments
- **After fine-tuning:** Specific, actionable feedback that matches your team's standards

## Expanding This Example

To make this production-ready:

1. **Add more examples** (aim for 50-100):

   ```bash
   ait add  # Interactive mode
   # Or use file mode:
   ait add --input code-snippet.txt --output review-feedback.txt
   ```

2. **Cover more languages and scenarios**:
   - Python: type hints, async/await, pandas optimization
   - JavaScript: TypeScript migration, async patterns
   - General: naming conventions, code organization, documentation

3. **Rate existing examples**:

   ```bash
   ait rate
   ```

4. **Iterate on quality**:
   ```bash
   ait stats  # Check dataset health
   ait rate --min 8  # Re-review examples below threshold
   ```

## Customization Tips

### Adjust the system prompt

Edit `.ftpipeline.json` to customize the reviewer's personality:

```json
{
  "systemPrompt": "You are a senior engineer at [Your Company]. Review code according to our style guide: [specific rules]. Be thorough but kind."
}
```

### Focus on specific languages

Add language-specific examples to bias the model toward your stack:

```bash
ait add  # Add more React/Python/etc. examples
```

### Set quality standards

Adjust the quality threshold in `.ftpipeline.json`:

```json
{
  "qualityThreshold": 9 // Only train on 9+ rated examples
}
```

## Next Steps

1. **Collect real code reviews** from your team's PRs
2. **Rate and curate** the best examples
3. **Fine-tune** with 50-100 examples
4. **Evaluate** using `ait eval --compare` to measure improvement
5. **Integrate** into your CI/CD pipeline

## Learn More

- [Main README](../../README.md) - Full aitelier documentation
- [Customer Support Example](../customer-support/) - Another complete example
- [Together.ai Docs](https://docs.together.ai/docs/fine-tuning-quickstart) - Fine-tuning guides
