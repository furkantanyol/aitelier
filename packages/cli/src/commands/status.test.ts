import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Command } from 'commander';
import { registerStatus } from './status.js';
import type { ProjectConfig } from '../storage/config.js';

describe('ft status', () => {
  let testDir: string;
  let originalCwd: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'ft-status-test-'));
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

  it('should show latest job status by default', async () => {
    // Create config with one job
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
          status: 'pending',
          hyperparameters: {
            epochs: 3,
            batchSize: 4,
            learningRate: 1e-5,
            loraR: 16,
            loraAlpha: 32,
          },
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Mock API response for running job
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/fine-tunes/ft-job-123')) {
        return {
          ok: true,
          json: async () => ({
            id: 'ft-job-123',
            status: 'running',
          }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);
    await program.parseAsync(['node', 'test', 'status']);

    // Verify API was called
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/fine-tunes/ft-job-123'),
      expect.any(Object),
    );

    // Verify output shows the job
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('Latest Training Job');
    expect(logOutput).toContain('ft-job-123');
    expect(logOutput).toContain('running');

    // Verify config was updated with new status
    const configContent = await readFile('.ftpipeline.json', 'utf-8');
    const updatedConfig = JSON.parse(configContent) as ProjectConfig;
    expect(updatedConfig.runs[0].status).toBe('running');

    consoleLogSpy.mockRestore();
  });

  it('should show all jobs with --all flag', async () => {
    // Create config with multiple jobs
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-001',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'completed',
          modelId: 'model-001',
          hyperparameters: {
            epochs: 3,
            batchSize: 4,
            learningRate: 1e-5,
            loraR: 16,
            loraAlpha: 32,
          },
        },
        {
          jobId: 'ft-job-002',
          provider: 'together',
          startedAt: '2025-01-02T00:00:00.000Z',
          status: 'running',
          hyperparameters: {
            epochs: 5,
            batchSize: 8,
            learningRate: 2e-5,
            loraR: 32,
            loraAlpha: 64,
          },
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Mock API responses for both jobs
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/fine-tunes/ft-job-001')) {
        return {
          ok: true,
          json: async () => ({
            id: 'ft-job-001',
            status: 'succeeded',
            fine_tuned_model: 'model-001',
          }),
          text: async () => '',
        } as Response;
      }

      if (urlString.includes('/fine-tunes/ft-job-002')) {
        return {
          ok: true,
          json: async () => ({
            id: 'ft-job-002',
            status: 'running',
          }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);
    await program.parseAsync(['node', 'test', 'status', '--all']);

    // Verify both APIs were called
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    // Verify output shows both jobs
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('All Training Jobs');
    expect(logOutput).toContain('ft-job-001');
    expect(logOutput).toContain('ft-job-002');
    expect(logOutput).toContain('model-001');

    consoleLogSpy.mockRestore();
  });

  it('should update config when job completes', async () => {
    // Create config with pending job
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

    // Mock API response for completed job
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/fine-tunes/ft-job-123')) {
        return {
          ok: true,
          json: async () => ({
            id: 'ft-job-123',
            status: 'succeeded',
            fine_tuned_model: 'model-abc-123',
          }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);
    await program.parseAsync(['node', 'test', 'status']);

    // Verify config was updated with completed status and model ID
    const configContent = await readFile('.ftpipeline.json', 'utf-8');
    const updatedConfig = JSON.parse(configContent) as ProjectConfig;

    expect(updatedConfig.runs[0].status).toBe('completed');
    expect(updatedConfig.runs[0].modelId).toBe('model-abc-123');

    // Verify output shows next steps for completed job
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('completed');
    expect(logOutput).toContain('model-abc-123');
    expect(logOutput).toContain('ft eval');

    consoleLogSpy.mockRestore();
  });

  it('should handle failed jobs', async () => {
    // Create config with running job
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-fail',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'running',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Mock API response for failed job
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/fine-tunes/ft-job-fail')) {
        return {
          ok: true,
          json: async () => ({
            id: 'ft-job-fail',
            status: 'failed',
            error: 'Insufficient training data',
          }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);
    await program.parseAsync(['node', 'test', 'status']);

    // Verify output shows error
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('failed');
    expect(logOutput).toContain('Insufficient training data');

    // Verify config was updated
    const configContent = await readFile('.ftpipeline.json', 'utf-8');
    const updatedConfig = JSON.parse(configContent) as ProjectConfig;
    expect(updatedConfig.runs[0].status).toBe('failed');

    consoleLogSpy.mockRestore();
  });

  it('should handle no jobs scenario', async () => {
    // Create config with no runs
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);
    await program.parseAsync(['node', 'test', 'status']);

    // Verify output shows no jobs message
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('No Training Jobs Found');
    expect(logOutput).toContain('ft train');

    consoleLogSpy.mockRestore();
  });

  it('should fail if project not initialized', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);

    await expect(program.parseAsync(['node', 'test', 'status'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Project not initialized'),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle API errors gracefully', async () => {
    // Create config with one job
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
          status: 'pending',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Mock API error
    globalThis.fetch = vi.fn(async () => {
      return {
        ok: false,
        text: async () => 'Job not found',
      } as Response;
    }) as typeof fetch;

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);

    await expect(program.parseAsync(['node', 'test', 'status'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to get job status'),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle cancelled jobs', async () => {
    // Create config with cancelled job
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qualityThreshold: 8,
      runs: [
        {
          jobId: 'ft-job-cancelled',
          provider: 'together',
          startedAt: '2025-01-01T00:00:00.000Z',
          status: 'running',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    // Mock API response for cancelled job
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/fine-tunes/ft-job-cancelled')) {
        return {
          ok: true,
          json: async () => ({
            id: 'ft-job-cancelled',
            status: 'cancelled',
          }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);
    await program.parseAsync(['node', 'test', 'status']);

    // Verify output shows cancelled status
    const logOutput = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logOutput).toContain('cancelled');

    // Verify config was updated
    const configContent = await readFile('.ftpipeline.json', 'utf-8');
    const updatedConfig = JSON.parse(configContent) as ProjectConfig;
    expect(updatedConfig.runs[0].status).toBe('cancelled');

    consoleLogSpy.mockRestore();
  });

  it('should not update config if status has not changed', async () => {
    // Create config with running job
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

    // Store original modification time
    const originalContent = await readFile('.ftpipeline.json', 'utf-8');

    // Mock API response with same status
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url.toString();

      if (urlString.includes('/fine-tunes/ft-job-123')) {
        return {
          ok: true,
          json: async () => ({
            id: 'ft-job-123',
            status: 'running',
          }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch call: ${urlString}`);
    }) as typeof fetch;

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);
    await program.parseAsync(['node', 'test', 'status']);

    // Verify config content is unchanged
    const newContent = await readFile('.ftpipeline.json', 'utf-8');
    expect(newContent).toBe(originalContent);

    consoleLogSpy.mockRestore();
  });

  it('should fail if API key not set', async () => {
    delete process.env.TOGETHER_API_KEY;

    // Create config with one job
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
          status: 'pending',
        },
      ],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerStatus(program);

    await expect(program.parseAsync(['node', 'test', 'status'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('TOGETHER_API_KEY environment variable is required'),
    );

    mockExit.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
