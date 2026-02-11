import { readFile } from 'node:fs/promises';
import type { Provider, FineTuneConfig, JobStatus, Message } from './types.js';

const TOGETHER_API_BASE = 'https://api.together.xyz/v1';

export class TogetherProvider implements Provider {
  name = 'together';
  private apiKey: string;

  constructor() {
    const key = process.env.TOGETHER_API_KEY;
    if (!key) {
      throw new Error('TOGETHER_API_KEY environment variable is required');
    }
    this.apiKey = key;
  }

  async uploadTrainingFile(filePath: string): Promise<string> {
    const fileContent = await readFile(filePath, 'utf-8');
    const fileName = filePath.split('/').pop() || 'training.jsonl';

    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'application/jsonl' });
    formData.append('file', blob, fileName);
    formData.append('purpose', 'fine-tune');

    const response = await fetch(`${TOGETHER_API_BASE}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload file: ${error}`);
    }

    const data = (await response.json()) as { id: string };
    return data.id;
  }

  async createFineTuneJob(config: FineTuneConfig): Promise<string> {
    const body: Record<string, unknown> = {
      model: config.model,
      training_file: config.trainingFile,
    };

    // Add optional parameters
    if (config.validationFile) {
      body.validation_file = config.validationFile;
    }
    if (config.epochs !== undefined) {
      body.n_epochs = config.epochs;
    }
    if (config.batchSize !== undefined) {
      body.batch_size = config.batchSize;
    }
    if (config.learningRate !== undefined) {
      body.learning_rate = config.learningRate;
    }
    if (config.loraR !== undefined) {
      body.lora_r = config.loraR;
    }
    if (config.loraAlpha !== undefined) {
      body.lora_alpha = config.loraAlpha;
    }

    const response = await fetch(`${TOGETHER_API_BASE}/fine-tunes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create fine-tune job: ${error}`);
    }

    const data = (await response.json()) as { id: string };
    return data.id;
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`${TOGETHER_API_BASE}/fine-tunes/${jobId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get job status: ${error}`);
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      fine_tuned_model?: string;
      error?: string;
    };

    const statusMap: Record<string, JobStatus['status']> = {
      pending: 'pending',
      running: 'running',
      succeeded: 'completed',
      failed: 'failed',
      cancelled: 'cancelled',
    };

    return {
      id: data.id,
      status: statusMap[data.status] || 'pending',
      modelId: data.fine_tuned_model,
      error: data.error,
    };
  }

  async runInference(model: string, messages: Message[]): Promise<string> {
    const response = await fetch(`${TOGETHER_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to run inference: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0].message.content;
  }
}
