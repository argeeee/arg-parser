import { ArgResults as ArgResultsContract, type OptionValue } from './contracts.js';
import type { ArgParser } from './contracts.js';
import { OptionType } from './option.js';

/** Immutable snapshot of one parser's results. */
export class ParsedArgResults implements ArgResultsContract {
  readonly name: string | null;
  readonly rest: readonly string[];
  readonly arguments: readonly string[];
  readonly command: ArgResultsContract | undefined;
  private readonly parsed: ReadonlyMap<string, OptionValue>;

  constructor(
    private readonly parser: ArgParser,
    parsed: ReadonlyMap<string, OptionValue>,
    rest: readonly string[],
    arguments_: readonly string[],
    name: string | null = null,
    command?: ArgResultsContract,
  ) {
    this.parsed = new Map([...parsed].map(([name, value]) => [
      name,
      Array.isArray(value) ? Object.freeze([...value]) : value,
    ]));
    this.name = name;
    this.command = command;
    this.rest = Object.freeze([...rest]);
    this.arguments = Object.freeze([...arguments_]);
  }

  get options(): Iterable<string> {
    const names = new Set(this.parsed.keys());
    for (const [name, option] of this.parser.options) {
      if (option.defaultsTo !== undefined && option.defaultsTo !== null) names.add(name);
    }
    return Object.freeze([...names]);
  }

  value(name: string): OptionValue {
    const option = this.parser.options.get(name);
    if (option === undefined) throw new TypeError(`Could not find an option named "--${name}".`);
    return (option.valueOrDefault(this.parsed.get(name)) ?? null) as OptionValue;
  }

  flag(name: string): boolean {
    const option = this.requireOption(name);
    if (option.type !== OptionType.flag) throw new TypeError(`"${name}" is not a flag.`);
    return option.valueOrDefault(this.parsed.get(name)) as boolean;
  }

  option(name: string): string | null {
    const option = this.requireOption(name);
    if (option.type !== OptionType.single) throw new TypeError(`"${name}" is a multi-option.`);
    return (option.valueOrDefault(this.parsed.get(name)) ?? null) as string | null;
  }

  multiOption(name: string): readonly string[] {
    const option = this.requireOption(name);
    if (option.type !== OptionType.multiple) throw new TypeError(`"${name}" is not a multi-option.`);
    return option.valueOrDefault(this.parsed.get(name)) as readonly string[];
  }

  wasParsed(name: string): boolean {
    this.requireOption(name);
    return this.parsed.has(name);
  }

  private requireOption(name: string) {
    const option = this.parser.options.get(name);
    if (option === undefined) throw new TypeError(`Could not find an option named "--${name}".`);
    return option;
  }
}
