import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Command } from 'commander';
import { registerTrain } from './train.js';
import type { ProjectConfig } from '../storage/config.js';

describe('ft train', () => {
  let testDir: string;
  let originalCwd: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'ft-train-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Mock TOGETHER_API_KEY
    process.env.TOGETHER_API_KEY = 'test-api-key';

    // Create basic project structure
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));
    await mkdir('data', { recursive: true });

    // Create sample training and validation files
    const trainData = [
      {
        messages: [
          { role: 'user', content: 'Question 1' },
          { role: 'assistant', content: 'Answer 1' },
        ],
      },
      {
        messages: [
          { role: 'user', content: 'Question 2' },
          { role: 'assistant', content: 'Answer 2' },
        ],
      },
    ];

    const valData = [
      {
        messages: [
          { role: 'user', content: 'Val Question 1' },
          { role: 'assistant', content: 'Val Answer 1' },
        ],
      },
    ];

    await writeFile('data/train.jsonl', trainData.map((d) => JSON.stringify(d)).join('\n') + '\n');
    await writeFile('data/val.jsonl', valData.map((d) => JSON.stringify(d)).join('\n') + '\n');

    // Mock fetch for API calls
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    delete process.env.TOGETHER_API_KEY;
  });

  it('should upload files and create a fine-tune job', async () => {
    let uploadCallCount = 0;
    let createJobCalled = false;

    // Mock fetch to simulate Together.ai API
    globalThis.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      // Mock file upload
      if (urlString.includes('/files/upload')) {
        uploadCallCount++;
        return {
          ok: true,
          json: async () => ({ id: `file-${uploadCallCount}` }),
          text: async () => '',
        } as Response;
      }

      // Mock fine-tune job creation
      if (urlString.includes('/fine-tunes') && options?.method === 'POST') {
        createJobCalled = true;
        const body = JSON.parse(options.body as string);
        expect(body.model).toBe('meta-llama/Llama-3.3-70B-Instruct-Turbo');
        expect(body.training_file).toBe('file-1');
        expect(body.validation_file).toBe('file-2');
        expect(body.n_epochs).toBe(3);
        expect(body.batch_size).toBe(4);
        expect(body.learning_rate).toBe(1e-5);
        expect(body.lora_r).toBe(16);
        expect(body.lora_alpha).toBe(32);

        return {
          ok: true,
          json: async () => ({ id: 'ft-job-123' }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const program = new Command();
    registerTrain(program);
    await program.parseAsync(['node', 'test', 'train']);

    // Verify files were uploaded
    expect(uploadCallCount).toBe(2);

    // Verify job was created
    expect(createJobCalled).toBe(true);

    // Verify job was saved to config
    const configContent = await readFile('.ftpipeline.json', 'utf-8');
    const config = JSON.parse(configContent) as ProjectConfig;

    expect(config.runs).toHaveLength(1);
    expect(config.runs[0].jobId).toBe('ft-job-123');
    expect(config.runs[0].provider).toBe('together');
    expect(config.runs[0].status).toBe('pending');
    expect(config.runs[0].hyperparameters).toEqual({
      epochs: 3,
      batchSize: 4,
      learningRate: 1e-5,
      loraR: 16,
      loraAlpha: 32,
    });
  });

  it('should support custom hyperparameters', async () => {
    let jobConfig: Record<string, unknown> = {};

    globalThis.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/files/upload')) {
        return {
          ok: true,
          json: async () => ({ id: 'file-test' }),
          text: async () => '',
        } as Response;
      }

      if (urlString.includes('/fine-tunes') && options?.method === 'POST') {
        jobConfig = JSON.parse(options.body as string);
        return {
          ok: true,
          json: async () => ({ id: 'ft-job-custom' }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const program = new Command();
    registerTrain(program);
    await program.parseAsync([
      'node',
      'test',
      'train',
      '--epochs',
      '5',
      '--batch-size',
      '8',
      '--learning-rate',
      '2e-5',
      '--lora-r',
      '32',
      '--lora-alpha',
      '64',
    ]);

    expect(jobConfig.n_epochs).toBe(5);
    expect(jobConfig.batch_size).toBe(8);
    expect(jobConfig.learning_rate).toBe(2e-5);
    expect(jobConfig.lora_r).toBe(32);
    expect(jobConfig.lora_alpha).toBe(64);
  });

  it('should work without validation file', async () => {
    // Remove validation file
    await rm('data/val.jsonl');

    let uploadCallCount = 0;
    let jobConfig: Record<string, unknown> = {};

    globalThis.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/files/upload')) {
        uploadCallCount++;
        return {
          ok: true,
          json: async () => ({ id: `file-${uploadCallCount}` }),
          text: async () => '',
        } as Response;
      }

      if (urlString.includes('/fine-tunes') && options?.method === 'POST') {
        jobConfig = JSON.parse(options.body as string);
        return {
          ok: true,
          json: async () => ({ id: 'ft-job-no-val' }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const program = new Command();
    registerTrain(program);
    await program.parseAsync(['node', 'test', 'train']);

    // Should only upload training file
    expect(uploadCallCount).toBe(1);

    // Job config should not have validation_file
    expect(jobConfig.validation_file).toBeUndefined();
  });

  it('should fail if project not initialized', async () => {
    await rm('.ftpipeline.json');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerTrain(program);

    await expect(program.parseAsync(['node', 'test', 'train'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Project not initialized'),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should fail if training file not found', async () => {
    await rm('data/train.jsonl');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerTrain(program);

    await expect(program.parseAsync(['node', 'test', 'train'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Training file not found'),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should fail if API key not set', async () => {
    delete process.env.TOGETHER_API_KEY;

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerTrain(program);

    await expect(program.parseAsync(['node', 'test', 'train'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('TOGETHER_API_KEY environment variable is required'),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle file upload errors gracefully', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/files/upload')) {
        return {
          ok: false,
          text: async () => 'File upload failed: invalid format',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerTrain(program);

    await expect(program.parseAsync(['node', 'test', 'train'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to upload file'));

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle job creation errors gracefully', async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/files/upload')) {
        return {
          ok: true,
          json: async () => ({ id: 'file-test' }),
          text: async () => '',
        } as Response;
      }

      if (urlString.includes('/fine-tunes') && options?.method === 'POST') {
        return {
          ok: false,
          text: async () => 'Job creation failed: insufficient credits',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerTrain(program);

    await expect(program.parseAsync(['node', 'test', 'train'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create fine-tune job'),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
