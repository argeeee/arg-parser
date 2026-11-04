import { Option, OptionType } from './option.js';
import { wrapText, wrapTextAsLines } from './utils.js';

/** Renders the option and separator sequence used by an ArgParser. */
export function generateUsage(
  optionsAndSeparators: readonly (Option | string)[],
  lineLength?: number,
): string {
  const renderer = new UsageRenderer(optionsAndSeparators, lineLength);
  return renderer.generate();
}

class UsageRenderer {
  private readonly buffer: string[] = [];
  private currentColumn = 0;
  private readonly widths: readonly [number, number];
  private newlinesNeeded = 0;

  constructor(
    private readonly items: readonly (Option | string)[],
    private readonly lineLength?: number,
  ) {
    this.widths = this.calculateWidths();
  }

  generate(): string {
    for (const item of this.items) {
      if (typeof item === 'string') {
        this.writeSeparator(item);
      } else if (!item.hide) {
        this.writeOption(item);
      }
    }
    return this.buffer.join('');
  }

  private writeSeparator(separator: string): void {
    if (this.buffer.length > 0) this.buffer.push('\n\n');
    this.buffer.push(this.lineLength === undefined
      ? wrapText(separator)
      : wrapText(separator, { length: this.lineLength }));
    this.newlinesNeeded = 1;
    this.currentColumn = 0;
  }

  private writeOption(option: Option): void {
    this.write(0, this.abbreviation(option));
    this.write(1, `${this.longOption(option)}${option.mandatory ? ' (mandatory)' : ''}`);

    if (option.help !== undefined) this.write(2, option.help);

    if (option.allowedHelp !== undefined) {
      this.newline();
      for (const [name, content] of option.allowedHelp) {
        const isDefault = Array.isArray(option.defaultsTo)
          ? option.defaultsTo.includes(name)
          : option.defaultsTo === name;
        this.write(1, `      [${name}]${isDefault ? ' (default)' : ''}`);
        this.write(2, content);
      }
      this.newline();
    } else if (option.allowed !== undefined) {
      this.write(2, this.allowedList(option));
    } else if (option.isFlag) {
      if (option.defaultsTo === true) this.write(2, '(defaults to on)');
    } else if (option.isMultiple) {
      if (Array.isArray(option.defaultsTo) && option.defaultsTo.length > 0) {
        this.write(2, `(defaults to ${option.defaultsTo.map((value) => `"${value}"`).join(', ')})`);
      }
    } else if (option.defaultsTo !== null && option.defaultsTo !== undefined) {
      this.write(2, `(defaults to "${option.defaultsTo}")`);
    }
  }

  private abbreviation(option: Option): string {
    return option.abbr === undefined ? '' : `-${option.abbr}, `;
  }

  private longOption(option: Option): string {
    const negated = option.type === OptionType.flag && option.negatable !== false && !option.hideNegatedUsage;
    let result = negated ? `--[no-]${option.name}` : `--${option.name}`;
    if (option.valueHelp !== undefined) result += `=<${option.valueHelp}>`;
    return result;
  }

  private calculateWidths(): readonly [number, number] {
    let abbreviation = 0;
    let title = 0;
    for (const item of this.items) {
      if (typeof item === 'string' || item.hide) continue;
      abbreviation = Math.max(abbreviation, this.abbreviation(item).length);
      title = Math.max(title, this.longOption(item).length + (item.mandatory ? ' (mandatory)'.length : 0));
      if (item.allowedHelp !== undefined) {
        for (const [name] of item.allowedHelp) {
          const isDefault = Array.isArray(item.defaultsTo)
            ? item.defaultsTo.includes(name)
            : item.defaultsTo === name;
          title = Math.max(title, `      [${name}]${isDefault ? ' (default)' : ''}`.length);
        }
      }
    }
    return [abbreviation, title + 4];
  }

  private newline(): void {
    this.newlinesNeeded++;
    this.currentColumn = 0;
  }

  private write(column: number, text: string): void {
    let lines = text.split('\n');
    if (column === this.widths.length && this.lineLength !== undefined) {
      const start = this.widths.slice(0, column).reduce((sum, width) => sum + width, 0);
      const lineLength = this.lineLength;
      lines = lines.flatMap((line) => wrapTextAsLines(line, { start, length: lineLength }));
    }
    while (lines.length > 0 && lines[0]!.trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop();
    for (const line of lines) this.writeLine(column, line);
  }

  private writeLine(column: number, text: string): void {
    while (this.newlinesNeeded > 0) {
      this.buffer.push('\n');
      this.newlinesNeeded--;
    }
    while (this.currentColumn !== column) {
      if (this.currentColumn < 2) this.buffer.push(' '.repeat(this.widths[this.currentColumn]!));
      else this.buffer.push('\n');
      this.currentColumn = (this.currentColumn + 1) % 3;
    }
    if (column < this.widths.length) this.buffer.push(text.padEnd(this.widths[column]!));
    else this.buffer.push(text);
    this.currentColumn = (this.currentColumn + 1) % 3;
    if (column === 2) this.newlinesNeeded++;
  }

  private allowedList(option: Option): string {
    const defaults = Array.isArray(option.defaultsTo) ? option.defaultsTo : [option.defaultsTo];
    const values = option.allowed ?? [];
    return `[${values.map((value) => `${value}${defaults.includes(value) ? ' (default)' : ''}`).join(', ')}]`;
  }
}
