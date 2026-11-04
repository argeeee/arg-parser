import { Option, OptionType, type OptionDefinition } from './option.js';
import { ReadonlyMapView } from './readonly_map.js';
import { Parser } from './parser.js';

export interface ArgParserOptions {
  readonly allowTrailingOptions?: boolean;
  readonly usageLineLength?: number;
}

export interface AddFlagOptions {
  readonly abbr?: string;
  readonly help?: string;
  readonly defaultsTo?: boolean | null;
  readonly negatable?: boolean;
  readonly callback?: (value: boolean) => void;
  readonly hide?: boolean;
  readonly hideNegatedUsage?: boolean;
  readonly aliases?: readonly string[];
}

export interface AddOptionOptions {
  readonly abbr?: string;
  readonly help?: string;
  readonly valueHelp?: string;
  readonly allowed?: Iterable<string>;
  readonly allowedHelp?: ReadonlyMap<string, string>;
  readonly defaultsTo?: string | null;
  readonly callback?: (value: string | null) => void;
  readonly mandatory?: boolean;
  readonly hide?: boolean;
  readonly aliases?: readonly string[];
}

export interface AddMultiOptionOptions {
  readonly abbr?: string;
  readonly help?: string;
  readonly valueHelp?: string;
  readonly allowed?: Iterable<string>;
  readonly allowedHelp?: ReadonlyMap<string, string>;
  readonly defaultsTo?: Iterable<string>;
  readonly callback?: (value: readonly string[]) => void;
  readonly splitCommas?: boolean;
  readonly hide?: boolean;
  readonly aliases?: readonly string[];
}

export interface FlagOptionConfig {
  readonly type: typeof OptionType.flag;
  readonly name: string;
  readonly abbr?: string;
  readonly aliases?: readonly string[];
  readonly defaultsTo?: boolean | null;
  readonly negatable?: boolean;
  readonly mandatory?: boolean;
  readonly help?: string;
  readonly callback?: (value: boolean | undefined) => void;
}

export interface SingleOptionConfig {
  readonly type: typeof OptionType.single;
  readonly name: string;
  readonly abbr?: string;
  readonly aliases?: readonly string[];
  readonly defaultsTo?: string | null;
  readonly allowed?: readonly string[];
  readonly mandatory?: boolean;
  readonly help?: string;
  readonly valueHelp?: string;
  readonly callback?: (value: string | null | undefined) => void;
}

export interface MultiOptionConfig {
  readonly type: typeof OptionType.multiple;
  readonly name: string;
  readonly abbr?: string;
  readonly aliases?: readonly string[];
  readonly defaultsTo?: readonly string[] | null;
  readonly allowed?: readonly string[];
  readonly splitCommas?: boolean;
  readonly mandatory?: boolean;
  readonly help?: string;
  readonly valueHelp?: string;
  readonly callback?: (value: readonly string[]) => void;
}

export type OptionConfig =
  | FlagOptionConfig
  | SingleOptionConfig
  | MultiOptionConfig;

export type OptionValue = boolean | string | readonly string[] | null | undefined;

export interface ArgResultsOptions {
  /** The command name, or `null` for the top-level result. */
  readonly name: string | null;
  readonly options: ReadonlyMap<string, Option>;
  readonly values: ReadonlyMap<string, OptionValue>;
  readonly rest: readonly string[];
  readonly arguments: readonly string[];
}

/** Public parser contract. Concrete grammar and parsing are implemented in later migration phases. */
export class ArgParser {
  private readonly optionDefinitions = new Map<string, Option>();
  private readonly commandDefinitions = new Map<string, ArgParser>();
  private readonly aliasNames = new Map<string, string>();
  private readonly separators: string[] = [];
  private readonly optionView: ReadonlyMap<string, Option>;
  private readonly commandView: ReadonlyMap<string, ArgParser>;
  readonly allowTrailingOptions: boolean;
  readonly usageLineLength: number | undefined;
  private defaultCommandValue: string | undefined;

  constructor(options: ArgParserOptions = {}) {
    this.allowTrailingOptions = options.allowTrailingOptions ?? true;
    this.usageLineLength = options.usageLineLength;
    this.optionView = new ReadonlyMapView(this.optionDefinitions);
    this.commandView = new ReadonlyMapView(this.commandDefinitions);
  }

  /** Creates a parser that treats all input as positional arguments. */
  static allowAnything(): ArgParser {
    return new AllowAnythingArgParser();
  }

  get options(): ReadonlyMap<string, Option> { return this.optionView; }
  get commands(): ReadonlyMap<string, ArgParser> { return this.commandView; }
  get allowsAnything(): boolean { return false; }
  get defaultCommand(): string | undefined { return this.defaultCommandValue; }
  set defaultCommand(value: string | undefined) { this.defaultCommandValue = value; }

  /** Usage rendering is implemented in the usage phase. */
  get usage(): string { return ''; }

  addCommand(name: string, parser?: ArgParser): ArgParser {
    if (this.commandDefinitions.has(name)) throw new TypeError(`Duplicate command "${name}".`);
    const child = parser ?? new ArgParser();
    this.commandDefinitions.set(name, child);
    return child;
  }

  addFlag(name: string, options: AddFlagOptions = {}): void {
    this.registerOption({
      type: OptionType.flag,
      name,
      ...options,
      defaultsTo: options.defaultsTo === undefined ? false : options.defaultsTo,
      negatable: options.negatable ?? true,
      mandatory: false,
    });
  }

  addOption(name: string, options: AddOptionOptions = {}): void {
    this.registerOption({ type: OptionType.single, name, ...options });
  }

  addMultiOption(name: string, options: AddMultiOptionOptions = {}): void {
    this.registerOption({
      type: OptionType.multiple,
      name,
      ...options,
      defaultsTo: options.defaultsTo === undefined ? [] : [...options.defaultsTo],
      splitCommas: options.splitCommas ?? true,
      mandatory: false,
    });
  }

  addSeparator(text: string): void { this.separators.push(text); }

  defaultFor(name: string): OptionValue {
    const option = this.findByNameOrAlias(name);
    if (option === undefined) throw new TypeError(`No option named ${name}`);
    return option.defaultsTo;
  }

  getDefault(name: string): OptionValue { return this.defaultFor(name); }

  findByAbbreviation(abbr: string): Option | undefined {
    return [...this.optionDefinitions.values()].find((option) => option.abbr === abbr);
  }

  findByNameOrAlias(name: string): Option | undefined {
    return this.optionDefinitions.get(this.aliasNames.get(name) ?? name);
  }

  parse(arguments_: Iterable<string>): ArgResults {
    return new Parser(this, arguments_).parse();
  }

  protected registerOption(definition: OptionDefinition): void {
    const aliases = definition.aliases ?? [];
    const allNames = [definition.name, ...aliases];
    if (allNames.some((name) => this.findByNameOrAlias(name) !== undefined)) {
      throw new TypeError(`Duplicate option or alias "${definition.name}".`);
    }
    if (definition.abbr !== undefined) {
      const existing = this.findByAbbreviation(definition.abbr);
      if (existing !== undefined) {
        throw new TypeError(`Abbreviation "${definition.abbr}" is already used by "${existing.name}".`);
      }
    }
    if (definition.mandatory && definition.defaultsTo !== undefined && definition.defaultsTo !== null) {
      throw new TypeError(`The option ${definition.name} cannot be mandatory and have a default value.`);
    }
    if (definition.type === OptionType.flag && !definition.negatable && definition.hideNegatedUsage) {
      throw new TypeError(`The option ${definition.name} cannot have \`hideNegatedUsage\` without being negatable.`);
    }
    const option = new Option({ ...definition, aliases });
    this.optionDefinitions.set(definition.name, option);
    for (const alias of aliases) this.aliasNames.set(alias, definition.name);
  }
}

class AllowAnythingArgParser extends ArgParser {
  constructor() { super({ allowTrailingOptions: false }); }
  override get allowsAnything(): boolean { return true; }
  override get usage(): string { return ''; }
  override get defaultCommand(): string | undefined { return undefined; }
  override set defaultCommand(_value: string | undefined) {
    throw new TypeError("ArgParser.allowAnything().defaultCommand= isn't supported.");
  }
  override addCommand(_name: string, _parser?: ArgParser): ArgParser {
    throw new TypeError("ArgParser.allowAnything().addCommands() isn't supported.");
  }
  override addFlag(_name: string, _options?: AddFlagOptions): void {
    throw new TypeError("ArgParser.allowAnything().addFlag() isn't supported.");
  }
  override addOption(_name: string, _options?: AddOptionOptions): void {
    throw new TypeError("ArgParser.allowAnything().addOption() isn't supported.");
  }
  override addMultiOption(_name: string, _options?: AddMultiOptionOptions): void {
    throw new TypeError("ArgParser.allowAnything().addMultiOption() isn't supported.");
  }
  override addSeparator(_text: string): void {
    throw new TypeError("ArgParser.allowAnything().addSeparator() isn't supported.");
  }
  override defaultFor(name: string): OptionValue { throw new TypeError(`No option named ${name}`); }
  override findByAbbreviation(_abbr: string): Option | undefined { return undefined; }
  override findByNameOrAlias(_name: string): Option | undefined { return undefined; }
  protected override registerOption(_definition: OptionDefinition): void {
    throw new TypeError('Options are not supported by ArgParser.allowAnything().');
  }
}

/** Public parsed-result contract. */
export abstract class ArgResults {
  /** The command name, or `null` for the top-level result. */
  abstract readonly name: string | null;
  abstract readonly rest: readonly string[];
  abstract readonly arguments: readonly string[];
  abstract readonly command: ArgResults | undefined;
  abstract readonly options: Iterable<string>;
  abstract flag(name: string): boolean;
  abstract option(name: string): string | null;
  abstract multiOption(name: string): readonly string[];
  abstract wasParsed(name: string): boolean;
  abstract value(name: string): OptionValue;
}

export interface CommandRunnerOptions {
  readonly usageLineLength?: number;
  readonly suggestionDistanceLimit?: number;
}

/** Base type for commands dispatched by a command runner. */
export abstract class Command<TResult = unknown> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly summary: string;
  abstract readonly category: string;
  abstract readonly invocation: string;
  abstract readonly parent: Command<TResult> | undefined;
  abstract readonly runner: CommandRunner<TResult> | undefined;
  abstract readonly globalResults: ArgResults | undefined;
  abstract readonly argResults: ArgResults | undefined;
  abstract readonly argParser: ArgParser;
  abstract readonly usage: string;
  abstract readonly usageFooter: string | undefined;
  abstract readonly subcommands: ReadonlyMap<string, Command<TResult>>;
  abstract readonly hidden: boolean;
  abstract readonly takesArguments: boolean;
  abstract readonly aliases: readonly string[];
  abstract readonly suggestionAliases: readonly string[];
  abstract run(): TResult | null | Promise<TResult | null>;
  abstract addSubcommand(command: Command<TResult>, options?: { readonly isDefault?: boolean }): void;
  abstract printUsage(): void;
  abstract usageException(message: string): never;
}

/** Public command-runner contract; dispatch behavior is implemented in a later phase. */
export abstract class CommandRunner<TResult = unknown> {
  constructor(
    executableName: string,
    description: string,
    options?: CommandRunnerOptions,
  ) {}

  abstract readonly executableName: string;
  abstract readonly description: string;
  abstract readonly invocation: string;
  abstract readonly argParser: ArgParser;
  abstract readonly usage: string;
  abstract readonly usageFooter: string | undefined;
  abstract readonly commands: ReadonlyMap<string, Command<TResult>>;
  abstract readonly suggestionDistanceLimit: number;
  abstract printUsage(): void;
  abstract usageException(message: string): never;
  abstract addCommand(
    command: Command<TResult>,
    options?: { readonly isDefault?: boolean },
  ): void;
  abstract parse(arguments_: Iterable<string>): ArgResults;
  abstract run(arguments_: Iterable<string>): Promise<TResult | null>;
  abstract runCommand(topLevelResults: ArgResults): Promise<TResult | null>;
}
