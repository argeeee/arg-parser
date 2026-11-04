import { padRight, wrapText, wrapTextAsLines } from './utils.js';

export interface CommandLike {
  readonly name: string;
  readonly description: string;
  readonly summary: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly hidden: boolean;
}

/** Renders command names and summaries in insertion order, grouped by category. */
export function generateCommandUsage(
  commands: ReadonlyMap<string, CommandLike>,
  options: {
    readonly isSubcommand?: boolean;
    readonly lineLength?: number;
    readonly defaultCommand?: string;
  } = {},
): string {
  const names = [...commands.keys()].filter((name) => !commands.get(name)!.aliases.includes(name));
  const visible = names.filter((name) => !commands.get(name)!.hidden);
  const displayedNames = visible.length === 0 ? names : visible;
  const width = Math.max(0, ...displayedNames.map((name) => name.length));
  const columnStart = width + 5;
  const categories = new Map<string, CommandLike[]>();
  for (const name of displayedNames) {
    const command = commands.get(name)!;
    const group = categories.get(command.category) ?? [];
    group.push(command);
    categories.set(command.category, group);
  }

  let result = `Available ${options.isSubcommand ? 'sub' : ''}commands:`;
  for (const category of [...categories.keys()].sort()) {
    if (category !== '') result += `\n\n${category}`;
    for (const command of categories.get(category)!) {
      const marker = options.defaultCommand === command.name ? '(default) ' : '';
      const lines = wrapTextAsLines(`${marker}${command.summary}`, {
        start: columnStart,
        ...(options.lineLength === undefined ? {} : { length: options.lineLength }),
      });
      result += `\n  ${padRight(command.name, width)}   ${lines[0] ?? ''}`;
      for (const line of lines.slice(1)) result += `\n${' '.repeat(columnStart)}${line}`;
    }
  }
  if (options.defaultCommand !== undefined) {
    result += `\n\n${wrapText(`Default command (${options.defaultCommand}) will be selected if no command is explicitly specified.`, options.lineLength === undefined ? {} : { length: options.lineLength })}`;
  }
  return result;
}
