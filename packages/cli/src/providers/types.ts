export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FineTuneConfig {
  model: string;
  trainingFile: string;
  validationFile?: string;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  loraR?: number;
  loraAlpha?: number;
}

export interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  modelId?: string;
  error?: string;
}

export interface Provider {
  name: string;
  uploadTrainingFile(filePath: string): Promise<string>;
  createFineTuneJob(config: FineTuneConfig): Promise<string>;
  getJobStatus(jobId: string): Promise<JobStatus>;
  runInference(model: string, messages: Message[]): Promise<string>;
}
