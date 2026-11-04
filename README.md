# @argetim/arg-parser

`@argetim/arg-parser` is a TypeScript command-line argument parser for Node.js. It supports GNU and POSIX option forms, nested commands, typed option callbacks, and generated usage text.

This package is a TypeScript port of Dart's [`args`](https://github.com/dart-lang/core/tree/main/pkgs/args) package. It retains the upstream BSD 3-Clause license and attribution; see [LICENSE](./LICENSE).

## Requirements and imports

Use Node.js 18 or newer. The package is published as CommonJS and includes declarations. TypeScript projects using `NodeNext` can import either public entry point:

```ts
import { ArgParser } from '@argetim/arg-parser/args';
import { Command, CommandRunner } from '@argetim/arg-parser/command_runner';
```

The root import (`@argetim/arg-parser`) is an alias for the `args` API. The `command_runner` subpath also exports `UsageException`. There are no supported deep imports into implementation files.

## Parse options

Create an `ArgParser`, register flags and values, then parse an iterable of strings. In a Node program, pass `process.argv.slice(2)`:

```ts
import { ArgParser } from '@argetim/arg-parser/args';

const parser = new ArgParser();
parser.addOption('format', {
  abbr: 'f',
  allowed: ['text', 'json'],
  defaultsTo: 'text',
  help: 'Output format',
});
parser.addFlag('verbose', { abbr: 'v', help: 'Show details' });
parser.addMultiOption('include', { abbr: 'I', help: 'Add an include path' });

const results = parser.parse(process.argv.slice(2));
console.log(results.option('format'));
console.log(results.flag('verbose'));
console.log(results.multiOption('include'));
console.log(results.rest); // positional arguments
```

Supported forms include `--format=json`, `--format json`, `-fjson`, and `-f json`. Flags accept `--verbose` and `-v`; negatable flags also accept `--no-verbose`. Short flags can be grouped (for example, `-vq`). Use `--` to end option parsing. Multi-options can repeat and split comma-separated values by default; set `splitCommas: false` to keep commas inside a value.

`addOption`, `addFlag`, and `addMultiOption` accept aliases, defaults, help text, and typed callbacks. Single-value options can constrain values with `allowed` and can be marked `mandatory`. Callbacks run after parsing and receive the resolved value, including the configured default when one applies. `wasParsed(name)` distinguishes an explicitly supplied value from its default. `ArgParser.allowAnything()` treats its input as positional arguments.

The parser also supports commands with their own options:

```ts
const parser = new ArgParser();
const deploy = parser.addCommand('deploy');
deploy.addFlag('dry-run', { help: 'Show actions without applying them' });

const results = parser.parse(['deploy', '--dry-run']);
console.log(results.command?.flag('dry-run'));
```

Set `allowTrailingOptions: false` when constructing a parser to stop option parsing at the first positional argument. `parser.usage` returns formatted help text, and `usageLineLength` controls wrapping.

## Command runners

For applications with executable commands, subclass `Command` and register it with a `CommandRunner`. A runner handles command selection, built-in help, usage errors, aliases, and asynchronous `run()` implementations.

```ts
import { Command, CommandRunner } from '@argetim/arg-parser/command_runner';

class GreetCommand extends Command<void> {
  readonly name = 'greet';
  readonly description = 'Greet someone.';

  constructor() {
    super();
    this.argParser.addOption('name', { defaultsTo: 'world' });
  }

  override run(): void {
    console.log(`Hello, ${this.argResults?.option('name')}!`);
  }
}

const runner = new CommandRunner<void>('hello', 'A small greeting tool.');
runner.addCommand(new GreetCommand());
await runner.run(process.argv.slice(2));
```

Commands can register child commands with `addSubcommand()`, define aliases, and customize `usageFooter`, `takesArguments`, or `hidden`. Pass an `output` function to `CommandRunner` to capture usage text instead of writing it to the console. `run()` resolves to the selected command's return value, or `null` when help is displayed.

## Development

```sh
npm test
npm run typecheck
npm run build
npm run test:package
npm run check:example
```

`test:package` builds the package and exercises its published entry points. `check:example` type-checks and runs the TypeScript example against the built package.
