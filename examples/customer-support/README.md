# Customer Support Bot Example

A complete example project demonstrating how to fine-tune an LLM for customer support using aitelier.

## Scenario

**TechGadgets** is an online electronics store that wants to fine-tune a model to handle common customer support inquiries. The goal is to create a helpful, professional bot that can:

- Handle order status, cancellations, and modifications
- Process returns and refunds
- Troubleshoot product issues
- Answer policy questions
- Manage escalations with empathy

## What's Included

This example contains:

- **25 pre-rated training examples** covering common support scenarios
- **Pre-configured `.ftpipeline.json`** with system prompt and quality threshold
- **Realistic variety**: order issues, product questions, returns, complaints, policy questions

## Training Data Overview

The 25 examples include:

- Order tracking and delivery issues (8 examples)
- Returns, refunds, and cancellations (7 examples)
- Product issues and troubleshooting (4 examples)
- Policy questions (pricing, discounts, return policy) (4 examples)
- Account and technical support (2 examples)

**Rating distribution:**

- 10/10: 3 examples (exceptional responses)
- 9/10: 9 examples (high quality, clear solutions)
- 8/10: 12 examples (good, professional responses)
- 7/10: 1 example (acceptable but could be better)

Average rating: **8.6/10** (exceeds the 8.0 quality threshold)

## Quick Start

### 1. Navigate to this directory

```bash
cd examples/customer-support
```

### 2. Set up your API key

```bash
export TOGETHER_API_KEY="your-api-key-here"
```

### 3. Review the training data

```bash
npx aitelier stats
```

You should see:

- 25 total examples
- All rated (100%)
- 24 examples above threshold (96%)

### 4. Split and format the data

```bash
# Create train/val split (80/20)
npx aitelier split

# Format for Together.ai
npx aitelier format
```

This creates:

- `data/train.jsonl` - 20 training examples
- `data/val.jsonl` - 5 validation examples

### 5. Start fine-tuning

```bash
npx aitelier train
```

This will:

- Upload your training file to Together.ai
- Start a LoRA fine-tune job
- Save the job ID to `.ftpipeline.json`

### 6. Monitor progress

```bash
# Check job status
npx aitelier status

# Once complete, see the model ID
npx aitelier status --all
```

### 7. Evaluate the fine-tuned model

```bash
# Interactive evaluation on validation set
npx aitelier eval

# Compare base model vs fine-tuned model (blind A/B test)
npx aitelier eval --compare
```

## Expected Results

After fine-tuning on this dataset, you should see:

- **Consistent tone**: Friendly, professional, solution-oriented
- **Better structure**: Clear next steps, verification of order details
- **Appropriate empathy**: Acknowledges frustration in complaint scenarios
- **Company-specific knowledge**: References TechGadgets policies and procedures

### Base Model vs Fine-Tuned

**Before (base model):**

- Generic responses that don't reference order numbers
- Less structured problem-solving
- Doesn't always verify details before taking action
- Inconsistent tone (sometimes too formal, sometimes too casual)

**After (fine-tuned model):**

- Always verifies order number (TG-XXXX format)
- Structured responses: acknowledge → investigate → offer solution → next steps
- Appropriate empathy for complaints and urgent issues
- Consistent friendly but professional tone
- Specific references to company policies (30-day returns, 6-month warranty, etc.)

## System Prompt Explained

```
You are a helpful customer support agent for TechGadgets, an online electronics store.
Be friendly, professional, and solution-oriented. Always verify order details before
taking action. Offer clear next steps.
```

This prompt:

- **Sets the role**: Customer support agent for a specific company
- **Defines tone**: Friendly + professional (balance of warmth and competence)
- **Emphasizes safety**: Always verify before taking action (prevent errors)
- **Focuses on outcomes**: Solution-oriented, clear next steps

## Customizing for Your Use Case

To adapt this for your own customer support bot:

### 1. Update the system prompt

Edit `.ftpipeline.json` to reflect your:

- Company name and industry
- Tone preferences
- Key policies or procedures

### 2. Replace training examples

Delete `data/examples.jsonl` and add your own:

```bash
# Add examples interactively
npx aitelier add

# Or add from files
npx aitelier add --input user_message.txt --output agent_response.txt
```

### 3. Rate your examples

```bash
npx aitelier rate
```

Score each example 1-10 based on:

- **Accuracy**: Does it solve the customer's problem?
- **Tone**: Is it appropriately friendly and professional?
- **Completeness**: Are next steps clear?
- **Safety**: Does it verify details before taking action?

### 4. Iterate

After your first fine-tune:

- Run `ait eval --compare` to see what improved
- Identify patterns in low-scoring responses
- Add more examples in those areas
- Re-rate existing examples if your quality bar changed
- Fine-tune again with the improved dataset

## Training Data Best Practices

Based on this example, here are key patterns to follow:

### ✅ Good Example Characteristics

1. **Verification first**: Always asks for order number or email before taking action
2. **Structured responses**: Acknowledge → Investigate → Solution → Next steps
3. **Empathy for complaints**: Starts with apology, takes ownership
4. **Specific details**: References exact products, dates, policies
5. **Clear timelines**: "2-3 business days", "within 24 hours"
6. **Multiple options**: Gives customer choices when appropriate

### ❌ Avoid These Patterns

1. **Taking action without verification**: Never make changes without confirming identity
2. **Vague responses**: "We'll look into it" without specifics
3. **Overpromising**: Don't commit to things outside policy
4. **Ignoring emotion**: Address frustration in complaints
5. **Dead ends**: Always provide next steps or alternatives

## Cost Estimate

Fine-tuning on this dataset (25 examples, 20 train / 5 val):

- **Training**: ~$0.50 for 3 epochs on Llama-3.1-8B
- **Evaluation**: ~$0.10 for 5 validation examples (2 inferences each for `--compare`)
- **Total**: ~$0.60

Inference costs after fine-tuning:

- Same as base model ($0.20/million tokens)
- Fine-tuned model is same size, just specialized

## Next Steps

1. **Expand the dataset**: Add 50-100 more examples covering edge cases
2. **Test in production**: Use `ait eval` to catch issues before deployment
3. **Iterate**: Add examples for any failure modes you discover
4. **Monitor quality**: Regularly run evaluations as you add more data

## Learn More

- **aitelier documentation**: [Main README](../../README.md)
- **Together.ai fine-tuning guide**: [docs.together.ai/fine-tuning](https://docs.together.ai/docs/fine-tuning)
- **Provider setup**: [Provider Setup Guide](../../README.md#provider-setup)

---

**Questions?** Open an issue at [github.com/ftanyol/aitelier](https://github.com/ftanyol/aitelier)
