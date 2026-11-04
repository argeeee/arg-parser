import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = fileURLToPath(new URL('../', import.meta.url));

for (const declaration of ['index.d.ts', 'args.d.ts', 'command_runner.d.ts']) {
  assert.equal(existsSync(`${packageRoot}/dist/${declaration}`), true, `missing dist/${declaration}`);
}

const root = require('@arge/arg-parser');
const args = require('@arge/arg-parser/args');
const commands = require('@arge/arg-parser/command_runner');
const argsEsm = await import('@arge/arg-parser/args');
const commandsEsm = await import('@arge/arg-parser/command_runner');

assert.equal(root.ArgParser, args.ArgParser);
assert.equal(argsEsm.ArgParser, args.ArgParser);
assert.equal(typeof args.ArgResults, 'function');
assert.equal(typeof commands.Command, 'function');
assert.equal(typeof commands.CommandRunner, 'function');
assert.equal(typeof commands.UsageException, 'function');
assert.equal(commandsEsm.CommandRunner, commands.CommandRunner);

const parser = new args.ArgParser();
parser.addFlag('verbose', { abbr: 'v' });
parser.addOption('format', { defaultsTo: 'text' });
const results = parser.parse(['-v', '--format=json', 'input.txt']);
assert.equal(results.flag('verbose'), true);
assert.equal(results.option('format'), 'json');
assert.deepEqual(results.rest, ['input.txt']);

console.log('Package entry point smoke checks passed.');
