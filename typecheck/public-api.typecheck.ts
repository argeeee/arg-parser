import { ArgParser } from '../src/args.js';
import { Command, CommandRunner } from '../src/command_runner.js';
import type {
  AddFlagOptions,
  AddMultiOptionOptions,
  AddOptionOptions,
  ArgParserOptions,
  ArgResults,
} from '../src/args.js';
import type { OptionDefinition } from '../src/option.js';

// Included only by tsconfig.typecheck.json; this fixture must not be emitted
// as part of the published package build.
abstract class ParserSubclass extends ArgParser {
  constructor(options?: ArgParserOptions) {
    super(options);
  }
}
abstract class RunnerSubclass extends CommandRunner<string> {
  override get invocation(): string {
    return `${this.executableName} [command]`;
  }

  override parse(arguments_: Iterable<string>): ArgResults {
    return this.argParser.parse(arguments_);
  }

  override runCommand(results: ArgResults): Promise<string | null> {
    void results;
    return Promise.resolve(null);
  }
}
abstract class CommandSubclass extends Command<string> {
  override get invocation(): string {
    return this.name;
  }

  override get usageFooter(): string | undefined {
    return undefined;
  }

  override run(): string | null | Promise<string | null> {
    return null;
  }
}

void [ParserSubclass, RunnerSubclass, CommandSubclass];

export function checkPublicApi(
  Parser: new (options?: ArgParserOptions) => ArgParser,
  runner: CommandRunner<string>,
  command: Command<string>,
): void {
  const parser = new Parser({ allowTrailingOptions: false, usageLineLength: 80 });
  parser.addFlag('verbose', { abbr: 'v', defaultsTo: false } satisfies AddFlagOptions);
  parser.addOption('format', { allowed: ['json', 'text'] } satisfies AddOptionOptions);
  parser.addMultiOption('include', { splitCommas: true } satisfies AddMultiOptionOptions);
  const subparser = parser.addCommand('compile');
  parser.addCommand('build', subparser);
  parser.addSeparator('Advanced options:');
  parser.parse(['--verbose']);
  parser.findByAbbreviation('v');
  parser.findByNameOrAlias('verbose');
  const allowsAnything: boolean = parser.allowsAnything;
  parser.defaultFor('verbose');
  parser.getDefault('verbose');
  ArgParser.allowAnything();

  const results: ArgResults = runner.parse(['compile']);
  const topLevelName: string | null = results.name;
  runner.addCommand(command, { isDefault: true });
  runner.run(['compile']);
  runner.runCommand(results);
  runner.printUsage();
  runner.usageException('invalid');

  command.addSubcommand(command, { isDefault: true });
  command.printUsage();
  command.usageException('invalid');
  command.run();

  results.value('verbose');
  results.flag('verbose');
  results.option('format');
  results.multiOption('include');
  results.wasParsed('verbose');
  void [allowsAnything, topLevelName];
}

function checkOptionCallbackNarrowing(definition: OptionDefinition): void {
  switch (definition.type) {
    case 'flag':
      definition.callback?.(true);
      // @ts-expect-error Flag callbacks accept booleans only.
      definition.callback?.('enabled');
      break;
    case 'single':
      definition.callback?.(null);
      // @ts-expect-error Single option callbacks accept strings or null.
      definition.callback?.(true);
      break;
    case 'multiple':
      definition.callback?.(['one', 'two']);
      // @ts-expect-error Multi-option callbacks accept string arrays only.
      definition.callback?.('one');
      break;
  }
}
void checkOptionCallbackNarrowing;

// @ts-expect-error `allowAnything` is a factory, not a constructor option.
const invalidOptions: ArgParserOptions = { allowAnything: true };
void invalidOptions;
