import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import inquirer from 'inquirer';
import { Command } from 'commander';
import { registerAdd } from './add.js';
import type { ProjectConfig } from '../storage/config.js';

describe('ft add', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'ft-add-test-'));
    originalCwd = process.cwd();
    process.chdir(testDir);

    // Create basic project structure
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      qualityThreshold: 8,
      runs: [],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));
    await mkdir('data', { recursive: true });
    await writeFile('data/examples.jsonl', '');
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should add an example in file mode', async () => {
    // Create input and output files
    await writeFile('input.txt', 'What is the capital of France?');
    await writeFile('output.txt', 'The capital of France is Paris.');

    const program = new Command();
    registerAdd(program);

    await program.parseAsync(['node', 'test', 'add', '-i', 'input.txt', '-o', 'output.txt']);

    // Verify example was appended
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const example = JSON.parse(lines[0]);
    expect(example.id).toBe(1);
    expect(example.messages).toHaveLength(2);
    expect(example.messages[0]).toEqual({
      role: 'user',
      content: 'What is the capital of France?',
    });
    expect(example.messages[1]).toEqual({
      role: 'assistant',
      content: 'The capital of France is Paris.',
    });
    expect(example.rating).toBeNull();
    expect(example.version).toBe(1);
    expect(example.createdAt).toBeDefined();
  });

  it('should add an example in interactive mode', async () => {
    // Mock inquirer prompts
    vi.spyOn(inquirer, 'prompt').mockResolvedValue({
      input: 'What is 2 + 2?',
      output: '2 + 2 equals 4.',
    });

    const program = new Command();
    registerAdd(program);

    await program.parseAsync(['node', 'test', 'add']);

    // Verify example was appended
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const example = JSON.parse(lines[0]);
    expect(example.id).toBe(1);
    expect(example.messages).toHaveLength(2);
    expect(example.messages[0].content).toBe('What is 2 + 2?');
    expect(example.messages[1].content).toBe('2 + 2 equals 4.');
  });

  it('should generate sequential IDs', async () => {
    // Add first example
    await writeFile('input1.txt', 'Question 1');
    await writeFile('output1.txt', 'Answer 1');

    const program1 = new Command();
    registerAdd(program1);
    await program1.parseAsync(['node', 'test', 'add', '-i', 'input1.txt', '-o', 'output1.txt']);

    // Add second example
    await writeFile('input2.txt', 'Question 2');
    await writeFile('output2.txt', 'Answer 2');

    const program2 = new Command();
    registerAdd(program2);
    await program2.parseAsync(['node', 'test', 'add', '-i', 'input2.txt', '-o', 'output2.txt']);

    // Verify IDs are sequential
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    const example1 = JSON.parse(lines[0]);
    const example2 = JSON.parse(lines[1]);
    expect(example1.id).toBe(1);
    expect(example2.id).toBe(2);
  });

  it('should prepend system prompt if configured', async () => {
    // Update config with system prompt
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'together',
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      systemPrompt: 'You are a helpful assistant.',
      qualityThreshold: 8,
      runs: [],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    await writeFile('input.txt', 'Hello');
    await writeFile('output.txt', 'Hi there!');

    const program = new Command();
    registerAdd(program);

    await program.parseAsync(['node', 'test', 'add', '-i', 'input.txt', '-o', 'output.txt']);

    const content = await readFile('data/examples.jsonl', 'utf-8');
    const example = JSON.parse(content.trim());

    expect(example.messages).toHaveLength(3);
    expect(example.messages[0]).toEqual({
      role: 'system',
      content: 'You are a helpful assistant.',
    });
    expect(example.messages[1].role).toBe('user');
    expect(example.messages[2].role).toBe('assistant');
  });

  it('should trim whitespace from input and output', async () => {
    await writeFile('input.txt', '\n\n  What is AI?  \n\n');
    await writeFile('output.txt', '\n  Artificial Intelligence  \n');

    const program = new Command();
    registerAdd(program);

    await program.parseAsync(['node', 'test', 'add', '-i', 'input.txt', '-o', 'output.txt']);

    const content = await readFile('data/examples.jsonl', 'utf-8');
    const example = JSON.parse(content.trim());

    expect(example.messages[0].content).toBe('What is AI?');
    expect(example.messages[1].content).toBe('Artificial Intelligence');
  });

  it('should fail if project is not initialized', async () => {
    // Remove config file
    await rm('.ftpipeline.json');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await writeFile('input.txt', 'test');
    await writeFile('output.txt', 'test');

    const program = new Command();
    registerAdd(program);

    await expect(
      program.parseAsync(['node', 'test', 'add', '-i', 'input.txt', '-o', 'output.txt']),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Project not initialized'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should fail if only --input is provided', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await writeFile('input.txt', 'test');

    const program = new Command();
    registerAdd(program);

    await expect(program.parseAsync(['node', 'test', 'add', '-i', 'input.txt'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Both --input and --output must be provided together'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should fail if only --output is provided', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await writeFile('output.txt', 'test');

    const program = new Command();
    registerAdd(program);

    await expect(program.parseAsync(['node', 'test', 'add', '-o', 'output.txt'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Both --input and --output must be provided together'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should fail if input is empty', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await writeFile('input.txt', '   \n  \n  ');
    await writeFile('output.txt', 'test');

    const program = new Command();
    registerAdd(program);

    await expect(
      program.parseAsync(['node', 'test', 'add', '-i', 'input.txt', '-o', 'output.txt']),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Input content is empty'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should fail if output is empty', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await writeFile('input.txt', 'test');
    await writeFile('output.txt', '   \n  \n  ');

    const program = new Command();
    registerAdd(program);

    await expect(
      program.parseAsync(['node', 'test', 'add', '-i', 'input.txt', '-o', 'output.txt']),
    ).rejects.toThrow('process.exit called');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Output content is empty'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
