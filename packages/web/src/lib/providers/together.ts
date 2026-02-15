// Together.ai provider integration for web app

export const TOGETHER_API_BASE = 'https://api.together.xyz/v1';

export type TogetherModel = {
  id: string;
  display_name: string;
  context_length: number;
};

const RECOMMENDED_MODELS = [
  'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
  'mistralai/Mistral-7B-Instruct-v0.3',
];

/**
 * Validate a Together.ai API key by hitting the models endpoint.
 */
export async function validateApiKey(apiKey: string) {
  try {
    const response = await fetch(`${TOGETHER_API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Failed to connect to Together.ai' };
  }
}

/**
 * Fetch available chat/instruct models from Together.ai, sorted with recommended first.
 */
export async function fetchModels(apiKey: string) {
  try {
    const response = await fetch(`${TOGETHER_API_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return { models: [], error: 'Failed to fetch models' };
    }

    const data = (await response.json()) as TogetherModel[];

    const chatModels = data
      .filter((m) => m.id.includes('Instruct') || m.id.includes('chat') || m.id.includes('Chat'))
      .map((m) => ({
        id: m.id,
        display_name: m.display_name || m.id.split('/').pop() || m.id,
        context_length: m.context_length,
        recommended: RECOMMENDED_MODELS.includes(m.id),
      }))
      .sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.display_name.localeCompare(b.display_name);
      });

    return { models: chatModels };
  } catch {
    return { models: [], error: 'Failed to connect to Together.ai' };
  }
}

export type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type TrainingExample = {
  messages: Message[];
};

export type FineTuneJobResponse = {
  id: string;
  status: string;
  fine_tuned_model?: string;
  error?: string;
};

/**
 * Format examples to Together.ai JSONL format
 */
export function formatExamplesToJSONL(
  examples: Array<{
    input: string;
    output: string;
    rewrite?: string | null;
  }>,
  systemPrompt: string | null,
): string {
  const lines = examples.map((example) => {
    const messages: Message[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Add user message
    messages.push({
      role: 'user',
      content: example.input,
    });

    // Add assistant message (use rewrite if available, otherwise original output)
    messages.push({
      role: 'assistant',
      content: example.rewrite ?? example.output,
    });

    const trainingExample: TrainingExample = { messages };
    return JSON.stringify(trainingExample);
  });

  return lines.join('\n');
}

/**
 * Upload training file to Together.ai
 */
export async function uploadTrainingFile(
  jsonlContent: string,
  apiKey: string,
  fileName = 'training.jsonl',
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([jsonlContent], { type: 'application/jsonl' });
  formData.append('file', blob, fileName);
  formData.append('purpose', 'fine-tune');

  const response = await fetch(`${TOGETHER_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload training file: ${error}`);
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

/**
 * Create a fine-tune job on Together.ai
 */
export async function createFineTuneJob(params: {
  apiKey: string;
  baseModel: string;
  trainingFileId: string;
  validationFileId?: string;
  epochs: number;
  batchSize: number;
  learningRate: number;
  loraR: number;
  loraAlpha: number;
  loraDropout?: number;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: params.baseModel,
    training_file: params.trainingFileId,
    n_epochs: params.epochs,
    batch_size: params.batchSize,
    learning_rate: params.learningRate,
    lora_r: params.loraR,
    lora_alpha: params.loraAlpha,
  };

  if (params.validationFileId) {
    body.validation_file = params.validationFileId;
  }

  if (params.loraDropout !== undefined) {
    body.lora_dropout = params.loraDropout;
  }

  const response = await fetch(`${TOGETHER_API_BASE}/fine-tunes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
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

/**
 * Get fine-tune job status from Together.ai
 */
export async function getJobStatus(jobId: string, apiKey: string): Promise<FineTuneJobResponse> {
  const response = await fetch(`${TOGETHER_API_BASE}/fine-tunes/${jobId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

  return {
    id: data.id,
    status: data.status,
    fine_tuned_model: data.fine_tuned_model,
    error: data.error,
  };
}

/**
 * Cancel a fine-tune job on Together.ai
 */
export async function cancelFineTuneJob(jobId: string, apiKey: string): Promise<void> {
  const response = await fetch(`${TOGETHER_API_BASE}/fine-tunes/${jobId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to cancel job: ${error}`);
  }
}
