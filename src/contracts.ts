import { OptionType, type Option } from './option.js';

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
export abstract class ArgParser {
  constructor(options?: ArgParserOptions) {}

  /** Creates a parser that treats all input as positional arguments. */
  static allowAnything(): ArgParser {
    throw new Error('ArgParser.allowAnything() is not implemented yet.');
  }

  abstract readonly options: ReadonlyMap<string, Option>;
  abstract readonly commands: ReadonlyMap<string, ArgParser>;
  abstract readonly allowTrailingOptions: boolean;
  abstract readonly allowsAnything: boolean;
  abstract readonly usageLineLength: number | undefined;
  abstract defaultCommand: string | undefined;
  abstract readonly usage: string;
  abstract addCommand(name: string, parser?: ArgParser): ArgParser;
  abstract addFlag(name: string, options?: AddFlagOptions): void;
  abstract addOption(name: string, options?: AddOptionOptions): void;
  abstract addMultiOption(name: string, options?: AddMultiOptionOptions): void;
  abstract addSeparator(text: string): void;
  abstract defaultFor(name: string): OptionValue;
  abstract getDefault(name: string): OptionValue;
  abstract findByAbbreviation(abbr: string): Option | undefined;
  abstract findByNameOrAlias(name: string): Option | undefined;
  abstract parse(arguments_: Iterable<string>): ArgResults;
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
