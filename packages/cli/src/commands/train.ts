import type { Command } from 'commander';
import { access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, saveConfig } from '../storage/config.js';
import { TogetherProvider } from '../providers/together.js';

const CONFIG_FILE = '.ftpipeline.json';
const TRAIN_FILE = 'data/train.jsonl';
const VAL_FILE = 'data/val.jsonl';

interface TrainOptions {
  epochs?: string;
  batchSize?: string;
  learningRate?: string;
  loraR?: string;
  loraAlpha?: string;
}

export function registerTrain(program: Command): void {
  program
    .command('train')
    .description('Start a fine-tuning job')
    .option('--epochs <n>', 'Number of training epochs', '3')
    .option('--batch-size <n>', 'Batch size', '4')
    .option('--learning-rate <rate>', 'Learning rate', '1e-5')
    .option('--lora-r <rank>', 'LoRA rank', '16')
    .option('--lora-alpha <alpha>', 'LoRA alpha', '32')
    .action(async (options: TrainOptions) => {
      try {
        await trainCommand(options);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

async function trainCommand(options: TrainOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if project is initialized
  try {
    await access(join(cwd, CONFIG_FILE));
  } catch {
    throw new Error('Project not initialized. Run `ft init` first to create .ftpipeline.json');
  }

  // Load config
  const config = await loadConfig(cwd);

  // Check for training file
  const trainPath = join(cwd, TRAIN_FILE);
  try {
    await access(trainPath);
  } catch {
    throw new Error('Training file not found. Run `ft format` first to generate data/train.jsonl');
  }

  // Check for validation file (optional but recommended)
  const valPath = join(cwd, VAL_FILE);
  let hasValidationFile = false;
  try {
    const valStat = await stat(valPath);
    hasValidationFile = valStat.size > 0;
  } catch {
    // Validation file is optional
    hasValidationFile = false;
  }

  // Initialize provider based on config
  let provider;
  if (config.provider === 'together') {
    provider = new TogetherProvider();
  } else {
    throw new Error(`Provider "${config.provider}" not yet supported. Use "together" for now.`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('Starting Fine-Tuning Job');
  console.log('═'.repeat(70));
  console.log(`\nProvider: ${config.provider}`);
  console.log(`Base model: ${config.model}`);

  // Parse hyperparameters
  const epochs = options.epochs ? parseInt(options.epochs, 10) : 3;
  const batchSize = options.batchSize ? parseInt(options.batchSize, 10) : 4;
  const learningRate = options.learningRate ? parseFloat(options.learningRate) : 1e-5;
  const loraR = options.loraR ? parseInt(options.loraR, 10) : 16;
  const loraAlpha = options.loraAlpha ? parseInt(options.loraAlpha, 10) : 32;

  console.log('\nHyperparameters:');
  console.log('━'.repeat(70));
  console.log(`Epochs: ${epochs}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Learning rate: ${learningRate}`);
  console.log(`LoRA rank: ${loraR}`);
  console.log(`LoRA alpha: ${loraAlpha}`);

  // Upload training file
  console.log('\nUploading training file...');
  const trainingFileId = await provider.uploadTrainingFile(trainPath);
  console.log(`Training file uploaded: ${trainingFileId}`);

  // Upload validation file if it exists
  let validationFileId: string | undefined;
  if (hasValidationFile) {
    console.log('Uploading validation file...');
    validationFileId = await provider.uploadTrainingFile(valPath);
    console.log(`Validation file uploaded: ${validationFileId}`);
  } else {
    console.log('No validation file found (skipping)');
  }

  // Create fine-tune job
  console.log('\nCreating fine-tune job...');
  const jobId = await provider.createFineTuneJob({
    model: config.model,
    trainingFile: trainingFileId,
    validationFile: validationFileId,
    epochs,
    batchSize,
    learningRate,
    loraR,
    loraAlpha,
  });

  console.log(`Job created: ${jobId}`);

  // Save job info to config
  const jobInfo = {
    jobId,
    provider: config.provider,
    startedAt: new Date().toISOString(),
    status: 'pending',
    hyperparameters: {
      epochs,
      batchSize,
      learningRate,
      loraR,
      loraAlpha,
    },
  };

  config.runs.push(jobInfo);
  await saveConfig(config, cwd);

  // Display next steps
  console.log('\n' + '═'.repeat(70));
  console.log('Job Started Successfully');
  console.log('═'.repeat(70));
  console.log(`\nJob ID: ${jobId}`);
  console.log(`Status: pending`);

  console.log('\nNext Steps:');
  console.log('━'.repeat(70));
  console.log('1. Monitor progress: ft status');
  console.log('2. Check all runs: ft status --all');
  console.log('3. After completion, run evaluations: ft eval');

  console.log('═'.repeat(70) + '\n');
}
