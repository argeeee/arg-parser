import { describe, expect, it } from 'vitest';
import { Command, CommandRunner, UsageException } from './command_runner.js';

class EchoCommand extends Command<string> {
  readonly name = 'echo';
  readonly description = 'Echo input.';
  readonly aliases = ['say'];
  override readonly takesArguments = true;
  override run(): string { return this.argResults?.rest.join(' ') ?? ''; }
}

class ValueCommand extends Command<number> {
  readonly name = 'value';
  readonly description = 'Return a value.';
  override readonly takesArguments = false;
  override run(): number { return 42; }
}

class AsyncCommand extends Command<string> {
  readonly name = 'async';
  readonly description = 'Return asynchronously.';
  override readonly takesArguments = false;
  override async run(): Promise<string> { return 'async result'; }
}

class SuggestedCommand extends Command<void> {
  readonly name = 'install';
  readonly description = 'Install a package.';
  override readonly aliases = ['add'];
  override readonly suggestionAliases = ['setup'];
  override readonly takesArguments = false;
  override run(): void {}
}

class DuplicateNamesCommand extends Command<void> {
  readonly name = 'duplicate';
  readonly description = 'A command with duplicate aliases.';
  override readonly aliases = ['duplicate', 'same', 'same'];
  override run(): void {}
}

class EmptyParentCommand extends Command<void> {
  readonly name = 'parent';
  readonly description = 'A parent command.';
  override run(): void {}
}

class FooterRunner extends CommandRunner<void> {
  override get usageFooter(): string { return 'See the docs.'; }
}

class BranchCommand extends Command<string> {
  readonly name = 'branch';
  readonly description = 'Branch command.';
  constructor() {
    super();
    this.addSubcommand(new EchoCommand());
  }
  override run(): string { return 'branch'; }
}

describe('CommandRunner', () => {
  it('renders the Dart-style runner usage layout', () => {
    const runner = new CommandRunner<void>('test', 'A test command runner.');
    expect(runner.usage).toBe(`A test command runner.

Usage: test <command> [arguments]

Global options:
-h, --help    Print this usage information.

Available commands:
  help   Display help information for test.

Run "test help <command>" for more information about a command.`);
  });

  it('dispatches synchronous and asynchronous commands and keeps typed return values', async () => {
    const runner = new CommandRunner<number | string>('tool', 'A tool.');
    runner.addCommand(new ValueCommand());
    expect(await runner.run(['value'])).toBe(42);

    const echo = new EchoCommand();
    runner.addCommand(echo);
    expect(await runner.run(['say', 'hello', 'world'])).toBe('hello world');
    expect(echo.argResults?.rest).toEqual(['hello', 'world']);
    expect(echo.globalResults?.name).toBeNull();

    runner.addCommand(new AsyncCommand());
    expect(await runner.run(['async'])).toBe('async result');
  });

  it('dispatches nested commands and reports their parsed results', async () => {
    const runner = new CommandRunner<string>('tool', 'A tool.');
    const branch = new BranchCommand();
    runner.addCommand(branch);
    const echo = branch.subcommands.get('echo')!;
    expect(await runner.run(['branch', 'echo', 'inside'])).toBe('inside');
    expect(echo.argResults?.rest).toEqual(['inside']);
    expect(echo.globalResults?.command?.name).toBe('branch');
  });

  it('supports defaults and command-line help at runner and command levels', async () => {
    const output: string[] = [];
    const runner = new CommandRunner<number>('tool', 'A tool.', { output: (text) => output.push(text) });
    runner.addCommand(new ValueCommand(), { isDefault: true });
    expect(runner.invocation).toBe('tool [<command>] [arguments]');
    expect(await runner.run([])).toBe(42);
    expect(await runner.run(['--help', 'value'])).toBeNull();
    expect(output.at(-1)).toContain('Usage: tool value');
    await runner.run(['help']);
    expect(output.at(-1)).toContain('Available commands:');
    expect(output.at(-1)).toContain('(default) Return a value.');
  });

  it('renders nested help and routes nested parse errors to command usage', async () => {
    const output: string[] = [];
    const runner = new CommandRunner<string>('tool', 'A tool.', { output: (text) => output.push(text) });
    const branch = new BranchCommand();
    runner.addCommand(branch);
    await runner.run(['help', 'branch', 'echo']);
    expect(output.at(-1)).toContain('Usage: tool branch echo');

    try {
      runner.parse(['branch', '--unknown']);
      throw new Error('expected parse failure');
    } catch (error) {
      expect(error).toBeInstanceOf(UsageException);
      expect((error as UsageException).usage).toContain('Usage: tool branch <subcommand> [arguments]');
    }
  });

  it('prints usage with no command and rejects unexpected leaf arguments', async () => {
    const output: string[] = [];
    const runner = new CommandRunner<number>('tool', 'A tool.', { output: (text) => output.push(text) });
    runner.addCommand(new ValueCommand());
    expect(await runner.run([])).toBeNull();
    expect(output[0]).toContain('Global options:');
    await expect(runner.run(['value', 'unexpected'])).rejects.toBeInstanceOf(UsageException);
  });

  it('includes the optional runner footer in usage and usage exceptions', () => {
    const runner = new FooterRunner('tool', 'A tool.');
    expect(runner.usage).toContain('See the docs.');
    try {
      runner.usageException('bad input');
    } catch (error) {
      expect(error).toBeInstanceOf(UsageException);
      expect((error as UsageException).usage).toContain('See the docs.');
      return;
    }
    throw new Error('expected a usage exception');
  });

  it('reports missing and invalid subcommands with the parent command usage', async () => {
    const runner = new CommandRunner<string>('tool', 'A tool.');
    runner.addCommand(new BranchCommand());
    await expect(runner.run(['branch'])).rejects.toMatchObject({
      message: 'Missing subcommand for "tool branch".',
    });
    await expect(runner.run(['help', 'branch', 'missing'])).rejects.toMatchObject({
      message: 'Could not find a subcommand named "missing" for "tool branch".',
    });
  });

  it('routes parser errors to usage exceptions and suggests similar commands', async () => {
    const runner = new CommandRunner<void>('tool', 'A tool.');
    runner.addCommand(new SuggestedCommand());
    expect(() => runner.parse(['--unknown'])).toThrow(UsageException);
    await expect(runner.runCommand(runner.parse(['instal'])))
      .rejects.toThrow(/Did you mean one of these\?[\s\S]*install/);
    await expect(runner.runCommand(runner.parse(['setu'])))
      .rejects.toThrow(/Did you mean one of these\?[\s\S]*install/);
  });

  it('rejects branch defaults and duplicate commands', () => {
    const runner = new CommandRunner<void>('tool', 'A tool.');
    const branch = new BranchCommand();
    expect(() => runner.addCommand(branch, { isDefault: true })).toThrow(/leaf command/);
    runner.addCommand(new EchoCommand());
    expect(() => runner.addCommand(new EchoCommand())).toThrow(/Duplicate command/);
  });

  it('rejects duplicate aliases before mutating runner registration state', () => {
    const runner = new CommandRunner<void>('tool', 'A tool.');
    const command = new DuplicateNamesCommand();
    const commandsBefore = [...runner.commands];
    const parserCommandsBefore = [...runner.argParser.commands];

    expect(() => runner.addCommand(command)).toThrow(/Duplicate command "duplicate"/);
    expect([...runner.commands]).toEqual(commandsBefore);
    expect([...runner.argParser.commands]).toEqual(parserCommandsBefore);
    expect(command.runner).toBeUndefined();
  });

  it('rejects duplicate aliases before mutating nested command registration state', () => {
    const parent = new EmptyParentCommand();
    const command = new DuplicateNamesCommand();
    const subcommandsBefore = [...parent.subcommands];
    const parserCommandsBefore = [...parent.argParser.commands];

    expect(() => parent.addSubcommand(command)).toThrow(/Duplicate command "duplicate"/);
    expect([...parent.subcommands]).toEqual(subcommandsBefore);
    expect([...parent.argParser.commands]).toEqual(parserCommandsBefore);
    expect(command.parent).toBeUndefined();
  });
});
