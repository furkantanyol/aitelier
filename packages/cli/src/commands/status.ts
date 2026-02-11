import type { Command } from 'commander';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig, saveConfig } from '../storage/config.js';
import { TogetherProvider } from '../providers/together.js';

const CONFIG_FILE = '.ftpipeline.json';

interface StatusOptions {
  all?: boolean;
}

export function registerStatus(program: Command): void {
  program
    .command('status')
    .description('Check fine-tuning job status')
    .option('--all', 'Show all runs')
    .action(async (options: StatusOptions) => {
      try {
        await statusCommand(options);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });
}

async function statusCommand(options: StatusOptions): Promise<void> {
  const cwd = process.cwd();

  // Check if project is initialized
  try {
    await access(join(cwd, CONFIG_FILE));
  } catch {
    throw new Error('Project not initialized. Run `ft init` first to create .ftpipeline.json');
  }

  // Load config
  const config = await loadConfig(cwd);

  // Check if any jobs exist
  if (config.runs.length === 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('No Training Jobs Found');
    console.log('═'.repeat(70));
    console.log('\nNo fine-tuning jobs have been started yet.');
    console.log('\nTo start a job, run: ft train');
    console.log('═'.repeat(70) + '\n');
    return;
  }

  // Initialize provider based on config
  let provider;
  if (config.provider === 'together') {
    provider = new TogetherProvider();
  } else {
    throw new Error(`Provider "${config.provider}" not yet supported. Use "together" for now.`);
  }

  // Determine which runs to show
  const runsToCheck = options.all ? config.runs : [config.runs[config.runs.length - 1]];

  console.log('\n' + '═'.repeat(70));
  console.log(options.all ? 'All Training Jobs' : 'Latest Training Job');
  console.log('═'.repeat(70));

  let configUpdated = false;

  for (let i = 0; i < runsToCheck.length; i++) {
    const run = runsToCheck[i];

    // Fetch live status from API
    const jobStatus = await provider.getJobStatus(run.jobId);

    // Update config if status changed or model ID is now available
    if (run.status !== jobStatus.status || (jobStatus.modelId && !run.modelId)) {
      run.status = jobStatus.status;
      if (jobStatus.modelId) {
        run.modelId = jobStatus.modelId;
      }
      configUpdated = true;
    }

    // Display job information
    if (i > 0) {
      console.log('\n' + '━'.repeat(70));
    }

    console.log(`\nJob ID: ${run.jobId}`);
    console.log(`Provider: ${run.provider}`);
    console.log(`Status: ${formatStatus(jobStatus.status)}`);
    console.log(`Started: ${new Date(run.startedAt).toLocaleString()}`);

    // Show model ID if completed
    if (jobStatus.modelId) {
      console.log(`Model ID: ${jobStatus.modelId}`);
    }

    // Show error if failed
    if (jobStatus.error) {
      console.log(`Error: ${jobStatus.error}`);
    }

    // Show hyperparameters
    if (run.hyperparameters) {
      console.log('\nHyperparameters:');
      console.log(`  Epochs: ${run.hyperparameters.epochs || 'N/A'}`);
      console.log(`  Batch size: ${run.hyperparameters.batchSize || 'N/A'}`);
      console.log(`  Learning rate: ${run.hyperparameters.learningRate || 'N/A'}`);
      console.log(`  LoRA rank: ${run.hyperparameters.loraR || 'N/A'}`);
      console.log(`  LoRA alpha: ${run.hyperparameters.loraAlpha || 'N/A'}`);
    }
  }

  // Save config if any updates were made
  if (configUpdated) {
    await saveConfig(config, cwd);
  }

  // Display next steps based on status
  const latestRun = config.runs[config.runs.length - 1];
  console.log('\n' + '═'.repeat(70));
  console.log('Next Steps');
  console.log('═'.repeat(70));

  if (latestRun.status === 'completed' && latestRun.modelId) {
    console.log('\nJob completed successfully!');
    console.log(`\nYou can now evaluate your model: ft eval`);
    console.log(`Model ID: ${latestRun.modelId}`);
  } else if (latestRun.status === 'failed') {
    console.log('\nJob failed. Check the error message above.');
    console.log('You may need to adjust your training data or hyperparameters.');
  } else if (latestRun.status === 'cancelled') {
    console.log('\nJob was cancelled.');
    console.log('You can start a new job with: ft train');
  } else {
    console.log(`\nJob is ${latestRun.status}. Check back later for updates.`);
    console.log('Run `ft status` again to refresh.');
  }

  console.log('═'.repeat(70) + '\n');
}

function formatStatus(status: string): string {
  const statusEmoji: Record<string, string> = {
    pending: '⏳ pending',
    running: '🔄 running',
    completed: '✅ completed',
    failed: '❌ failed',
    cancelled: '🚫 cancelled',
  };

  return statusEmoji[status] || status;
}
