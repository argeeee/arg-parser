import { ArgParser, type ArgResults } from './contracts.js';
import { ReadonlyMapView } from './readonly_map.js';
import { UsageException } from './errors.js';
import { wrapText } from './utils.js';
import { generateCommandUsage } from './command_usage.js';
import type { CommandRunner } from './command_runner_impl.js';
import { commandNames } from './command_names.js';

/** A subclassable command. Override `name`, `description`, and `run`. */
export abstract class Command<TResult = unknown> {
  abstract readonly name: string;
  abstract readonly description: string;

  get summary(): string { return this.description.split('\n')[0] ?? ''; }
  get category(): string { return ''; }
  get invocation(): string {
    const parents: string[] = [this.name];
    for (let command = this.parent; command !== undefined; command = command.parent) parents.push(command.name);
    if (this.runner === undefined) throw new Error('Command is not attached to a runner.');
    parents.push(this.runner.executableName);
    const path = parents.reverse().join(' ');
    if (this.argParser.defaultCommand !== undefined) return `${path} [<subcommand>] [arguments]`;
    return this._subcommands.size > 0 ? `${path} <subcommand> [arguments]` : `${path} [arguments]`;
  }

  private parentCommand: Command<TResult> | undefined;
  private rootRunner: CommandRunner<TResult> | undefined;
  private globalResultValue: ArgResults | undefined;
  private argumentResultValue: ArgResults | undefined;
  private readonly defaultParser = new ArgParser();
  private helpParser: ArgParser | undefined;
  private readonly _subcommands = new Map<string, Command<TResult>>();
  private readonly subcommandView = new ReadonlyMapView(this._subcommands);

  constructor() {
    // Match Dart's base-constructor behavior so help appears first in usage.
    this.defaultParser.addFlag('help', {
      abbr: 'h',
      negatable: false,
      help: 'Print this usage information.',
    });
    this.helpParser = this.defaultParser;
  }

  get parent(): Command<TResult> | undefined { return this.parentCommand; }
  get runner(): CommandRunner<TResult> | undefined { return this.parent?.runner ?? this.rootRunner; }
  get globalResults(): ArgResults | undefined { return this.globalResultValue; }
  get argResults(): ArgResults | undefined { return this.argumentResultValue; }
  get argParser(): ArgParser { return this.defaultParser; }

  get usage(): string { return `${this.wrap(`${this.description}\n\n`)}${this.usageWithoutDescription}`; }
  get usageFooter(): string | undefined { return undefined; }
  get subcommands(): ReadonlyMap<string, Command<TResult>> { return this.subcommandView; }
  get hidden(): boolean {
    return this._subcommands.size > 0 && [...this._subcommands.values()].every((command) => command.hidden);
  }
  get takesArguments(): boolean { return true; }
  get aliases(): readonly string[] { return []; }
  get suggestionAliases(): readonly string[] { return []; }

  protected ensureHelpOption(): void {
    const parser = this.argParser;
    if (parser === this.helpParser) return;
    this.helpParser = parser;
    if (!parser.allowsAnything && parser.findByNameOrAlias('help') === undefined) {
      parser.addFlag('help', { abbr: 'h', negatable: false, help: 'Print this usage information.' });
    }
  }

  /** @internal */
  ensureHelpOptionForRunner(): void { this.ensureHelpOption(); }

  protected get usageWithoutDescription(): string {
    this.ensureHelpOption();
    const parser = this.argParser;
    const prefix = 'Usage: ';
    let usage = `${prefix}${this.wrap(this.invocation, prefix.length)}\n${parser.usage}\n`;
    if (this._subcommands.size > 0) {
      usage += `\n${generateCommandUsage(this._subcommands, {
        isSubcommand: true,
        ...(parser.usageLineLength === undefined ? {} : { lineLength: parser.usageLineLength }),
        ...(parser.defaultCommand === undefined ? {} : { defaultCommand: parser.defaultCommand }),
      })}\n`;
    }
    if (this.runner === undefined) throw new Error('Command is not attached to a runner.');
    usage += `\n${this.wrap(`Run "${this.runner.executableName} help" to see global options.`)}`;
    if (this.usageFooter !== undefined) usage += `\n${this.wrap(this.usageFooter)}`;
    return usage;
  }

  private wrap(text: string, hangingIndent = 0): string {
    const length = this.argParser.usageLineLength;
    return wrapText(text, { ...(length === undefined ? {} : { length }), hangingIndent });
  }

  run(): TResult | null | Promise<TResult | null> {
    throw new Error(this.wrap(`Leaf command ${this} must implement run().`));
  }

  addSubcommand(command: Command<TResult>, options: { readonly isDefault?: boolean } = {}): void {
    const isDefault = options.isDefault ?? false;
    if (isDefault && command.subcommands.size > 0) throw new TypeError('default command must be a leaf command');
    if (isDefault && this.argParser.defaultCommand !== undefined) throw new Error('default command already defined');
    const names = commandNames(command.name, command.aliases);
    if (names.some((name) => this._subcommands.has(name) || this.argParser.commands.has(name))) {
      throw new TypeError(`Duplicate command "${command.name}".`);
    }
    this.ensureHelpOption();
    command.ensureHelpOption();
    for (const name of names) {
      this.argParser.addCommand(name, command.argParser);
      this._subcommands.set(name, command);
    }
    if (isDefault) this.argParser.defaultCommand = command.name;
    command.parentCommand = this;
  }

  printUsage(): void {
    if (this.runner === undefined) console.log(this.usage);
    else this.runner.printCommandUsage(this.usage);
  }

  usageException(message: string): never {
    throw new UsageException(this.wrap(message), this.usageWithoutDescription);
  }

  /** @internal */
  attachRunner(runner: CommandRunner<TResult>): void { this.rootRunner = runner; }
  /** @internal */
  setResults(globalResults: ArgResults, argResults: ArgResults): void {
    this.globalResultValue = globalResults;
    this.argumentResultValue = argResults;
  }
}
