import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Command } from 'commander';
import { registerFormat } from './format.js';
import type { ProjectConfig } from '../storage/config.js';
import type { Example } from '../storage/dataset.js';

describe('ft format', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'ft-format-test-'));
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

  it('should export train and val examples to separate files', async () => {
    // Create examples with train/val splits
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Question 1' },
          { role: 'assistant' as const, content: 'Answer 1' },
        ],
        rating: 8,
        split: 'train',
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'user' as const, content: 'Question 2' },
          { role: 'assistant' as const, content: 'Answer 2' },
        ],
        rating: 9,
        split: 'val',
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 3,
        messages: [
          { role: 'user' as const, content: 'Question 3' },
          { role: 'assistant' as const, content: 'Answer 3' },
        ],
        rating: 10,
        split: 'train',
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    // Verify train.jsonl was created
    const trainContent = await readFile('data/train.jsonl', 'utf-8');
    const trainExamples = trainContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(trainExamples).toHaveLength(2);
    expect(trainExamples[0].messages).toEqual([
      { role: 'user', content: 'Question 1' },
      { role: 'assistant', content: 'Answer 1' },
    ]);
    expect(trainExamples[1].messages).toEqual([
      { role: 'user', content: 'Question 3' },
      { role: 'assistant', content: 'Answer 3' },
    ]);

    // Verify val.jsonl was created
    const valContent = await readFile('data/val.jsonl', 'utf-8');
    const valExamples = valContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(valExamples).toHaveLength(1);
    expect(valExamples[0].messages).toEqual([
      { role: 'user', content: 'Question 2' },
      { role: 'assistant', content: 'Answer 2' },
    ]);
  });

  it('should filter out examples below quality threshold', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          { role: 'assistant' as const, content: 'A1' },
        ],
        rating: 9, // Above threshold
        split: 'train',
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'user' as const, content: 'Q2' },
          { role: 'assistant' as const, content: 'A2' },
        ],
        rating: 5, // Below threshold
        split: 'train',
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 3,
        messages: [
          { role: 'user' as const, content: 'Q3' },
          { role: 'assistant' as const, content: 'A3' },
        ],
        rating: 8, // At threshold
        split: 'train',
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    // Only examples with rating >= 8 should be exported
    const trainContent = await readFile('data/train.jsonl', 'utf-8');
    const trainExamples = trainContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(trainExamples).toHaveLength(2);
    expect(trainExamples[0].messages[0].content).toBe('Q1');
    expect(trainExamples[1].messages[0].content).toBe('Q3');
  });

  it('should filter out unrated examples', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          { role: 'assistant' as const, content: 'A1' },
        ],
        rating: 9,
        split: 'train',
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'user' as const, content: 'Q2' },
          { role: 'assistant' as const, content: 'A2' },
        ],
        rating: null, // Unrated
        split: 'train',
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    // Only rated example should be exported
    const trainContent = await readFile('data/train.jsonl', 'utf-8');
    const trainExamples = trainContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(trainExamples).toHaveLength(1);
    expect(trainExamples[0].messages[0].content).toBe('Q1');
  });

  it('should filter out examples without split assignment', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          { role: 'assistant' as const, content: 'A1' },
        ],
        rating: 9,
        split: 'train',
        createdAt: new Date().toISOString(),
        version: 1,
      },
      {
        id: 2,
        messages: [
          { role: 'user' as const, content: 'Q2' },
          { role: 'assistant' as const, content: 'A2' },
        ],
        rating: 9, // Rated but no split
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    // Only example with split should be exported
    const trainContent = await readFile('data/train.jsonl', 'utf-8');
    const trainExamples = trainContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(trainExamples).toHaveLength(1);
    expect(trainExamples[0].messages[0].content).toBe('Q1');
  });

  it('should preserve system messages in exported format', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'system' as const, content: 'You are a helpful assistant.' },
          { role: 'user' as const, content: 'Question 1' },
          { role: 'assistant' as const, content: 'Answer 1' },
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

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    const trainContent = await readFile('data/train.jsonl', 'utf-8');
    const trainExamples = trainContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(trainExamples[0].messages).toHaveLength(3);
    expect(trainExamples[0].messages[0]).toEqual({
      role: 'system',
      content: 'You are a helpful assistant.',
    });
  });

  it('should export only messages field (no metadata)', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Question 1' },
          { role: 'assistant' as const, content: 'Answer 1' },
        ],
        rating: 9,
        split: 'train',
        originalOutput: 'Original answer 1',
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    const trainContent = await readFile('data/train.jsonl', 'utf-8');
    const trainExamples = trainContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    // Should only have messages field
    expect(Object.keys(trainExamples[0])).toEqual(['messages']);
    expect(trainExamples[0].id).toBeUndefined();
    expect(trainExamples[0].rating).toBeUndefined();
    expect(trainExamples[0].split).toBeUndefined();
    expect(trainExamples[0].originalOutput).toBeUndefined();
  });

  it('should validate examples have required messages', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [{ role: 'user' as const, content: 'Question without answer' }],
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

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerFormat(program);

    await expect(program.parseAsync(['node', 'test', 'format'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Missing assistant message'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should validate examples have user messages', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [{ role: 'assistant' as const, content: 'Answer without question' }],
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

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerFormat(program);

    await expect(program.parseAsync(['node', 'test', 'format'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing user message'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should validate message structure', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          // @ts-expect-error: Testing invalid role
          { role: 'invalid', content: 'A1' },
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

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const program = new Command();
    registerFormat(program);

    await expect(program.parseAsync(['node', 'test', 'format'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid message role'));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should display message when no examples exist', async () => {
    await writeFile('data/examples.jsonl', '');

    const consoleLogSpy = vi.spyOn(console, 'log');

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'No examples found. Add examples with `ft add` first.',
    );
  });

  it('should display message when no rated examples exist', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          { role: 'assistant' as const, content: 'A1' },
        ],
        rating: null,
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
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'No rated examples found. Rate examples with `ft rate` first.',
    );
  });

  it('should display message when no examples have splits', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          { role: 'assistant' as const, content: 'A1' },
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

    const consoleLogSpy = vi.spyOn(console, 'log');

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Found 1 qualified examples but none have train/val splits assigned.',
    );
    expect(consoleLogSpy).toHaveBeenCalledWith('Run `ft split` first to assign train/val splits.');
  });

  it('should display message when all examples below threshold', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          { role: 'assistant' as const, content: 'A1' },
        ],
        rating: 5,
        split: 'train',
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
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

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
    registerFormat(program);

    await expect(program.parseAsync(['node', 'test', 'format'])).rejects.toThrow(
      'process.exit called',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Project not initialized'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should work with openai provider', async () => {
    // Update config to use OpenAI
    const config: ProjectConfig = {
      name: 'test-project',
      provider: 'openai',
      model: 'gpt-4o-mini-2024-07-18',
      qualityThreshold: 8,
      runs: [],
    };
    await writeFile('.ftpipeline.json', JSON.stringify(config, null, 2));

    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          { role: 'assistant' as const, content: 'A1' },
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

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    // Verify format is the same (both providers use standard chat format)
    const trainContent = await readFile('data/train.jsonl', 'utf-8');
    const trainExamples = trainContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(trainExamples).toHaveLength(1);
    expect(trainExamples[0].messages).toEqual([
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
    ]);
  });

  it('should handle multi-turn conversations', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'First question' },
          { role: 'assistant' as const, content: 'First answer' },
          { role: 'user' as const, content: 'Follow-up question' },
          { role: 'assistant' as const, content: 'Follow-up answer' },
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

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    const trainContent = await readFile('data/train.jsonl', 'utf-8');
    const trainExamples = trainContent
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));

    expect(trainExamples[0].messages).toHaveLength(4);
    expect(trainExamples[0].messages[2].content).toBe('Follow-up question');
    expect(trainExamples[0].messages[3].content).toBe('Follow-up answer');
  });

  it('should only create train file when no val examples', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          { role: 'assistant' as const, content: 'A1' },
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

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    // Train file should exist
    const trainContent = await readFile('data/train.jsonl', 'utf-8');
    expect(trainContent.trim().split('\n')).toHaveLength(1);

    // Val file should not exist
    let valExists = true;
    try {
      await readFile('data/val.jsonl', 'utf-8');
    } catch {
      valExists = false;
    }
    expect(valExists).toBe(false);
  });

  it('should only create val file when no train examples', async () => {
    const examples: Example[] = [
      {
        id: 1,
        messages: [
          { role: 'user' as const, content: 'Q1' },
          { role: 'assistant' as const, content: 'A1' },
        ],
        rating: 9,
        split: 'val',
        createdAt: new Date().toISOString(),
        version: 1,
      },
    ];

    await writeFile(
      'data/examples.jsonl',
      examples.map((e) => JSON.stringify(e)).join('\n') + '\n',
    );

    const program = new Command();
    registerFormat(program);
    await program.parseAsync(['node', 'test', 'format']);

    // Val file should exist
    const valContent = await readFile('data/val.jsonl', 'utf-8');
    expect(valContent.trim().split('\n')).toHaveLength(1);

    // Train file should not exist
    let trainExists = true;
    try {
      await readFile('data/train.jsonl', 'utf-8');
    } catch {
      trainExists = false;
    }
    expect(trainExists).toBe(false);
  });
});
