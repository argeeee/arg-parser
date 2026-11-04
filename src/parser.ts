import type { ArgParser } from './contracts.js';
import type { OptionValue } from './contracts.js';
import { ParsedArgResults } from './arg_results.js';
import { ArgParserException } from './errors.js';
import { OptionType, type Option } from './option.js';

type ParsedOptionValue = boolean | string | string[];

/** Implements token parsing while keeping all mutable state local to a parse. */
export class Parser {
  private readonly parsed = new Map<string, ParsedOptionValue>();
  private readonly rest: string[];
  private index = 0;
  private readonly args: readonly string[];

  constructor(
    private readonly grammar: ArgParser,
    arguments_: Iterable<string>,
    private readonly name: string | null = null,
    private readonly parent?: Parser,
    inheritedRest: readonly string[] = [],
  ) {
    this.args = [...arguments_];
    this.rest = [...inheritedRest];
  }

  parse(): ParsedArgResults {
    if (this.grammar.allowsAnything) {
      return new ParsedArgResults(this.grammar, this.parsed, this.args, this.args, this.name);
    }

    let selectedCommand: { name: string; parser: ArgParser } | undefined;
    while (this.index < this.args.length) {
      const arg = this.args[this.index]!;
      if (arg === '--') {
        this.index++;
        break;
      }

      // A command takes precedence over option recognition so names such as
      // "-help" can still be registered as commands.
      const commandParser = this.grammar.commands.get(arg);
      if (commandParser !== undefined) {
        selectedCommand = { name: arg, parser: commandParser };
        this.index++;
        break;
      }

      const defaultCommand = this.grammar.defaultCommand;
      if (defaultCommand !== undefined && arg !== '-h' && arg !== '--help') {
        const parser = this.grammar.commands.get(defaultCommand);
        if (parser !== undefined) {
          selectedCommand = { name: defaultCommand, parser };
          break;
        }
      }

      if (this.parseSolo(arg) || this.parseLong(arg) || this.parseShortGroup(arg)) continue;
      if (!this.grammar.allowTrailingOptions) break;
      this.rest.push(arg);
      this.index++;
    }

    if (selectedCommand === undefined && this.rest.length === 0 && !this.parsed.has('help')) {
      const defaultCommand = this.grammar.defaultCommand;
      const parser = defaultCommand === undefined ? undefined : this.grammar.commands.get(defaultCommand);
      if (defaultCommand !== undefined && parser !== undefined) {
        selectedCommand = { name: defaultCommand, parser };
      }
    }

    let commandResults: ParsedArgResults | undefined;
    if (selectedCommand !== undefined) {
      if (this.rest.length > 0) {
        this.fail('Cannot specify arguments before a command.', selectedCommand.name);
      }
      const child = new Parser(
        selectedCommand.parser,
        this.args.slice(this.index),
        selectedCommand.name,
        this,
        this.rest,
      );
      try {
        commandResults = child.parse();
      } catch (error) {
        if (!(error instanceof ArgParserException)) throw error;
        throw new ArgParserException(
          error.message,
          [selectedCommand.name, ...error.commands],
          error.argumentName,
          error.source,
          error.offset,
        );
      }
      this.rest.length = 0;
    }

    this.validateMandatoryAndCallCallbacks(selectedCommand?.name);
    if (selectedCommand === undefined) this.rest.push(...this.args.slice(this.index));
    return new ParsedArgResults(
      this.grammar,
      this.parsed,
      this.rest,
      this.args,
      this.name,
      commandResults,
    );
  }

  private findByAbbreviation(abbreviation: string): { owner: Parser; option: Option } | undefined {
    const option = this.grammar.findByAbbreviation(abbreviation);
    if (option !== undefined) return { owner: this, option };
    return this.parent?.findByAbbreviation(abbreviation);
  }

  private findByNameOrAlias(name: string): { owner: Parser; option: Option } | undefined {
    const option = this.grammar.findByNameOrAlias(name);
    if (option !== undefined) return { owner: this, option };
    return this.parent?.findByNameOrAlias(name);
  }

  private parseSolo(arg: string): boolean {
    if (!/^-([A-Za-z0-9])$/u.test(arg)) return false;
    const abbreviation = arg[1]!;
    const found = this.findByAbbreviation(abbreviation);
    if (found === undefined) this.fail(`Could not find an option or flag "-${abbreviation}".`, `-${abbreviation}`);
    this.index++;
    if (found.option.type === OptionType.flag) found.owner.parsed.set(found.option.name, true);
    else found.owner.setValue(found.option, this.takeValue(`-${abbreviation}`), `-${abbreviation}`);
    return true;
  }

  private parseShortGroup(arg: string): boolean {
    const match = /^-([A-Za-z0-9]+)([^\r\n]*)$/u.exec(arg);
    if (match === null || arg.startsWith('--')) return false;
    const letters = match[1]!;
    const attached = match[2]!;
    const first = this.findByAbbreviation(letters[0]!);
    if (first === undefined) this.fail(`Could not find an option with short name "-${letters[0]}".`, `-${letters[0]}`);
    if (first.option.type !== OptionType.flag) {
      this.index++;
      first.owner.setValue(first.option, `${letters.slice(1)}${attached}`, `-${letters[0]}`);
      return true;
    }
    if (attached.length > 0) {
      this.fail(`Option "-${letters[0]}" is a flag and cannot handle value "${letters.slice(1)}${attached}".`, `-${letters[0]}`);
    }
    for (const abbreviation of letters) {
      const found = this.findByAbbreviation(abbreviation);
      if (found === undefined) this.fail(`Could not find an option with short name "-${abbreviation}".`, `-${abbreviation}`);
      if (found.option.type !== OptionType.flag) {
        this.fail(`Option "-${abbreviation}" must be a flag to be in a collapsed "-".`, `-${abbreviation}`);
      }
      found.owner.parsed.set(found.option.name, true);
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
    let found = this.findByNameOrAlias(name);
    if (found !== undefined) {
      this.index++;
      if (found.option.type === OptionType.flag) {
        if (hasAttached) this.fail(`Flag option "--${name}" should not be given a value.`, `--${name}`);
        found.owner.parsed.set(found.option.name, true);
      } else {
        found.owner.setValue(found.option, hasAttached ? value! : this.takeValue(`--${name}`), `--${name}`);
      }
      return true;
    }
    if (name.startsWith('no-')) {
      found = this.findByNameOrAlias(name.slice(3));
      if (found !== undefined) {
        this.index++;
        if (found.option.type !== OptionType.flag) this.fail(`Cannot negate non-flag option "--${name}".`, `--${name}`);
        if (!found.option.negatable) this.fail(`Cannot negate option "--${name}".`, `--${name}`);
        found.owner.parsed.set(found.option.name, false);
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
        this.validateAllowed(option, item, optionArg);
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

  private validateMandatoryAndCallCallbacks(commandName?: string): void {
    const ignoreMandatoryOptions = this.parsed.has('help') || commandName === 'help';
    for (const [name, option] of this.grammar.options) {
      const value = this.parsed.get(name);
      if (!ignoreMandatoryOptions && option.mandatory && value === undefined) {
        throw new ArgParserException(`Option ${name} is mandatory.`, [], name);
      }
      if (option.callback !== undefined) option.invokeCallback(option.valueOrDefault(value as OptionValue));
    }
  }

  private fail(message: string, argumentName: string): never {
    throw new ArgParserException(message, [], argumentName);
  }
}
