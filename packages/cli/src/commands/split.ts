import type { Command } from 'commander';
import inquirer from 'inquirer';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Example } from '../storage/dataset.js';
import { readExamples, writeExamples } from '../storage/dataset.js';
import { loadConfig } from '../storage/config.js';

const CONFIG_FILE = '.ftpipeline.json';
const EXAMPLES_FILE = 'data/examples.jsonl';

interface SplitStats {
  totalExamples: number;
  qualifiedExamples: number;
  belowThreshold: number;
  newTrain: number;
  newVal: number;
  lockedVal: number;
  totalTrain: number;
  totalVal: number;
}

export function registerSplit(program: Command): void {
  program
    .command('split')
    .description('Assign train/validation splits to examples')
    .option(
      '--ratio <ratio>',
      'Train ratio for the split (e.g., 0.8 for 80/20, 0.9 for 90/10)',
      '0.8',
    )
    .option('--reshuffle', 'Force re-split of all examples (requires confirmation)')
    .action(async (options: { ratio: string; reshuffle?: boolean }) => {
      try {
        await splitCommand(options);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

async function splitCommand(options: { ratio: string; reshuffle?: boolean }): Promise<void> {
  const cwd = process.cwd();

  // Check if project is initialized
  try {
    await access(join(cwd, CONFIG_FILE));
  } catch {
    throw new Error('Project not initialized. Run `ft init` first to create .ftpipeline.json');
  }

  // Parse and validate --ratio flag
  const trainRatio = parseFloat(options.ratio);
  if (isNaN(trainRatio) || trainRatio <= 0 || trainRatio >= 1) {
    throw new Error('--ratio must be a number between 0 and 1 (exclusive)');
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

  // Check for rated examples meeting threshold
  const qualified = examples.filter(
    (e) => e.rating !== null && e.rating >= config.qualityThreshold,
  );

  if (qualified.length === 0) {
    console.log(
      `No examples meet quality threshold (${config.qualityThreshold}/10). Rate examples with \`ft rate\` first.`,
    );
    return;
  }

  // Check for existing validation assignments
  const existingVal = examples.filter((e) => e.split === 'val');
  const hasExistingSplit = existingVal.length > 0;

  // Handle --reshuffle flag
  if (options.reshuffle) {
    if (!hasExistingSplit) {
      console.log('No existing split found. Proceeding with initial split.');
    } else {
      const confirmed = await confirmReshuffle(existingVal.length);
      if (!confirmed) {
        console.log('Split cancelled.');
        return;
      }
      // Clear all split assignments
      for (const example of examples) {
        delete example.split;
      }
    }
  } else if (hasExistingSplit) {
    // Lock validation set unless --reshuffle
    console.log(
      `Found ${existingVal.length} locked validation examples. These will not be reassigned.`,
    );
    console.log('Use --reshuffle to force re-split with confirmation.\n');
  }

  // Perform the split
  const stats = performSplit(qualified, trainRatio, !options.reshuffle && hasExistingSplit);

  // Write updated examples back
  await writeExamples(examplesPath, examples);

  // Display summary
  displaySummary(stats, config.qualityThreshold, trainRatio);
}

async function confirmReshuffle(valCount: number): Promise<boolean> {
  const answer = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: 'confirm',
      name: 'confirm',
      message: `This will reshuffle all ${valCount} validation examples. Are you sure?`,
      default: false,
    },
  ]);

  return answer.confirm;
}

function performSplit(
  qualified: Example[],
  trainRatio: number,
  lockValidation: boolean,
): SplitStats {
  const stats: SplitStats = {
    totalExamples: 0,
    qualifiedExamples: qualified.length,
    belowThreshold: 0,
    newTrain: 0,
    newVal: 0,
    lockedVal: 0,
    totalTrain: 0,
    totalVal: 0,
  };

  // Separate locked validation examples from those to split
  const lockedVal = lockValidation ? qualified.filter((e) => e.split === 'val') : [];
  const toSplit = lockValidation ? qualified.filter((e) => e.split !== 'val') : qualified;

  stats.lockedVal = lockedVal.length;

  if (toSplit.length === 0) {
    // All qualified examples are already locked as validation
    stats.totalVal = lockedVal.length;
    return stats;
  }

  // Calculate target validation count from available examples
  const targetValCount = Math.round(toSplit.length * (1 - trainRatio));
  const actualValCount = Math.max(1, targetValCount); // At least 1 validation example

  // Stratified sampling by rating when possible
  const shuffled = stratifiedShuffle(toSplit);

  // Assign new validation examples
  const newVal = shuffled.slice(0, actualValCount);
  const newTrain = shuffled.slice(actualValCount);

  for (const example of newVal) {
    example.split = 'val';
    stats.newVal++;
  }

  for (const example of newTrain) {
    example.split = 'train';
    stats.newTrain++;
  }

  stats.totalTrain = stats.newTrain;
  stats.totalVal = stats.newVal + stats.lockedVal;

  return stats;
}

function stratifiedShuffle(examples: Example[]): Example[] {
  // Group examples by rating for stratified sampling
  const byRating = new Map<number, Example[]>();

  for (const example of examples) {
    if (example.rating === null) continue; // Should not happen since we filtered
    const rating = example.rating;
    if (!byRating.has(rating)) {
      byRating.set(rating, []);
    }
    byRating.get(rating)!.push(example);
  }

  // Shuffle within each rating group
  for (const group of byRating.values()) {
    shuffleArray(group);
  }

  // Interleave groups to maintain stratification
  const result: Example[] = [];
  const ratings = Array.from(byRating.keys()).sort((a, b) => b - a); // High to low

  let hasMore = true;
  let index = 0;

  while (hasMore) {
    hasMore = false;
    for (const rating of ratings) {
      const group = byRating.get(rating)!;
      if (index < group.length) {
        result.push(group[index]);
        hasMore = true;
      }
    }
    index++;
  }

  return result;
}

function shuffleArray<T>(array: T[]): void {
  // Fisher-Yates shuffle
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function displaySummary(stats: SplitStats, threshold: number, ratio: number): void {
  console.log('\n' + '═'.repeat(70));
  console.log('Train/Val Split Complete');
  console.log('═'.repeat(70));

  console.log(`\nQuality threshold: ${threshold}/10`);
  console.log(
    `Split ratio: ${(ratio * 100).toFixed(0)}% train / ${((1 - ratio) * 100).toFixed(0)}% val`,
  );

  console.log('\nSplit Summary:');
  console.log('━'.repeat(70));
  console.log(`Total train: ${stats.totalTrain} examples`);
  console.log(`Total val: ${stats.totalVal} examples`);

  if (stats.lockedVal > 0) {
    console.log(`  ├─ Locked (existing): ${stats.lockedVal}`);
    console.log(`  └─ New: ${stats.newVal}`);
  }

  const totalAssigned = stats.totalTrain + stats.totalVal;
  console.log(`\nTotal assigned: ${totalAssigned} examples`);

  console.log('\nNext Steps:');
  console.log('━'.repeat(70));
  console.log('1. Run `ft format` to generate train.jsonl and val.jsonl');
  console.log('2. Run `ft train` to start fine-tuning');

  console.log('═'.repeat(70) + '\n');
}
