import { OptionType, type Option } from './option.js';

export interface ArgParserOptions {
  readonly allowTrailingOptions?: boolean;
  readonly allowAnything?: boolean;
  readonly usageLineLength?: number;
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
  readonly name: string;
  readonly options: ReadonlyMap<string, Option>;
  readonly values: ReadonlyMap<string, OptionValue>;
  readonly rest: readonly string[];
  readonly arguments: readonly string[];
}

/** Public parser contract. Concrete grammar and parsing are implemented in later migration phases. */
export abstract class ArgParser {
  abstract readonly options: ReadonlyMap<string, Option>;
  abstract readonly commands: ReadonlyMap<string, ArgParser>;
  abstract readonly usage: string;
  abstract parse(arguments_: readonly string[]): ArgResults;
}

/** Public parsed-result contract. */
export abstract class ArgResults {
  abstract readonly name: string;
  abstract readonly rest: readonly string[];
  abstract readonly arguments: readonly string[];
  abstract readonly command: ArgResults | undefined;
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
  abstract run(): TResult | Promise<TResult>;
}

/** Public command-runner contract; dispatch behavior is implemented in a later phase. */
export abstract class CommandRunner<TResult = unknown> {
  abstract readonly executableName: string;
  abstract readonly description: string;
  abstract readonly argParser: ArgParser;
  abstract readonly usage: string;
  abstract run(arguments_: readonly string[]): Promise<TResult | undefined>;
}
