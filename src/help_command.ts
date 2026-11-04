import { Command } from './command.js';

/** Built-in command that prints help for the runner or a selected command. */
export class HelpCommand<TResult = unknown> extends Command<TResult> {
  readonly name = 'help';
  get description(): string {
    return `Display help information for ${this.runner?.executableName ?? 'the command runner'}.`;
  }
  override get invocation(): string {
    const executableName = this.runner?.executableName;
    return executableName === undefined ? 'help [command]' : `${executableName} help [command]`;
  }
  override get hidden(): boolean { return true; }

  override run(): null {
    const path = this.argResults?.rest ?? [];
    if (path.length === 0) {
      this.runner?.printUsage();
      return null;
    }
    const runner = this.runner;
    if (runner === undefined) throw new Error('Help command is not attached to a runner.');
    let currentCommands = runner.commands;
    let selected: Command<TResult> | undefined;
    let parent: Command<TResult> | undefined;
    let commandPath = runner.executableName;
    for (const name of path) {
      if (currentCommands.size === 0) selected!.usageException(`Command "${commandPath}" does not expect a subcommand.`);
      parent = selected;
      selected = currentCommands.get(name);
      if (selected === undefined) {
        if (parent === undefined) runner.usageException(`Could not find a command named "${name}".`);
        parent!.usageException(`Could not find a subcommand named "${name}" for "${commandPath}".`);
      }
      currentCommands = selected!.subcommands;
      commandPath += ` ${name}`;
    }
    selected!.printUsage();
    return null;
  }
}
