import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, readFile, mkdtemp, rm, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Command } from 'commander';
import { registerEval } from './eval.js';
import type { ProjectConfig } from '../storage/config.js';
import type { Example } from '../storage/dataset.js';
import inquirer from 'inquirer';

describe('ft eval', () => {
  let testDir: string;
  let originalCwd: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'ft-eval-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Mock TOGETHER_API_KEY
    process.env.TOGETHER_API_KEY = 'test-api-key';

    // Mock fetch
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    delete process.env.TOGETHER_API_KEY;
  });

  it('should evaluate validation examples with completed model', async () => {
    // Create config with completed model
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-123',
          modelId: 'model-abc-123',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'completed',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Create data directory and validation data
    await mkdir('data', { recursive: true });
    const valExamples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'What is 2+2?' },
          { role: 'assistant' as const, content: '2+2 equals 4.' },
        ],
        rating: 9,
        createdAt: '2025-01-01T00:00:00.000Z',
        version: 1,
        split: 'val' as const,
      },
      {
        id: 2,
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'What is the capital of France?' },
          { role: 'assistant' as const, content: 'The capital of France is Paris.' },
        ],
        rating: 10,
        createdAt: '2025-01-01T00:00:00.000Z',
        version: 1,
        split: 'val' as const,
      },
    ];
    await writeFile('data/val.jsonl', valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n');

    // Mock chat completions API
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/chat/completions')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Model response' } }],
          }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    // Mock inquirer prompts
    vi.spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ action: 'score' }) // First example: action
      .mockResolvedValueOnce({ score: '4' }) // First example: score
      .mockResolvedValueOnce({ action: 'score' }) // Second example: action
      .mockResolvedValueOnce({ score: '5' }); // Second example: score

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerEval(program);
    await program.parseAsync(['node', 'test', 'eval']);

    // Verify inference API was called twice
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // Verify output shows evaluation progress
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('Model Evaluation');
    expect(logOutput).toContain('model-abc-123');
    expect(logOutput).toContain('Example 1 of 2');
    expect(logOutput).toContain('Example 2 of 2');
    expect(logOutput).toContain('Evaluation Complete');

    // Verify eval results file was created
    const evalFiles = await readdir('data/evals').catch(() => []);
    expect(evalFiles.length).toBeGreaterThan(0);
    expect(evalFiles[0]).toMatch(/^eval-model-abc-123-\d{4}-\d{2}-\d{2}\.json$/);

    consoleLogSpy.mockRestore();
  });

  it('should handle skip action', async () => {
    // Create config with completed model
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-123',
          modelId: 'model-abc-123',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'completed',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Create data directory and validation data
    await mkdir('data', { recursive: true });
    const valExamples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'What is 2+2?' },
          { role: 'assistant' as const, content: '2+2 equals 4.' },
        ],
        rating: 9,
        createdAt: '2025-01-01T00:00:00.000Z',
        version: 1,
        split: 'val' as const,
      },
    ];
    await writeFile('data/val.jsonl', valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n');

    // Mock chat completions API
    globalThis.fetch = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Model response' } }],
        }),
        text: async () => '',
      } as Response;
    }) as typeof fetch;

    // Mock inquirer to skip
    vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ action: 'skip' });

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerEval(program);
    await program.parseAsync(['node', 'test', 'eval']);

    // Verify output shows no examples evaluated
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('No examples evaluated');

    consoleLogSpy.mockRestore();
  });

  it('should handle quit action', async () => {
    // Create config with completed model
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-123',
          modelId: 'model-abc-123',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'completed',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Create data directory and validation data
    await mkdir('data', { recursive: true });
    const valExamples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'What is 2+2?' },
          { role: 'assistant' as const, content: '2+2 equals 4.' },
        ],
        rating: 9,
        createdAt: '2025-01-01T00:00:00.000Z',
        version: 1,
        split: 'val' as const,
      },
    ];
    await writeFile('data/val.jsonl', valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n');

    // Mock chat completions API
    globalThis.fetch = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Model response' } }],
        }),
        text: async () => '',
      } as Response;
    }) as typeof fetch;

    // Mock inquirer to quit
    vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ action: 'quit' });

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerEval(program);
    await program.parseAsync(['node', 'test', 'eval']);

    // Verify output shows quitting message
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('Quitting');

    consoleLogSpy.mockRestore();
  });

  it('should handle no completed models', async () => {
    // Create config with no completed models
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-123',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'running',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerEval(program);
    await program.parseAsync(['node', 'test', 'eval']);

    // Verify output shows no completed models message
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('No Completed Models Found');

    consoleLogSpy.mockRestore();
  });

  it('should handle no validation data', async () => {
    // Create config with completed model
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-123',
          modelId: 'model-abc-123',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'completed',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerEval(program);
    await program.parseAsync(['node', 'test', 'eval']);

    // Verify output shows no validation data message
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('No Validation Data Found');

    consoleLogSpy.mockRestore();
  });

  it('should handle inference API errors gracefully', async () => {
    // Create config with completed model
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-123',
          modelId: 'model-abc-123',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'completed',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Create data directory and validation data
    await mkdir('data', { recursive: true });
    const valExamples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'What is 2+2?' },
          { role: 'assistant' as const, content: '2+2 equals 4.' },
        ],
        rating: 9,
        createdAt: '2025-01-01T00:00:00.000Z',
        version: 1,
        split: 'val' as const,
      },
    ];
    await writeFile('data/val.jsonl', valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n');

    // Mock API error
    globalThis.fetch = vi.fn(async () => {
      return {
        ok: false,
        text: async () => 'Rate limit exceeded',
      } as Response;
    }) as typeof fetch;

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerEval(program);
    await program.parseAsync(['node', 'test', 'eval']);

    // Verify output shows error and skipped message
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('Error running inference');
    expect(logOutput).toContain('No examples evaluated');

    consoleLogSpy.mockRestore();
  });

  it('should fail if project not initialized', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerEval(program);

    await expect(program.parseAsync(['node', 'test', 'eval'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Project not initialized'),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should fail if API key not set', async () => {
    delete process.env.TOGETHER_API_KEY;

    // Create config with completed model
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-123',
          modelId: 'model-abc-123',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'completed',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Create data directory and validation data
    await mkdir('data', { recursive: true });
    const valExamples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'What is 2+2?' },
          { role: 'assistant' as const, content: '2+2 equals 4.' },
        ],
        rating: 9,
        createdAt: '2025-01-01T00:00:00.000Z',
        version: 1,
        split: 'val' as const,
      },
    ];
    await writeFile('data/val.jsonl', valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerEval(program);

    await expect(program.parseAsync(['node', 'test', 'eval'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('TOGETHER_API_KEY environment variable is required'),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('--compare mode', () => {
    it('should compare base model vs fine-tuned model with blind A/B test', async () => {
      // Create config with completed model
      const config: ProjectConfig = {
        name: 'test-project',
        provider: 'together',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        qualityThreshold: 8,
        runs: [
          {
            jobId: 'ft-job-123',
            modelId: 'model-abc-123',
            provider: 'together',
            startedAt: '2025-01-01T00:00:00.000Z',
            status: 'completed',
          },
        ],
      };
      await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

      // Create data directory and validation data
      await mkdir('data', { recursive: true });
      const valExamples: Example[] = [
        {
          id: 1,
          messages: [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            { role: 'user' as const, content: 'What is 2+2?' },
            { role: 'assistant' as const, content: '2+2 equals 4.' },
          ],
          rating: 9,
          createdAt: '2025-01-01T00:00:00.000Z',
          version: 1,
          split: 'val' as const,
        },
        {
          id: 2,
          messages: [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            { role: 'user' as const, content: 'What is the capital of France?' },
            { role: 'assistant' as const, content: 'The capital of France is Paris.' },
          ],
          rating: 10,
          createdAt: '2025-01-01T00:00:00.000Z',
          version: 1,
          split: 'val' as const,
        },
      ];
      await writeFile(
        'data/val.jsonl',
        valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n',
      );

      // Mock chat completions API to return different responses for base vs fine-tuned
      let callCount = 0;
      globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlString = typeof url === 'string' ? url : url.toString();

        if (urlString.includes('/chat/completions')) {
          callCount++;
          // Alternate between "Base response" and "Fine-tuned response"
          const content = callCount % 2 === 1 ? 'Base response' : 'Fine-tuned response';
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content } }],
            }),
            text: async () => '',
          } as Response;
        }

        throw new Error(`Unexpected fetch call: ${urlString}`);
      }) as typeof fetch;

      // Mock inquirer prompts for comparison
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ action: 'score' }) // First example: action
        .mockResolvedValueOnce({ score: '4' }) // First example: score A
        .mockResolvedValueOnce({ score: '5' }) // First example: score B
        .mockResolvedValueOnce({ action: 'score' }) // Second example: action
        .mockResolvedValueOnce({ score: '3' }) // Second example: score A
        .mockResolvedValueOnce({ score: '4' }); // Second example: score B

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = new Command();
      registerEval(program);
      await program.parseAsync(['node', 'test', 'eval', '--compare']);

      // Verify inference API was called 4 times (2 models x 2 examples)
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);

      // Verify output shows comparison mode
      const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logOutput).toContain('Model Comparison (Blind A/B Test)');
      expect(logOutput).toContain('Base model: meta-llama/Llama-3.3-70B-Instruct-Turbo');
      expect(logOutput).toContain('Fine-tuned model: model-abc-123');
      expect(logOutput).toContain('Model A Output:');
      expect(logOutput).toContain('Model B Output:');
      expect(logOutput).toContain('Comparison Results - The Reveal!');
      expect(logOutput).toContain('Average Scores:');
      expect(logOutput).toContain('Head-to-Head:');

      // Verify comparison results file was created
      const evalFiles = await readdir('data/evals').catch(() => []);
      expect(evalFiles.length).toBeGreaterThan(0);
      expect(evalFiles[0]).toMatch(/^compare-model-abc-123-\d{4}-\d{2}-\d{2}\.json$/);

      // Verify file contents
      const resultFile = await readFile(`data/evals/${evalFiles[0]}`, 'utf-8');
      const results = JSON.parse(resultFile);
      expect(results).toHaveProperty('baseModelId', 'meta-llama/Llama-3.3-70B-Instruct-Turbo');
      expect(results).toHaveProperty('fineTunedModelId', 'model-abc-123');
      expect(results).toHaveProperty('totalExamples', 2);
      expect(results).toHaveProperty('baseModelAvgScore');
      expect(results).toHaveProperty('fineTunedModelAvgScore');
      expect(results).toHaveProperty('baseModelWins');
      expect(results).toHaveProperty('fineTunedModelWins');
      expect(results).toHaveProperty('ties');
      expect(results.results).toHaveLength(2);

      consoleLogSpy.mockRestore();
    });

    it('should handle skip action in compare mode', async () => {
      // Create config with completed model
      const config: ProjectConfig = {
        name: 'test-project',
        provider: 'together',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        qualityThreshold: 8,
        runs: [
          {
            jobId: 'ft-job-123',
            modelId: 'model-abc-123',
            provider: 'together',
            startedAt: '2025-01-01T00:00:00.000Z',
            status: 'completed',
          },
        ],
      };
      await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

      // Create data directory and validation data
      await mkdir('data', { recursive: true });
      const valExamples: Example[] = [
        {
          id: 1,
          messages: [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            { role: 'user' as const, content: 'What is 2+2?' },
            { role: 'assistant' as const, content: '2+2 equals 4.' },
          ],
          rating: 9,
          createdAt: '2025-01-01T00:00:00.000Z',
          version: 1,
          split: 'val' as const,
        },
      ];
      await writeFile(
        'data/val.jsonl',
        valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n',
      );

      // Mock chat completions API
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Response' } }],
          }),
          text: async () => '',
        } as Response;
      }) as typeof fetch;

      // Mock inquirer to skip
      vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ action: 'skip' });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = new Command();
      registerEval(program);
      await program.parseAsync(['node', 'test', 'eval', '--compare']);

      // Verify output shows no examples evaluated
      const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logOutput).toContain('No examples evaluated');

      consoleLogSpy.mockRestore();
    });

    it('should handle quit action in compare mode', async () => {
      // Create config with completed model
      const config: ProjectConfig = {
        name: 'test-project',
        provider: 'together',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        qualityThreshold: 8,
        runs: [
          {
            jobId: 'ft-job-123',
            modelId: 'model-abc-123',
            provider: 'together',
            startedAt: '2025-01-01T00:00:00.000Z',
            status: 'completed',
          },
        ],
      };
      await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

      // Create data directory and validation data
      await mkdir('data', { recursive: true });
      const valExamples: Example[] = [
        {
          id: 1,
          messages: [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            { role: 'user' as const, content: 'What is 2+2?' },
            { role: 'assistant' as const, content: '2+2 equals 4.' },
          ],
          rating: 9,
          createdAt: '2025-01-01T00:00:00.000Z',
          version: 1,
          split: 'val' as const,
        },
      ];
      await writeFile(
        'data/val.jsonl',
        valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n',
      );

      // Mock chat completions API
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Response' } }],
          }),
          text: async () => '',
        } as Response;
      }) as typeof fetch;

      // Mock inquirer to quit
      vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ action: 'quit' });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = new Command();
      registerEval(program);
      await program.parseAsync(['node', 'test', 'eval', '--compare']);

      // Verify output shows quitting message
      const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logOutput).toContain('Quitting comparison');

      consoleLogSpy.mockRestore();
    });

    it('should handle inference errors in compare mode', async () => {
      // Create config with completed model
      const config: ProjectConfig = {
        name: 'test-project',
        provider: 'together',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        qualityThreshold: 8,
        runs: [
          {
            jobId: 'ft-job-123',
            modelId: 'model-abc-123',
            provider: 'together',
            startedAt: '2025-01-01T00:00:00.000Z',
            status: 'completed',
          },
        ],
      };
      await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

      // Create data directory and validation data
      await mkdir('data', { recursive: true });
      const valExamples: Example[] = [
        {
          id: 1,
          messages: [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            { role: 'user' as const, content: 'What is 2+2?' },
            { role: 'assistant' as const, content: '2+2 equals 4.' },
          ],
          rating: 9,
          createdAt: '2025-01-01T00:00:00.000Z',
          version: 1,
          split: 'val' as const,
        },
      ];
      await writeFile(
        'data/val.jsonl',
        valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n',
      );

      // Mock API error
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: false,
          text: async () => 'Rate limit exceeded',
        } as Response;
      }) as typeof fetch;

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = new Command();
      registerEval(program);
      await program.parseAsync(['node', 'test', 'eval', '--compare']);

      // Verify output shows error and skipped message
      const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logOutput).toContain('Error running inference');
      expect(logOutput).toContain('No examples evaluated');

      consoleLogSpy.mockRestore();
    });

    it('should randomize model order (blind test)', async () => {
      // Create config with completed model
      const config: ProjectConfig = {
        name: 'test-project',
        provider: 'together',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        qualityThreshold: 8,
        runs: [
          {
            jobId: 'ft-job-123',
            modelId: 'model-abc-123',
            provider: 'together',
            startedAt: '2025-01-01T00:00:00.000Z',
            status: 'completed',
          },
        ],
      };
      await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

      // Create data directory and validation data
      await mkdir('data', { recursive: true });
      const valExamples: Example[] = [
        {
          id: 1,
          messages: [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            { role: 'user' as const, content: 'What is 2+2?' },
            { role: 'assistant' as const, content: '2+2 equals 4.' },
          ],
          rating: 9,
          createdAt: '2025-01-01T00:00:00.000Z',
          version: 1,
          split: 'val' as const,
        },
      ];
      await writeFile(
        'data/val.jsonl',
        valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n',
      );

      // Mock chat completions API
      let callCount = 0;
      globalThis.fetch = vi.fn(async () => {
        callCount++;
        const content = callCount % 2 === 1 ? 'Base response' : 'Fine-tuned response';
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content } }],
          }),
          text: async () => '',
        } as Response;
      }) as typeof fetch;

      // Mock inquirer prompts
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ action: 'score' })
        .mockResolvedValueOnce({ score: '4' })
        .mockResolvedValueOnce({ score: '5' });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = new Command();
      registerEval(program);
      await program.parseAsync(['node', 'test', 'eval', '--compare']);

      // Verify results file contains randomization info
      const evalFiles = await readdir('data/evals').catch(() => []);
      const resultFile = await readFile(`data/evals/${evalFiles[0]}`, 'utf-8');
      const results = JSON.parse(resultFile);

      // Check that each result has modelAIsBase flag
      expect(results.results[0]).toHaveProperty('modelAIsBase');
      expect(results.results[0]).toHaveProperty('modelAOutput');
      expect(results.results[0]).toHaveProperty('modelBOutput');
      expect(results.results[0]).toHaveProperty('baseOutput');
      expect(results.results[0]).toHaveProperty('fineTunedOutput');

      consoleLogSpy.mockRestore();
    });

    it('should calculate statistics correctly in compare mode', async () => {
      // Create config with completed model
      const config: ProjectConfig = {
        name: 'test-project',
        provider: 'together',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        qualityThreshold: 8,
        runs: [
          {
            jobId: 'ft-job-123',
            modelId: 'model-abc-123',
            provider: 'together',
            startedAt: '2025-01-01T00:00:00.000Z',
            status: 'completed',
          },
        ],
      };
      await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

      // Create data directory and validation data
      await mkdir('data', { recursive: true });
      const valExamples: Example[] = [
        {
          id: 1,
          messages: [
            { role: 'system' as const, content: 'You are a helpful assistant.' },
            { role: 'user' as const, content: 'What is 2+2?' },
            { role: 'assistant' as const, content: '2+2 equals 4.' },
          ],
          rating: 9,
          createdAt: '2025-01-01T00:00:00.000Z',
          version: 1,
          split: 'val' as const,
        },
      ];
      await writeFile(
        'data/val.jsonl',
        valExamples.map((e) => JSON.stringify(e)).join('\n') + '\n',
      );

      // Mock chat completions API
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Response' } }],
          }),
          text: async () => '',
        } as Response;
      }) as typeof fetch;

      // Mock Math.random to force specific assignment (Model A = base)
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.1); // < 0.5, so Model A is base

      // Mock inquirer prompts: score A=3, score B=5
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ action: 'score' })
        .mockResolvedValueOnce({ score: '3' }) // Base model (A) gets 3
        .mockResolvedValueOnce({ score: '5' }); // Fine-tuned model (B) gets 5

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = new Command();
      registerEval(program);
      await program.parseAsync(['node', 'test', 'eval', '--compare']);

      // Verify results
      const evalFiles = await readdir('data/evals').catch(() => []);
      const resultFile = await readFile(`data/evals/${evalFiles[0]}`, 'utf-8');
      const results = JSON.parse(resultFile);

      expect(results.baseModelAvgScore).toBe(3);
      expect(results.fineTunedModelAvgScore).toBe(5);
      expect(results.fineTunedModelWins).toBe(1);
      expect(results.baseModelWins).toBe(0);
      expect(results.ties).toBe(0);

      // Restore Math.random
      Math.random = originalRandom;
      consoleLogSpy.mockRestore();
    });
  });
});
