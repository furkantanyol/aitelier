import type { Command } from 'commander';
import inquirer from 'inquirer';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Message } from '../providers/types.js';
import type { Example } from '../storage/dataset.js';
import { appendExample, readExamples } from '../storage/dataset.js';
import { loadConfig } from '../storage/config.js';

const CONFIG_FILE = '.ftpipeline.json';
const EXAMPLES_FILE = 'data/examples.jsonl';

export function registerAdd(program: Command): void {
  program
    .command('add')
    .description('Add a training example (input/output pair)')
    .option('-i, --input <path>', 'Path to file containing input text')
    .option('-o, --output <path>', 'Path to file containing output text')
    .action(async (options: { input?: string; output?: string }) => {
      try {
        await addCommand(options);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

async function addCommand(options: { input?: string; output?: string }): Promise<void> {
  const cwd = process.cwd();

  // Check if project is initialized
  try {
    await access(join(cwd, CONFIG_FILE));
  } catch {
    throw new Error('Project not initialized. Run `ft init` first to create .ftpipeline.json');
  }

  // Load project config for system prompt
  const config = await loadConfig(cwd);

  // Determine mode and collect input/output
  let inputContent: string;
  let outputContent: string;

  if (options.input && options.output) {
    // File mode
    inputContent = await readFile(options.input, 'utf-8');
    outputContent = await readFile(options.output, 'utf-8');
  } else if (options.input || options.output) {
    // Partial flags - error
    throw new Error('Both --input and --output must be provided together');
  } else {
    // Interactive mode
    const answers = await inquirer.prompt<{
      input: string;
      output: string;
    }>([
      {
        type: 'editor',
        name: 'input',
        message: 'Enter the input (user message):',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Input cannot be empty';
          }
          return true;
        },
      },
      {
        type: 'editor',
        name: 'output',
        message: 'Enter the output (assistant response):',
        validate: (output: string) => {
          if (!output.trim()) {
            return 'Output cannot be empty';
          }
          return true;
        },
      },
    ]);

    inputContent = answers.input;
    outputContent = answers.output;
  }

  // Trim and validate
  inputContent = inputContent.trim();
  outputContent = outputContent.trim();

  if (!inputContent) {
    throw new Error('Input content is empty');
  }
  if (!outputContent) {
    throw new Error('Output content is empty');
  }

  // Build messages array
  const messages: Message[] = [];

  if (config.systemPrompt) {
    messages.push({
      role: 'system',
      content: config.systemPrompt,
    });
  }

  messages.push({
    role: 'user',
    content: inputContent,
  });

  messages.push({
    role: 'assistant',
    content: outputContent,
  });

  // Generate next ID
  const examplesPath = join(cwd, EXAMPLES_FILE);
  let nextId = 1;

  try {
    const existing = await readExamples(examplesPath);
    if (existing.length > 0) {
      const maxId = Math.max(...existing.map((e) => e.id));
      nextId = maxId + 1;
    }
  } catch (error) {
    // File might be empty or not exist yet - start with ID 1
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  // Create example
  const example: Example = {
    id: nextId,
    messages,
    rating: null,
    createdAt: new Date().toISOString(),
    version: 1,
  };

  // Validate messages
  if (example.messages.length === 0) {
    throw new Error('Messages array cannot be empty');
  }

  for (const msg of example.messages) {
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      throw new Error(`Invalid message role: ${msg.role}`);
    }
    if (!msg.content.trim()) {
      throw new Error(`Message content cannot be empty for role: ${msg.role}`);
    }
  }

  // Append to JSONL
  await appendExample(examplesPath, example);

  console.log(`✓ Added example #${nextId} to ${EXAMPLES_FILE}`);
}
