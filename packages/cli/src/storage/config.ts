import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CONFIG_FILE = '.ftpipeline.json';

export interface ProjectConfig {
  name: string;
  provider: 'together' | 'openai';
  model: string;
  systemPrompt?: string;
  qualityThreshold: number;
  runs: Array<{
    jobId: string;
    modelId?: string;
    provider: string;
    startedAt: string;
    status: string;
    hyperparameters?: {
      epochs?: number;
      batchSize?: number;
      learningRate?: number;
      loraR?: number;
      loraAlpha?: number;
    };
  }>;
}

export async function loadConfig(dir: string = process.cwd()): Promise<ProjectConfig> {
  const raw = await readFile(join(dir, CONFIG_FILE), 'utf-8');
  return JSON.parse(raw) as ProjectConfig;
}

export async function saveConfig(
  config: ProjectConfig,
  dir: string = process.cwd(),
): Promise<void> {
  await writeFile(join(dir, CONFIG_FILE), JSON.stringify(config, null, 2) + '\n');
}
