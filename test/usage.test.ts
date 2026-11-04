import { describe, expect, it } from 'vitest';
import { ArgParser } from '../src/args.js';

describe('ArgParser usage', () => {
  it('aligns abbreviations, options, help, defaults, and insertion order', () => {
    const parser = new ArgParser();
    parser.addFlag('mode', { abbr: 'm', help: 'The mode' });
    parser.addOption('format', { defaultsTo: 'json', help: 'Output format' });
    parser.addMultiOption('tag', { help: 'Tags', defaultsTo: ['one', 'two'] });

    expect(parser.usage).toBe([
      '-m, --[no-]mode    The mode',
      '    --format       Output format',
      '                   (defaults to "json")',
      '    --tag          Tags',
      '                   (defaults to "one", "two")',
    ].join('\n'));
  });

  it('renders allowed values and help descriptions with default markers', () => {
    const parser = new ArgParser();
    parser.addOption('color', {
      help: 'Choose a color',
      defaultsTo: 'blue',
      allowed: ['red', 'blue'],
      allowedHelp: new Map([['red', 'Warm'], ['blue', 'Cool']]),
    });

    expect(parser.usage).toBe([
      '--color                   Choose a color',
      '',
      '      [red]               Warm',
      '      [blue] (default)    Cool',
    ].join('\n'));
  });

  it('omits hidden options, displays mandatory and negated options, and keeps separators in place', () => {
    const parser = new ArgParser();
    parser.addFlag('first', { help: 'First' });
    parser.addSeparator('Other options:');
    parser.addOption('secret', { hide: true, help: 'Hidden' });
    parser.addOption('path', { mandatory: true, valueHelp: 'FILE', help: 'A file' });
    parser.addFlag('quiet', { negatable: false, hideNegatedUsage: false });

    expect(parser.usage).toBe([
      '--[no-]first                 First',
      '',
      'Other options:',
      '--path=<FILE> (mandatory)    A file',
      '--quiet                      ',
    ].join('\n'));
  });

  it('wraps help text to the configured line length', () => {
    const parser = new ArgParser({ usageLineLength: 48 });
    parser.addFlag('long', { help: 'This is a long help description that should wrap.' });
    expect(parser.usage).toBe([
      '--[no-]long    This is a long help description',
      '               that should wrap.',
    ].join('\n'));
  });

  it('does not show parser commands in usage', () => {
    const parser = new ArgParser();
    parser.addCommand('build');
    expect(parser.usage).toBe('');
  });
});
