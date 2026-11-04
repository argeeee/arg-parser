import { ArgParser, type ArgResults } from './contracts.js';
import type { CommandRunnerOptions } from './contracts.js';
import { ArgParserException, UsageException } from './errors.js';
import { ReadonlyMapView } from './readonly_map.js';
import { generateCommandUsage } from './command_usage.js';
import { wrapText } from './utils.js';
import { Command } from './command.js';
import { HelpCommand } from './help_command.js';

/** Dispatches command line arguments to a tree of subclassable commands. */
export class CommandRunner<TResult = unknown> {
  private readonly defaultParser: ArgParser;
  private readonly commandDefinitions = new Map<string, Command<TResult>>();
  private readonly commandView = new ReadonlyMapView(this.commandDefinitions);
  private readonly output: (text: string) => void;
  readonly suggestionDistanceLimit: number;

  constructor(
    readonly executableName: string,
    readonly description: string,
    options: CommandRunnerOptions = {},
  ) {
    this.defaultParser = new ArgParser(options.usageLineLength === undefined ? {} : { usageLineLength: options.usageLineLength });
    this.output = options.output ?? ((text) => console.log(text));
    this.suggestionDistanceLimit = options.suggestionDistanceLimit ?? 2;
    this.defaultParser.addFlag('help', { abbr: 'h', negatable: false, help: 'Print this usage information.' });
    this.addCommand(new HelpCommand<TResult>());
  }

  get invocation(): string {
    const command = this.argParser.defaultCommand === undefined ? '<command>' : '[<command>]';
    return `${this.executableName} ${command} [arguments]`;
  }
  get argParser(): ArgParser { return this.defaultParser; }
  get commands(): ReadonlyMap<string, Command<TResult>> { return this.commandView; }
  get usageFooter(): string | undefined { return undefined; }
  get usage(): string { return `${this.wrap(`${this.description}\n\n`)}${this.usageWithoutDescription}`; }

  private get usageWithoutDescription(): string {
    const prefix = 'Usage:';
    let result = `${prefix} ${this.wrap(this.invocation, prefix.length)}\n\nGlobal options:\n${this.argParser.usage}\n\n`;
    result += `${generateCommandUsage(this.commandDefinitions, {
      ...(this.argParser.usageLineLength === undefined ? {} : { lineLength: this.argParser.usageLineLength }),
      ...(this.argParser.defaultCommand === undefined ? {} : { defaultCommand: this.argParser.defaultCommand }),
    })}\n\n`;
    result += this.wrap(`Run "${this.executableName} help <command>" for more information about a command.`);
    if (this.usageFooter !== undefined) result += `\n${this.wrap(this.usageFooter)}`;
    return result;
  }

  printUsage(): void { this.output(this.usage); }

  /** @internal */
  printCommandUsage(text: string): void { this.output(text); }

  usageException(message: string): never { throw new UsageException(message, this.usageWithoutDescription); }

  addCommand(command: Command<TResult>, options: { readonly isDefault?: boolean } = {}): void {
    const names = [command.name, ...command.aliases];
    if (options.isDefault && command.subcommands.size > 0) throw new TypeError('default command must be a leaf command');
    if (options.isDefault && this.argParser.defaultCommand !== undefined) throw new Error('default command already defined');
    if (names.some((name) => this.commandDefinitions.has(name) || this.argParser.commands.has(name))) {
      throw new TypeError(`Duplicate command "${command.name}".`);
    }
    command.ensureHelpOptionForRunner();
    for (const name of names) {
      this.argParser.addCommand(name, command.argParser);
      this.commandDefinitions.set(name, command);
    }
    if (options.isDefault) this.argParser.defaultCommand = command.name;
    command.attachRunner(this);
  }

  parse(arguments_: Iterable<string>): ArgResults {
    try {
      return this.argParser.parse(arguments_);
    } catch (error) {
      if (!(error instanceof ArgParserException)) throw error;
      if (error.commands.length === 0) this.usageException(error.message);
      let command = this.commandDefinitions.get(error.commands[0]!);
      for (const name of error.commands.slice(1)) command = command?.subcommands.get(name);
      if (command === undefined) this.usageException(error.message);
      command.usageException(error.message);
    }
    throw new Error('Unreachable parser error handling state.');
  }

  async run(arguments_: Iterable<string>): Promise<TResult | null> {
    return this.runCommand(this.parse(arguments_));
  }

  async runCommand(topLevelResults: ArgResults): Promise<TResult | null> {
    let results = topLevelResults;
    let command: Command<TResult> | undefined;
    let commands: ReadonlyMap<string, Command<TResult>> = this.commandDefinitions;
    let commandPath = this.executableName;

    while (commands.size > 0) {
      if (results.command === undefined) {
        if (results.rest.length === 0) {
          if (command === undefined) {
            this.printUsage();
            return null;
          }
          command.usageException(`Missing subcommand for "${commandPath}".`);
        }
        const requested = results.rest[0]!;
        const similar = this.similarCommandsText(requested, commands.values());
        if (command === undefined) this.usageException(`Could not find a command named "${requested}".${similar}`);
        command.usageException(`Could not find a subcommand named "${requested}" for "${commandPath}".${similar}`);
      }

      results = results.command!;
      command = commands.get(results.name ?? '') ?? command;
      if (command === undefined) this.usageException(`Could not find a command named "${results.name}".`);
      command.setResults(topLevelResults, results);
      commands = command.subcommands;
      commandPath += ` ${results.name}`;

      if (results.options && [...results.options].includes('help') && results.flag('help')) {
        command.printUsage();
        return null;
      }
    }

    if (topLevelResults.flag('help')) {
      command!.printUsage();
      return null;
    }
    if (!command!.takesArguments && results.rest.length > 0) {
      command!.usageException(`Command "${results.name}" does not take any arguments.`);
    }
    return await command!.run();
  }

  private wrap(text: string, hangingIndent = 0): string {
    const length = this.argParser.usageLineLength;
    return wrapText(text, { ...(length === undefined ? {} : { length }), hangingIndent });
  }

  private similarCommandsText(name: string, candidates: Iterable<Command<TResult>>): string {
    if (this.suggestionDistanceLimit <= 0) return '';
    const distances = new Map<Command<TResult>, number>();
    for (const command of candidates) {
      if (command.hidden) continue;
      for (const alias of [command.name, ...command.aliases, ...command.suggestionAliases]) {
        const distance = editDistance(name, alias);
        if (distance <= this.suggestionDistanceLimit) {
          distances.set(command, Math.min(distances.get(command) ?? distance, distance));
        }
      }
    }
    const similar = [...distances].sort((a, b) => a[1] - b[1]);
    if (similar.length === 0) return '';
    return `\n\nDid you mean one of these?\n${similar.map(([command]) => `  ${command.name}\n`).join('')}`;
  }
}

function editDistance(from: string, to: string): number {
  const rows = Array.from({ length: from.length + 1 }, () => new Array<number>(to.length + 1).fill(0));
  for (let i = 0; i <= from.length; i++) rows[i]![0] = i;
  for (let j = 0; j <= to.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= from.length; i++) {
    for (let j = 1; j <= to.length; j++) {
      rows[i]![j] = Math.min(
        rows[i - 1]![j]! + 1,
        rows[i]![j - 1]! + 1,
        rows[i - 1]![j - 1]! + (from[i - 1] === to[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && from[i - 1] === to[j - 2] && from[i - 2] === to[j - 1]) {
        rows[i]![j] = Math.min(rows[i]![j]!, rows[i - 2]![j - 2]! + 1);
      }
    }
  }
  return rows[from.length]![to.length]!;
}
