import { describe, expect, it } from 'vitest';
import * as root from './index.js';
import * as args from './args.js';
import * as commandRunner from './command_runner.js';
import type { FlagOptionConfig, MultiOptionConfig, SingleOptionConfig } from './args.js';

describe('public entry points', () => {
  it('exposes the args API from the root and dedicated args entry point', () => {
    expect(root.ArgParser).toBe(args.ArgParser);
    expect(root.ArgParserException).toBe(args.ArgParserException);
    expect(root.ArgResults).toBe(args.ArgResults);
    expect(root.Option).toBe(args.Option);
    expect(root.OptionType).toEqual({ flag: 'flag', single: 'single', multiple: 'multiple' });
    expect(args).not.toHaveProperty('UsageException');
  });

  it('exposes command runner contracts and UsageException on the subpath', () => {
    expect(commandRunner.Command).toBeDefined();
    expect(commandRunner.CommandRunner).toBeDefined();
    expect(commandRunner.UsageException).toBeDefined();
    expect(root).not.toHaveProperty('CommandRunner');
    expect(root).not.toHaveProperty('UsageException');
  });

  it('preserves usage exception metadata and formatting', () => {
    const error = new commandRunner.UsageException('bad input', 'Usage: tool');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('UsageException');
    expect(error.message).toBe('bad input');
    expect(error.usage).toBe('Usage: tool');
    expect(error.toString()).toBe('bad input\n\nUsage: tool');
  });

  it('preserves parser error metadata and snapshots command paths', () => {
    const commands = ['compile'];
    const error = new args.ArgParserException('unknown option', commands, '--wat', '--wat', 0);
    commands.push('mutated');

    expect(error.name).toBe('ArgParserException');
    expect(error.message).toBe('unknown option');
    expect(error.commands).toEqual(['compile']);
    expect(Object.isFrozen(error.commands)).toBe(true);
    expect(error.argumentName).toBe('--wat');
    expect(error.source).toBe('--wat');
    expect(error.offset).toBe(0);
  });
});

const flag: FlagOptionConfig = { type: 'flag', name: 'verbose', defaultsTo: false };
const single: SingleOptionConfig = { type: 'single', name: 'format', defaultsTo: null };
const multiple: MultiOptionConfig = { type: 'multiple', name: 'include', defaultsTo: ['a'] };
void [flag, single, multiple];
