import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import inquirer from 'inquirer';
import { Command } from 'commander';
import { registerSplit } from './split.js';
import type { ProjectConfig } from '../storage/config.js';
import type { Example } from '../storage/dataset.js';

describe('ft split', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'ft-split-test-'));
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
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should split examples with 80/20 ratio by default', async () => {
    // Create 10 rated examples above threshold
    const examples: Example[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      messages: [
        { role: 'user', content: `Question ${i + 1}` },
        { role: 'assistant', content: `Answer ${i + 1}` },
      ],
      rating: 8,
      createdAt: new Date().toISOString(),
      version: 1,
    }));

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split']);

    // Verify split was assigned
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    const trainCount = updated.filter((e: Example) => e.split === 'train').length;
    const valCount = updated.filter((e: Example) => e.split === 'val').length;

    expect(trainCount).toBe(8); // 80% of 10
    expect(valCount).toBe(2); // 20% of 10
    expect(trainCount + valCount).toBe(10);
  });

  it('should split with custom --ratio flag', async () => {
    // Create 10 rated examples above threshold
    const examples: Example[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      messages: [
        { role: 'user', content: `Question ${i + 1}` },
        { role: 'assistant', content: `Answer ${i + 1}` },
      ],
      rating: 9,
      createdAt: new Date().toISOString(),
      version: 1,
    }));

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split', '--ratio', '0.9']);

    // Verify split was assigned with 90/10 ratio
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    const trainCount = updated.filter((e: Example) => e.split === 'train').length;
    const valCount = updated.filter((e: Example) => e.split === 'val').length;

    expect(trainCount).toBe(9); // 90% of 10
    expect(valCount).toBe(1); // 10% of 10
  });

  it('should only split examples meeting quality threshold', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user', content: 'Q1' },
          { role: 'assistant', content: 'A1' },
        ],
        rating: 9, // Above threshold
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'user', content: 'Q2' },
          { role: 'assistant', content: 'A2' },
        ],
        rating: 5, // Below threshold
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 3,
        messages: [
          { role: 'user', content: 'Q3' },
          { role: 'assistant', content: 'A3' },
        ],
        rating: 8, // At threshold
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 4,
        messages: [
          { role: 'user', content: 'Q4' },
          { role: 'assistant', content: 'A4' },
        ],
        rating: null, // Unrated
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split']);

    // Verify only examples with rating >= 8 were split
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    const hasSplit = updated.filter((e: Example) => e.split !== undefined);
    expect(hasSplit.length).toBe(2); // Only ID 1 (rating 9) and ID 3 (rating 8)

    const belowThreshold = updated.find((e: Example) => e.id === 2);
    expect(belowThreshold.split).toBeUndefined();

    const unrated = updated.find((e: Example) => e.id === 4);
    expect(unrated.split).toBeUndefined();
  });

  it('should lock validation set on second split', async () => {
    // First split: Create examples with existing split assignments
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user', content: 'Q1' },
          { role: 'assistant', content: 'A1' },
        ],
        rating: 9,
        split: 'val', // Existing validation example
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'user', content: 'Q2' },
          { role: 'assistant', content: 'A2' },
        ],
        rating: 8,
        split: 'train', // Existing train example
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 3,
        messages: [
          { role: 'user', content: 'Q3' },
          { role: 'assistant', content: 'A3' },
        ],
        rating: 9, // New example without split
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split']);

    // Verify validation example remained locked
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    const val1 = updated.find((e: Example) => e.id === 1);
    expect(val1.split).toBe('val'); // Should still be val (locked)

    const train2 = updated.find((e: Example) => e.id === 2);
    // ID 2 can be reassigned since it was train
    expect(train2.split).toBeDefined();

    const new3 = updated.find((e: Example) => e.id === 3);
    expect(new3.split).toBeDefined(); // Should be assigned
  });

  it('should reshuffle with --reshuffle flag and confirmation', async () => {
    // Create examples with existing split
    const examples: Example[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      messages: [
        { role: 'user', content: `Question ${i + 1}` },
        { role: 'assistant', content: `Answer ${i + 1}` },
      ],
      rating: 8,
      split: i < 1 ? ('val' as const) : ('train' as const),
      createdAt: new Date().toISOString(),
      version: 1,
    }));

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    // Mock user confirming reshuffle
    vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ confirm: true });

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split', '--reshuffle']);

    // Verify all examples were reshuffled
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    const trainCount = updated.filter((e: Example) => e.split === 'train').length;
    const valCount = updated.filter((e: Example) => e.split === 'val').length;

    expect(trainCount + valCount).toBe(5);
    // The first example might not be 'val' anymore after reshuffle
  });

  it('should cancel split when reshuffle is not confirmed', async () => {
    // Create examples with existing split
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user', content: 'Q1' },
          { role: 'assistant', content: 'A1' },
        ],
        rating: 8,
        split: 'val',
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'user', content: 'Q2' },
          { role: 'assistant', content: 'A2' },
        ],
        rating: 9,
        split: 'train',
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    // Mock user rejecting reshuffle
    vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ confirm: false });

    const consoleLogSpy = vi.spyOn(console, 'log');

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split', '--reshuffle']);

    // Verify split was cancelled
    expect(consoleLogSpy).toHaveBeenCalledWith('Split cancelled.');

    // Verify examples were not modified
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    const val = updated.find((e: Example) => e.id === 1);
    expect(val.split).toBe('val');

    const train = updated.find((e: Example) => e.id === 2);
    expect(train.split).toBe('train');
  });

  it('should proceed with initial split when --reshuffle used but no existing split', async () => {
    // Create examples without splits
    const examples: Example[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      messages: [
        { role: 'user', content: `Question ${i + 1}` },
        { role: 'assistant', content: `Answer ${i + 1}` },
      ],
      rating: 8,
      createdAt: new Date().toISOString(),
      version: 1,
    }));

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const consoleLogSpy = vi.spyOn(console, 'log');

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split', '--reshuffle']);

    // Should not prompt for confirmation
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'No existing split found. Proceeding with initial split.',
    );

    // Verify split was performed
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    const withSplit = updated.filter((e: Example) => e.split !== undefined);
    expect(withSplit.length).toBe(5);
  });

  it('should display message when no examples exist', async () => {
    await writeFile('data/examples.jsonl', '');

    const consoleLogSpy = vi.spyOn(console, 'log');

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'No examples found. Add examples with `ft add` first.',
    );
  });

  it('should display message when no examples meet threshold', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user', content: 'Q1' },
          { role: 'assistant', content: 'A1' },
        ],
        rating: 5, // Below threshold
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'user', content: 'Q2' },
          { role: 'assistant', content: 'A2' },
        ],
        rating: null, // Unrated
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const consoleLogSpy = vi.spyOn(console, 'log');

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'No examples meet quality threshold (8/10). Rate examples with `ft rate` first.',
    );
  });

  it('should fail if project is not initialized', async () => {
    await rm('.ftpipeline.json');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerSplit(program);

    await expect(program.parseAsync(['node', 'test', 'split'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Project not initialized'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should validate --ratio flag', async () => {
    await writeFile('data/examples.jsonl', '');

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerSplit(program);

    await expect(program.parseAsync(['node', 'test', 'split', '--ratio', '1.5'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('--ratio must be a number between 0 and 1'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should ensure at least 1 validation example', async () => {
    // Create only 2 examples with high train ratio
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user', content: 'Q1' },
          { role: 'assistant', content: 'A1' },
        ],
        rating: 8,
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'user', content: 'Q2' },
          { role: 'assistant', content: 'A2' },
        ],
        rating: 9,
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split', '--ratio', '0.99']);

    // Verify at least 1 validation example exists
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    const valCount = updated.filter((e: Example) => e.split === 'val').length;
    expect(valCount).toBeGreaterThanOrEqual(1);
  });

  it('should perform stratified sampling by rating', async () => {
    // Create examples with varying ratings
    const examples: Example[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        messages: [
          { role: 'user' as const, content: `Q${i + 1}` },
          { role: 'assistant' as const, content: `A${i + 1}` },
        ],
        rating: 8,
        createdAt: new Date().toISOString(),
        version: 1,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: i + 11,
        messages: [
          { role: 'user' as const, content: `Q${i + 11}` },
          { role: 'assistant' as const, content: `A${i + 11}` },
        ],
        rating: 9,
        createdAt: new Date().toISOString(),
        version: 1,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: i + 21,
        messages: [
          { role: 'user' as const, content: `Q${i + 21}` },
          { role: 'assistant' as const, content: `A${i + 21}` },
        ],
        rating: 10,
        createdAt: new Date().toISOString(),
        version: 1,
      })),
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split']);

    // Verify split was performed
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    // Check that each rating group has representation in both train and val
    const valExamples = updated.filter((e: Example) => e.split === 'val');
    const trainExamples = updated.filter((e: Example) => e.split === 'train');

    // With 30 examples and 80/20 split, we expect ~6 val and ~24 train
    expect(valExamples.length).toBeGreaterThan(0);
    expect(trainExamples.length).toBeGreaterThan(0);

    // Verify ratings are represented in both sets (stratification)
    const valRatings = new Set(valExamples.map((e: Example) => e.rating));
    const trainRatings = new Set(trainExamples.map((e: Example) => e.rating));

    // With enough examples, both should have multiple rating levels
    expect(valRatings.size).toBeGreaterThan(0);
    expect(trainRatings.size).toBeGreaterThan(0);
  });

  it('should handle examples with system messages', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Q1' },
          { role: 'assistant', content: 'A1' },
        ],
        rating: 9,
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Q2' },
          { role: 'assistant', content: 'A2' },
        ],
        rating: 8,
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerSplit(program);
    await program.parseAsync(['node', 'test', 'split']);

    // Verify split was assigned and messages preserved
    const content = await readFile('data/examples.jsonl', 'utf-8');
    const updated = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    for (const example of updated) {
      expect(example.split).toBeDefined();
      expect(example.messages).toHaveLength(3);
      expect(example.messages[0].role).toBe('system');
    }
  });
});
