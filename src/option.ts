import { ReadonlyMapSnapshot } from './readonly_map.js';

export const OptionType = {
  flag: 'flag',
  single: 'single',
  multiple: 'multiple',
} as const;

export type OptionType = (typeof OptionType)[keyof typeof OptionType];

export interface OptionDefinition {
  readonly name: string;
  readonly abbr?: string;
  readonly type: OptionType;
  readonly defaultsTo?: boolean | string | readonly string[] | null;
  readonly help?: string;
  readonly valueHelp?: string;
  readonly allowed?: Iterable<string>;
  readonly allowedHelp?: ReadonlyMap<string, string>;
  readonly negatable?: boolean;
  readonly hideNegatedUsage?: boolean;
  readonly callback?: (value: any) => void;
  readonly splitCommas?: boolean;
  readonly mandatory?: boolean;
  readonly hide?: boolean;
  readonly aliases?: readonly string[];
}

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
  readonly callback: OptionDefinition['callback'];
  readonly splitCommas: boolean;
  readonly mandatory: boolean;
  readonly hide: boolean;

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
    this.negatable = definition.negatable;
    this.hideNegatedUsage = definition.hideNegatedUsage;
    this.callback = definition.callback;
    this.splitCommas = definition.splitCommas ?? definition.type === OptionType.multiple;
    this.mandatory = definition.mandatory ?? false;
    this.hide = definition.hide ?? false;
    Object.freeze(this);
  }

  get isFlag(): boolean { return this.type === OptionType.flag; }
  get isSingle(): boolean { return this.type === OptionType.single; }
  get isMultiple(): boolean { return this.type === OptionType.multiple; }

  valueOrDefault(value: unknown): unknown {
    if (value !== null && value !== undefined) return value;
    if (this.isMultiple) return this.defaultsTo ?? Object.freeze([]);
    return this.defaultsTo;
  }
}

function validateName(name: string): void {
  if (name.length === 0) throw new TypeError('Name cannot be empty.');
  if (name.startsWith('-')) throw new TypeError(`Name ${name} cannot start with "-".`);
  if (/[ \t\r\n"'\\/]/u.test(name)) {
    throw new TypeError(`Name "${name}" contains invalid characters.`);
  }
}
