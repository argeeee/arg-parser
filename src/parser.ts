import type { ArgParser } from './contracts.js';
import type { OptionValue } from './contracts.js';
import { ParsedArgResults } from './arg_results.js';
import { ArgParserException } from './errors.js';
import { OptionType, type Option } from './option.js';

type ParsedOptionValue = boolean | string | string[];

/** Implements token parsing while keeping all mutable state local to a parse. */
export class Parser {
  private readonly parsed = new Map<string, ParsedOptionValue>();
  private readonly rest: string[] = [];
  private index = 0;
  private readonly args: readonly string[];

  constructor(private readonly grammar: ArgParser, arguments_: Iterable<string>) {
    this.args = [...arguments_];
  }

  parse(): ParsedArgResults {
    if (this.grammar.allowsAnything) {
      return new ParsedArgResults(this.grammar, this.parsed, this.args, this.args);
    }

    while (this.index < this.args.length) {
      const arg = this.args[this.index]!;
      if (arg === '--') {
        this.index++;
        break;
      }
      if (this.parseSolo(arg) || this.parseLong(arg) || this.parseShortGroup(arg)) continue;
      if (!this.grammar.allowTrailingOptions) break;
      this.rest.push(arg);
      this.index++;
    }

    this.rest.push(...this.args.slice(this.index));
    this.validateMandatoryAndCallCallbacks();
    return new ParsedArgResults(this.grammar, this.parsed, this.rest, this.args);
  }

  private parseSolo(arg: string): boolean {
    if (!/^-([A-Za-z0-9])$/u.test(arg)) return false;
    const abbreviation = arg[1]!;
    const option = this.grammar.findByAbbreviation(abbreviation);
    if (option === undefined) this.fail(`Could not find an option or flag "-${abbreviation}".`, `-${abbreviation}`);
    this.index++;
    if (option.type === OptionType.flag) this.parsed.set(option.name, true);
    else this.setValue(option, this.takeValue(`-${abbreviation}`), `-${abbreviation}`);
    return true;
  }

  private parseShortGroup(arg: string): boolean {
    if (!/^-([A-Za-z0-9]+)([^\r\n]*)$/u.test(arg) || arg.startsWith('--')) return false;
    const match = /^-([A-Za-z0-9]+)([^\r\n]*)$/u.exec(arg)!;
    const letters = match[1]!;
    const attached = match[2]!;
    const first = this.grammar.findByAbbreviation(letters[0]!);
    if (first === undefined) this.fail(`Could not find an option with short name "-${letters[0]}".`, `-${letters[0]}`);
    if (first.type !== OptionType.flag) {
      this.index++;
      this.setValue(first, `${letters.slice(1)}${attached}`, `-${letters[0]}`);
      return true;
    }
    if (attached.length > 0) {
      this.fail(`Option "-${letters[0]}" is a flag and cannot handle value "${letters.slice(1)}${attached}".`, `-${letters[0]}`);
    }
    for (const abbreviation of letters) {
      const option = this.grammar.findByAbbreviation(abbreviation);
      if (option === undefined) this.fail(`Could not find an option with short name "-${abbreviation}".`, `-${abbreviation}`);
      if (option.type !== OptionType.flag) this.fail(`Option "-${abbreviation}" must be a flag to be in a collapsed "-".`, `-${abbreviation}`);
      this.parsed.set(option.name, true);
    }
    this.index++;
    return true;
  }

  private parseLong(arg: string): boolean {
    if (!arg.startsWith('--')) return false;
    const match = /^--([A-Za-z0-9_-]+)(?:=([^\r\n]*))?$/u.exec(arg);
    if (match === null) return false;
    const name = match[1]!;
    const hasAttached = arg.includes('=');
    const value = match[2];
    let option = this.grammar.findByNameOrAlias(name);
    if (option !== undefined) {
      this.index++;
      if (option.type === OptionType.flag) {
        if (hasAttached) this.fail(`Flag option "--${name}" should not be given a value.`, `--${name}`);
        this.parsed.set(option.name, true);
      } else {
        this.setValue(option, hasAttached ? value! : this.takeValue(`--${name}`), `--${name}`);
      }
      return true;
    }
    if (name.startsWith('no-')) {
      option = this.grammar.findByNameOrAlias(name.slice(3));
      if (option !== undefined) {
        this.index++;
        if (option.type !== OptionType.flag) this.fail(`Cannot negate non-flag option "--${name}".`, `--${name}`);
        if (!option.negatable) this.fail(`Cannot negate option "--${name}".`, `--${name}`);
        this.parsed.set(option.name, false);
        return true;
      }
    }
    this.fail(`Could not find an option named "--${name}".`, `--${name}`);
  }

  private takeValue(optionArg: string): string {
    if (this.index >= this.args.length) this.fail(`Missing argument for "${optionArg}".`, optionArg);
    return this.args[this.index++]!;
  }

  private setValue(option: Option, value: string, optionArg: string): void {
    if (option.type === OptionType.multiple) {
      const current = this.parsed.get(option.name);
      if (current !== undefined && !Array.isArray(current)) {
        throw new TypeError(`Internal parser state for multi-option "${option.name}" is invalid.`);
      }
      const next = current ?? [];
      const values = option.splitCommas ? value.split(',') : [value];
      for (const item of values) {
        if (option.allowed !== undefined && !option.allowed.includes(item)) {
          this.fail(`"${item}" is not an allowed value for option "${optionArg}".`, optionArg);
        }
        next.push(item);
      }
      this.parsed.set(option.name, next);
    } else {
      this.validateAllowed(option, value, optionArg);
      this.parsed.set(option.name, value);
    }
  }

  private validateAllowed(option: Option, value: string, optionArg: string): void {
    if (option.allowed !== undefined && !option.allowed.includes(value)) {
      this.fail(`"${value}" is not an allowed value for option "${optionArg}".`, optionArg);
    }
  }

  private validateMandatoryAndCallCallbacks(): void {
    for (const [name, option] of this.grammar.options) {
      const value = this.parsed.get(name);
      if (option.mandatory && value === undefined) {
        throw new ArgParserException(`Option ${name} is mandatory.`, [], name);
      }
      if (option.callback === undefined) continue;
      option.invokeCallback(option.valueOrDefault(value));
    }
  }

  private fail(message: string, argumentName: string): never {
    throw new ArgParserException(message, [], argumentName);
  }
}
