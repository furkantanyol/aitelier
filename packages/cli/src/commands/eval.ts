import type { Command } from 'commander';
import inquirer from 'inquirer';
import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../storage/config.js';
import { readExamples } from '../storage/dataset.js';
import { TogetherProvider } from '../providers/together.js';
import type { Example } from '../storage/dataset.js';
import type { Message } from '../providers/types.js';
import { writeFile } from 'node:fs/promises';

const CONFIG_FILE = '.ftpipeline.json';
const VAL_FILE = 'data/val.jsonl';
const EVALS_DIR = 'data/evals';

interface EvalResult {
  exampleId: number;
  input: Message[];
  expectedOutput: string;
  actualOutput: string;
  score: number;
}

interface EvalSummary {
  modelId: string;
  timestamp: string;
  totalExamples: number;
  averageScore: number;
  sendableRate: number;
  results: EvalResult[];
}

interface CompareResult {
  exampleId: number;
  input: Message[];
  expectedOutput: string;
  baseOutput: string;
  fineTunedOutput: string;
  modelAOutput: string;
  modelBOutput: string;
  modelAIsBase: boolean;
  scoreA: number;
  scoreB: number;
}

interface CompareSummary {
  baseModelId: string;
  fineTunedModelId: string;
  timestamp: string;
  totalExamples: number;
  baseModelAvgScore: number;
  fineTunedModelAvgScore: number;
  baseModelWins: number;
  fineTunedModelWins: number;
  ties: number;
  results: CompareResult[];
}

interface SessionStats {
  evaluated: number;
  skipped: number;
  scores: number[];
}

export function registerEval(program: Command): void {
  program
    .command('eval')
    .description('Evaluate fine-tuned model on validation examples')
    .option('--compare', 'Compare base model vs fine-tuned model (blind A/B test)')
    .action(async (options: { compare?: boolean }) => {
      try {
        if (options.compare) {
          await evalCompareCommand();
        } else {
          await evalCommand();
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

async function evalCommand(): Promise<void> {
  const cwd = process.cwd();

  // Check if project is initialized
  try {
    await access(join(cwd, CONFIG_FILE));
  } catch {
    throw new Error('Project not initialized. Run `ft init` first to create .ftpipeline.json');
  }

  // Load config
  const config = await loadConfig(cwd);

  // Find most recent completed model
  const completedRuns = config.runs.filter((r) => r.status === 'completed' && r.modelId);

  if (completedRuns.length === 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('No Completed Models Found');
    console.log('═'.repeat(70));
    console.log('\nNo completed fine-tuning jobs with model IDs found.');
    console.log('\nTo start a training job, run: ft train');
    console.log('To check job status, run: ft status');
    console.log('═'.repeat(70) + '\n');
    return;
  }

  const latestRun = completedRuns[completedRuns.length - 1];
  const modelId = latestRun.modelId!;

  // Load validation examples
  const valPath = join(cwd, VAL_FILE);
  let valExamples: Example[];
  try {
    valExamples = await readExamples(valPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('\n' + '═'.repeat(70));
      console.log('No Validation Data Found');
      console.log('═'.repeat(70));
      console.log('\nNo validation examples found.');
      console.log('\nTo create validation data, run: ft split');
      console.log('═'.repeat(70) + '\n');
      return;
    }
    throw error;
  }

  if (valExamples.length === 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('No Validation Examples');
    console.log('═'.repeat(70));
    console.log('\nValidation file is empty.');
    console.log('\nTo create validation data, run: ft split');
    console.log('═'.repeat(70) + '\n');
    return;
  }

  // Initialize provider
  let provider;
  if (config.provider === 'together') {
    provider = new TogetherProvider();
  } else {
    throw new Error(`Provider "${config.provider}" not yet supported. Use "together" for now.`);
  }

  // Display header
  console.log('\n' + '═'.repeat(70));
  console.log('Model Evaluation');
  console.log('═'.repeat(70));
  console.log(`Model: ${modelId}`);
  console.log(`Validation examples: ${valExamples.length}`);
  console.log('═'.repeat(70) + '\n');

  // Initialize results and stats
  const results: EvalResult[] = [];
  const stats: SessionStats = {
    evaluated: 0,
    skipped: 0,
    scores: [],
  };

  // Main evaluation loop
  for (let i = 0; i < valExamples.length; i++) {
    const example = valExamples[i];

    console.log(`\nExample ${i + 1} of ${valExamples.length}`);
    console.log('━'.repeat(70));

    // Extract input messages (system + user, no assistant)
    const inputMessages = example.messages.filter((m) => m.role !== 'assistant');
    const expectedOutput = example.messages.find((m) => m.role === 'assistant')?.content || '';

    if (!expectedOutput) {
      console.log('Warning: No expected output found for this example. Skipping...\n');
      stats.skipped++;
      continue;
    }

    // Run inference
    console.log('Running inference...');
    let actualOutput: string;
    try {
      actualOutput = await provider.runInference(modelId, inputMessages);
    } catch (error) {
      console.log(
        `Error running inference: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.log('Skipping this example...\n');
      stats.skipped++;
      continue;
    }

    // Display side-by-side comparison
    displayComparison(inputMessages, expectedOutput, actualOutput);

    // Prompt for action
    const action = await promptAction();

    if (action === 'quit') {
      console.log('\nQuitting evaluation...');
      break;
    }

    if (action === 'skip') {
      stats.skipped++;
      continue;
    }

    // Prompt for score
    const score = await promptScore();
    stats.evaluated++;
    stats.scores.push(score);

    // Save result
    results.push({
      exampleId: example.id,
      input: inputMessages,
      expectedOutput,
      actualOutput,
      score,
    });

    console.log(`✓ Scored as ${score}/5\n`);
  }

  // Calculate summary stats
  if (stats.evaluated === 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('No examples evaluated. Exiting without saving results.');
    console.log('═'.repeat(70) + '\n');
    return;
  }

  const averageScore = stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length;
  const sendableRate = (stats.scores.filter((s) => s >= 4).length / stats.scores.length) * 100;

  // Display summary
  displaySummary(stats, averageScore, sendableRate);

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const evalsPath = join(cwd, EVALS_DIR);

  try {
    await mkdir(evalsPath, { recursive: true });
  } catch {
    // Directory already exists
  }

  const evalSummary: EvalSummary = {
    modelId,
    timestamp: new Date().toISOString(),
    totalExamples: stats.evaluated,
    averageScore,
    sendableRate,
    results,
  };

  const outputPath = join(evalsPath, `eval-${modelId.replace(/[/\\:]/g, '_')}-${timestamp}.json`);
  await writeFile(outputPath, JSON.stringify(evalSummary, null, 2) + '\n');

  console.log(`\nResults saved to: ${outputPath}`);
  console.log('═'.repeat(70) + '\n');
}

function displayComparison(
  inputMessages: Message[],
  expectedOutput: string,
  actualOutput: string,
): void {
  console.log('\nInput:');
  for (const msg of inputMessages) {
    const label = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    console.log(`  ${label}: ${msg.content}`);
  }

  console.log('\n' + '━'.repeat(70));
  console.log('Expected Output:');
  console.log('━'.repeat(70));
  console.log(expectedOutput);

  console.log('\n' + '━'.repeat(70));
  console.log('Model Output:');
  console.log('━'.repeat(70));
  console.log(actualOutput);
  console.log('━'.repeat(70));
}

async function promptAction(): Promise<'score' | 'skip' | 'quit'> {
  const answer = await inquirer.prompt<{ action: 'score' | 'skip' | 'quit' }>([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Score this output', value: 'score' },
        { name: 'Skip', value: 'skip' },
        { name: 'Quit', value: 'quit' },
      ],
    },
  ]);

  return answer.action;
}

async function promptScore(): Promise<number> {
  const answer = await inquirer.prompt<{ score: string }>([
    {
      type: 'input',
      name: 'score',
      message: 'Score this output (1-5):',
      validate: (input: string) => {
        const num = parseFloat(input);
        if (isNaN(num)) {
          return 'Please enter a valid number';
        }
        if (num < 1 || num > 5) {
          return 'Score must be between 1 and 5';
        }
        if (!Number.isInteger(num)) {
          return 'Score must be a whole number';
        }
        return true;
      },
    },
  ]);

  return parseInt(answer.score, 10);
}

function displaySummary(stats: SessionStats, averageScore: number, sendableRate: number): void {
  console.log('\n' + '═'.repeat(70));
  console.log('Evaluation Complete');
  console.log('═'.repeat(70));
  console.log(`Examples evaluated: ${stats.evaluated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`\nAverage score: ${averageScore.toFixed(2)}/5`);
  console.log(`Sendable rate (4+): ${sendableRate.toFixed(1)}%`);
  console.log('═'.repeat(70));
}

async function evalCompareCommand(): Promise<void> {
  const cwd = process.cwd();

  // Check if project is initialized
  try {
    await access(join(cwd, CONFIG_FILE));
  } catch {
    throw new Error('Project not initialized. Run `ft init` first to create .ftpipeline.json');
  }

  // Load config
  const config = await loadConfig(cwd);

  // Find most recent completed model
  const completedRuns = config.runs.filter((r) => r.status === 'completed' && r.modelId);

  if (completedRuns.length === 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('No Completed Models Found');
    console.log('═'.repeat(70));
    console.log('\nNo completed fine-tuning jobs with model IDs found.');
    console.log('\nTo start a training job, run: ft train');
    console.log('To check job status, run: ft status');
    console.log('═'.repeat(70) + '\n');
    return;
  }

  const latestRun = completedRuns[completedRuns.length - 1];
  const fineTunedModelId = latestRun.modelId!;
  const baseModelId = config.model;

  // Load validation examples
  const valPath = join(cwd, VAL_FILE);
  let valExamples: Example[];
  try {
    valExamples = await readExamples(valPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('\n' + '═'.repeat(70));
      console.log('No Validation Data Found');
      console.log('═'.repeat(70));
      console.log('\nNo validation examples found.');
      console.log('\nTo create validation data, run: ft split');
      console.log('═'.repeat(70) + '\n');
      return;
    }
    throw error;
  }

  if (valExamples.length === 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('No Validation Examples');
    console.log('═'.repeat(70));
    console.log('\nValidation file is empty.');
    console.log('\nTo create validation data, run: ft split');
    console.log('═'.repeat(70) + '\n');
    return;
  }

  // Initialize provider
  let provider;
  if (config.provider === 'together') {
    provider = new TogetherProvider();
  } else {
    throw new Error(`Provider "${config.provider}" not yet supported. Use "together" for now.`);
  }

  // Display header
  console.log('\n' + '═'.repeat(70));
  console.log('Model Comparison (Blind A/B Test)');
  console.log('═'.repeat(70));
  console.log(`Base model: ${baseModelId}`);
  console.log(`Fine-tuned model: ${fineTunedModelId}`);
  console.log(`Validation examples: ${valExamples.length}`);
  console.log('\nYou will see outputs from both models (labeled A and B).');
  console.log("The order is randomized - you won't know which is which until the end.");
  console.log('═'.repeat(70) + '\n');

  // Initialize results and stats
  const results: CompareResult[] = [];
  const stats: SessionStats = {
    evaluated: 0,
    skipped: 0,
    scores: [],
  };

  // Main comparison loop
  for (let i = 0; i < valExamples.length; i++) {
    const example = valExamples[i];

    console.log(`\nExample ${i + 1} of ${valExamples.length}`);
    console.log('━'.repeat(70));

    // Extract input messages (system + user, no assistant)
    const inputMessages = example.messages.filter((m) => m.role !== 'assistant');
    const expectedOutput = example.messages.find((m) => m.role === 'assistant')?.content || '';

    if (!expectedOutput) {
      console.log('Warning: No expected output found for this example. Skipping...\n');
      stats.skipped++;
      continue;
    }

    // Run inference on both models
    console.log('Running inference on both models...');
    let baseOutput: string;
    let fineTunedOutput: string;

    try {
      [baseOutput, fineTunedOutput] = await Promise.all([
        provider.runInference(baseModelId, inputMessages),
        provider.runInference(fineTunedModelId, inputMessages),
      ]);
    } catch (error) {
      console.log(
        `Error running inference: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.log('Skipping this example...\n');
      stats.skipped++;
      continue;
    }

    // Randomly assign to A and B
    const modelAIsBase = Math.random() < 0.5;
    const modelAOutput = modelAIsBase ? baseOutput : fineTunedOutput;
    const modelBOutput = modelAIsBase ? fineTunedOutput : baseOutput;

    // Display comparison
    displayBlindComparison(inputMessages, expectedOutput, modelAOutput, modelBOutput);

    // Prompt for action
    const action = await promptAction();

    if (action === 'quit') {
      console.log('\nQuitting comparison...');
      break;
    }

    if (action === 'skip') {
      stats.skipped++;
      continue;
    }

    // Prompt for scores
    console.log('\n' + '━'.repeat(70));
    console.log('Score Model A:');
    const scoreA = await promptScore();
    console.log(`✓ Scored as ${scoreA}/5\n`);

    console.log('Score Model B:');
    const scoreB = await promptScore();
    console.log(`✓ Scored as ${scoreB}/5\n`);

    stats.evaluated++;

    // Save result
    results.push({
      exampleId: example.id,
      input: inputMessages,
      expectedOutput,
      baseOutput,
      fineTunedOutput,
      modelAOutput,
      modelBOutput,
      modelAIsBase,
      scoreA,
      scoreB,
    });
  }

  // Calculate summary stats
  if (stats.evaluated === 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('No examples evaluated. Exiting without saving results.');
    console.log('═'.repeat(70) + '\n');
    return;
  }

  // Calculate aggregate stats
  let baseModelTotalScore = 0;
  let fineTunedModelTotalScore = 0;
  let baseModelWins = 0;
  let fineTunedModelWins = 0;
  let ties = 0;

  for (const result of results) {
    const baseScore = result.modelAIsBase ? result.scoreA : result.scoreB;
    const fineTunedScore = result.modelAIsBase ? result.scoreB : result.scoreA;

    baseModelTotalScore += baseScore;
    fineTunedModelTotalScore += fineTunedScore;

    if (baseScore > fineTunedScore) {
      baseModelWins++;
    } else if (fineTunedScore > baseScore) {
      fineTunedModelWins++;
    } else {
      ties++;
    }
  }

  const baseModelAvgScore = baseModelTotalScore / stats.evaluated;
  const fineTunedModelAvgScore = fineTunedModelTotalScore / stats.evaluated;

  // Display reveal and summary
  displayComparisonSummary(
    baseModelId,
    fineTunedModelId,
    stats,
    baseModelAvgScore,
    fineTunedModelAvgScore,
    baseModelWins,
    fineTunedModelWins,
    ties,
  );

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const evalsPath = join(cwd, EVALS_DIR);

  try {
    await mkdir(evalsPath, { recursive: true });
  } catch {
    // Directory already exists
  }

  const compareSummary: CompareSummary = {
    baseModelId,
    fineTunedModelId,
    timestamp: new Date().toISOString(),
    totalExamples: stats.evaluated,
    baseModelAvgScore,
    fineTunedModelAvgScore,
    baseModelWins,
    fineTunedModelWins,
    ties,
    results,
  };

  const outputPath = join(
    evalsPath,
    `compare-${fineTunedModelId.replace(/[/\\:]/g, '_')}-${timestamp}.json`,
  );
  await writeFile(outputPath, JSON.stringify(compareSummary, null, 2) + '\n');

  console.log(`\nResults saved to: ${outputPath}`);
  console.log('═'.repeat(70) + '\n');
}

function displayBlindComparison(
  inputMessages: Message[],
  expectedOutput: string,
  modelAOutput: string,
  modelBOutput: string,
): void {
  console.log('\nInput:');
  for (const msg of inputMessages) {
    const label = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    console.log(`  ${label}: ${msg.content}`);
  }

  console.log('\n' + '━'.repeat(70));
  console.log('Expected Output:');
  console.log('━'.repeat(70));
  console.log(expectedOutput);

  console.log('\n' + '━'.repeat(70));
  console.log('Model A Output:');
  console.log('━'.repeat(70));
  console.log(modelAOutput);

  console.log('\n' + '━'.repeat(70));
  console.log('Model B Output:');
  console.log('━'.repeat(70));
  console.log(modelBOutput);
  console.log('━'.repeat(70));
}

function displayComparisonSummary(
  baseModelId: string,
  fineTunedModelId: string,
  stats: SessionStats,
  baseModelAvgScore: number,
  fineTunedModelAvgScore: number,
  baseModelWins: number,
  fineTunedModelWins: number,
  ties: number,
): void {
  console.log('\n' + '═'.repeat(70));
  console.log('Comparison Results - The Reveal!');
  console.log('═'.repeat(70));
  console.log(`Base model: ${baseModelId}`);
  console.log(`Fine-tuned model: ${fineTunedModelId}`);
  console.log('═'.repeat(70));
  console.log(`\nExamples compared: ${stats.evaluated}`);
  console.log(`Skipped: ${stats.skipped}`);

  console.log('\n' + '━'.repeat(70));
  console.log('Average Scores:');
  console.log('━'.repeat(70));
  console.log(`Base model:       ${baseModelAvgScore.toFixed(2)}/5`);
  console.log(`Fine-tuned model: ${fineTunedModelAvgScore.toFixed(2)}/5`);

  const improvement =
    baseModelAvgScore > 0
      ? (((fineTunedModelAvgScore - baseModelAvgScore) / baseModelAvgScore) * 100).toFixed(1)
      : '0.0';
  console.log(`\nImprovement: ${improvement}%`);

  console.log('\n' + '━'.repeat(70));
  console.log('Head-to-Head:');
  console.log('━'.repeat(70));
  console.log(`Base model wins:       ${baseModelWins}`);
  console.log(`Fine-tuned model wins: ${fineTunedModelWins}`);
  console.log(`Ties:                  ${ties}`);

  const winRate =
    stats.evaluated > 0 ? ((fineTunedModelWins / stats.evaluated) * 100).toFixed(1) : '0.0';
  console.log(`\nFine-tuned model win rate: ${winRate}%`);

  console.log('═'.repeat(70));
}
