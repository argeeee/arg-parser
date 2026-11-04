import type { OptionValue } from './contracts.js';
import { ReadonlyMapSnapshot } from './readonly_map.js';

export const OptionType = {
  flag: 'flag',
  single: 'single',
  multiple: 'multiple',
} as const;

export type OptionType = (typeof OptionType)[keyof typeof OptionType];

interface BaseOptionDefinition {
  readonly name: string;
  readonly abbr?: string;
  readonly help?: string;
  readonly valueHelp?: string;
  readonly allowed?: Iterable<string>;
  readonly allowedHelp?: ReadonlyMap<string, string>;
  readonly splitCommas?: boolean;
  readonly mandatory?: boolean;
  readonly hide?: boolean;
  readonly aliases?: readonly string[];
}

export interface FlagOptionDefinition extends BaseOptionDefinition {
  readonly type: typeof OptionType.flag;
  readonly defaultsTo?: boolean | null;
  readonly negatable?: boolean;
  readonly hideNegatedUsage?: boolean;
  readonly callback?: (value: boolean) => void;
}

export interface SingleOptionDefinition extends BaseOptionDefinition {
  readonly type: typeof OptionType.single;
  readonly defaultsTo?: string | null;
  readonly callback?: (value: string | null) => void;
}

export interface MultiOptionDefinition extends BaseOptionDefinition {
  readonly type: typeof OptionType.multiple;
  readonly defaultsTo?: readonly string[] | null;
  readonly callback?: (value: readonly string[]) => void;
}

export type OptionDefinition =
  | FlagOptionDefinition
  | SingleOptionDefinition
  | MultiOptionDefinition;

type OptionCallback =
  | FlagOptionDefinition['callback']
  | SingleOptionDefinition['callback']
  | MultiOptionDefinition['callback'];

/** Metadata and defaults for a registered command-line option. */
export class Option {
  readonly name: string;
  readonly abbr: string | undefined;
  readonly type: OptionType;
  readonly defaultsTo: boolean | string | readonly string[] | null | undefined;
  readonly aliases: readonly string[];
  readonly help: string | undefined;
  readonly valueHelp: string | undefined;
  readonly allowed: readonly string[] | undefined;
  readonly allowedHelp: ReadonlyMap<string, string> | undefined;
  readonly negatable: boolean | undefined;
  readonly hideNegatedUsage: boolean | undefined;
  readonly callback: OptionCallback;
  readonly splitCommas: boolean;
  readonly mandatory: boolean;
  readonly hide: boolean;
  private readonly flagCallback: FlagOptionDefinition['callback'];
  private readonly singleCallback: SingleOptionDefinition['callback'];
  private readonly multiCallback: MultiOptionDefinition['callback'];

  constructor(definition: OptionDefinition) {
    validateName(definition.name);
    if (definition.abbr !== undefined) {
      if (definition.abbr.length !== 1) {
        throw new TypeError('Abbreviation must be null or have length 1.');
      }
      if (definition.abbr === '-') {
        throw new TypeError('Abbreviation cannot be "-".');
      }
      if (/[ \t\r\n"'\\/]/u.test(definition.abbr)) {
        throw new TypeError('Abbreviation is an invalid character.');
      }
    }

    this.name = definition.name;
    this.abbr = definition.abbr;
    this.type = definition.type;
    this.defaultsTo = Array.isArray(definition.defaultsTo)
      ? Object.freeze([...definition.defaultsTo])
      : definition.defaultsTo;
    this.aliases = Object.freeze([...(definition.aliases ?? [])]);
    this.help = definition.help;
    this.valueHelp = definition.valueHelp;
    this.allowed = definition.allowed === undefined
      ? undefined
      : Object.freeze([...definition.allowed]);
    this.allowedHelp = definition.allowedHelp === undefined
      ? undefined
      : new ReadonlyMapSnapshot(definition.allowedHelp);
    this.negatable = definition.type === OptionType.flag ? definition.negatable : undefined;
    this.hideNegatedUsage = definition.type === OptionType.flag ? definition.hideNegatedUsage : undefined;
    this.callback = definition.callback;
    this.flagCallback = definition.type === OptionType.flag ? definition.callback : undefined;
    this.singleCallback = definition.type === OptionType.single ? definition.callback : undefined;
    this.multiCallback = definition.type === OptionType.multiple ? definition.callback : undefined;
    this.splitCommas = definition.splitCommas ?? definition.type === OptionType.multiple;
    this.mandatory = definition.mandatory ?? false;
    this.hide = definition.hide ?? false;
    Object.freeze(this);
  }

  get isFlag(): boolean { return this.type === OptionType.flag; }
  get isSingle(): boolean { return this.type === OptionType.single; }
  get isMultiple(): boolean { return this.type === OptionType.multiple; }

  valueOrDefault(value: OptionValue): OptionValue {
    if (value !== null && value !== undefined) return value;
    if (this.isMultiple) return this.defaultsTo ?? Object.freeze([]);
    return this.defaultsTo;
  }

  invokeCallback(value: OptionValue): void {
    switch (this.type) {
      case OptionType.flag:
        if (typeof value === 'boolean') this.flagCallback?.(value);
        return;
      case OptionType.single:
        this.singleCallback?.(typeof value === 'string' ? value : null);
        return;
      case OptionType.multiple:
        if (isStringArray(value)) this.multiCallback?.(value);
    }
  }
}

function isStringArray(value: OptionValue): value is readonly string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

function validateName(name: string): void {
  if (name.length === 0) throw new TypeError('Name cannot be empty.');
  if (name.startsWith('-')) throw new TypeError(`Name ${name} cannot start with "-".`);
  if (/[ \t\r\n"'\\/]/u.test(name)) {
    throw new TypeError(`Name "${name}" contains invalid characters.`);
  }
}
