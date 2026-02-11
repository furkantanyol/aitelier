import type { Command } from 'commander';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Example } from '../storage/dataset.js';
import { readExamples } from '../storage/dataset.js';
import { loadConfig } from '../storage/config.js';
import type { Message } from '../providers/types.js';

const CONFIG_FILE = '.ftpipeline.json';
const EXAMPLES_FILE = 'data/examples.jsonl';
const TRAIN_FILE = 'data/train.jsonl';
const VAL_FILE = 'data/val.jsonl';

interface FormatStats {
  totalExamples: number;
  qualifiedExamples: number;
  belowThreshold: number;
  unrated: number;
  noSplit: number;
  trainExamples: number;
  valExamples: number;
}

interface TrainingExample {
  messages: Message[];
}

export function registerFormat(program: Command): void {
  program
    .command('format')
    .description('Export train/val splits to provider-specific JSONL format')
    .action(async () => {
      try {
        await formatCommand();
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

async function formatCommand(): Promise<void> {
  const cwd = process.cwd();

  // Check if project is initialized
  try {
    await access(join(cwd, CONFIG_FILE));
  } catch {
    throw new Error('Project not initialized. Run `ft init` first to create .ftpipeline.json');
  }

  // Load config to get quality threshold
  const config = await loadConfig(cwd);

  // Load all examples
  const examplesPath = join(cwd, EXAMPLES_FILE);
  let examples: Example[];
  try {
    examples = await readExamples(examplesPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No examples found. Add examples with `ft add` first.');
      return;
    }
    throw error;
  }

  // Check if file has any examples
  if (examples.length === 0) {
    console.log('No examples found. Add examples with `ft add` first.');
    return;
  }

  // Filter and categorize examples
  const stats: FormatStats = {
    totalExamples: examples.length,
    qualifiedExamples: 0,
    belowThreshold: 0,
    unrated: 0,
    noSplit: 0,
    trainExamples: 0,
    valExamples: 0,
  };

  const trainExamples: Example[] = [];
  const valExamples: Example[] = [];

  for (const example of examples) {
    // Track unrated examples
    if (example.rating === null) {
      stats.unrated++;
      continue;
    }

    // Track below threshold examples
    if (example.rating < config.qualityThreshold) {
      stats.belowThreshold++;
      continue;
    }

    // Qualified examples (rated and above threshold)
    stats.qualifiedExamples++;

    // Check for split assignment
    if (!example.split) {
      stats.noSplit++;
      continue;
    }

    // Add to appropriate split
    if (example.split === 'train') {
      trainExamples.push(example);
      stats.trainExamples++;
    } else if (example.split === 'val') {
      valExamples.push(example);
      stats.valExamples++;
    }
  }

  // Validate we have examples to export
  if (stats.trainExamples === 0 && stats.valExamples === 0) {
    if (stats.noSplit > 0) {
      console.log(
        `Found ${stats.qualifiedExamples} qualified examples but none have train/val splits assigned.`,
      );
      console.log('Run `ft split` first to assign train/val splits.');
    } else if (stats.unrated > 0) {
      console.log('No rated examples found. Rate examples with `ft rate` first.');
    } else if (stats.belowThreshold > 0) {
      console.log(
        `No examples meet quality threshold (${config.qualityThreshold}/10). Rate examples with \`ft rate\` first.`,
      );
    } else {
      console.log('No examples found to format.');
    }
    return;
  }

  // Validate training examples (must have at least user+assistant)
  const validationErrors: string[] = [];
  for (const example of [...trainExamples, ...valExamples]) {
    const error = validateExample(example);
    if (error) {
      validationErrors.push(error);
    }
  }

  if (validationErrors.length > 0) {
    throw new Error(
      `Validation failed:\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? `\n... and ${validationErrors.length - 5} more errors` : ''}`,
    );
  }

  // Format and export examples
  const trainPath = join(cwd, TRAIN_FILE);
  const valPath = join(cwd, VAL_FILE);

  if (stats.trainExamples > 0) {
    await exportExamples(trainExamples, trainPath, config.provider);
  }

  if (stats.valExamples > 0) {
    await exportExamples(valExamples, valPath, config.provider);
  }

  // Display summary
  displaySummary(stats, config.qualityThreshold, config.provider);
}

function validateExample(example: Example): string | null {
  // Must have messages array
  if (!Array.isArray(example.messages) || example.messages.length === 0) {
    return `Example ID ${example.id}: No messages found`;
  }

  // Validate message structure first (before checking for specific roles)
  for (const message of example.messages) {
    if (!message.role || !message.content) {
      return `Example ID ${example.id}: Invalid message structure (missing role or content)`;
    }

    if (!['system', 'user', 'assistant'].includes(message.role)) {
      return `Example ID ${example.id}: Invalid message role "${message.role}"`;
    }

    if (typeof message.content !== 'string') {
      return `Example ID ${example.id}: Message content must be a string`;
    }
  }

  // Must have at least one user and one assistant message
  const hasUser = example.messages.some((m) => m.role === 'user');
  const hasAssistant = example.messages.some((m) => m.role === 'assistant');

  if (!hasUser) {
    return `Example ID ${example.id}: Missing user message`;
  }

  if (!hasAssistant) {
    return `Example ID ${example.id}: Missing assistant message`;
  }

  return null;
}

async function exportExamples(
  examples: Example[],
  filePath: string,
  _provider: string,
): Promise<void> {
  // Both Together.ai and OpenAI use the same format: standard chat messages
  const formatted: TrainingExample[] = examples.map((example) => ({
    messages: example.messages,
  }));

  const content = formatted.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await writeFile(filePath, content);
}

function displaySummary(stats: FormatStats, threshold: number, provider: string): void {
  console.log('\n' + '═'.repeat(70));
  console.log('Format Complete');
  console.log('═'.repeat(70));

  console.log(`\nProvider: ${provider}`);
  console.log(`Quality threshold: ${threshold}/10`);

  console.log('\nExport Summary:');
  console.log('━'.repeat(70));
  console.log(`Training examples: ${stats.trainExamples} → data/train.jsonl`);
  console.log(`Validation examples: ${stats.valExamples} → data/val.jsonl`);
  console.log(`Total exported: ${stats.trainExamples + stats.valExamples} examples`);

  if (stats.noSplit > 0 || stats.belowThreshold > 0 || stats.unrated > 0) {
    console.log('\nExcluded Examples:');
    console.log('━'.repeat(70));
    if (stats.unrated > 0) {
      console.log(`Unrated: ${stats.unrated}`);
    }
    if (stats.belowThreshold > 0) {
      console.log(`Below threshold: ${stats.belowThreshold}`);
    }
    if (stats.noSplit > 0) {
      console.log(`No split assigned: ${stats.noSplit}`);
    }
  }

  console.log('\nNext Steps:');
  console.log('━'.repeat(70));
  console.log('1. Review exported files: data/train.jsonl and data/val.jsonl');
  console.log('2. Run `ft train` to start fine-tuning');

  console.log('═'.repeat(70) + '\n');
}
