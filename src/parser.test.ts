import { describe, expect, it } from 'vitest';
import { ArgParser } from './args.js';
import { ArgParserException } from './errors.js';

describe('ArgParser.parse', () => {
  it('parses long options, attached values, aliases, and negated flags', () => {
    const parser = new ArgParser();
    parser.addOption('format', { aliases: ['f'], allowed: ['json', 'text'] });
    parser.addFlag('verbose', { abbr: 'v', defaultsTo: true });
    const result = parser.parse(['--f=json', '--no-verbose']);

    expect(result.option('format')).toBe('json');
    expect(result.flag('verbose')).toBe(false);
    expect(result.wasParsed('format')).toBe(true);
    expect(result.wasParsed('verbose')).toBe(true);
  });

  it('parses short flag groups and attached or following option values', () => {
    const parser = new ArgParser();
    parser.addFlag('all', { abbr: 'a' });
    parser.addFlag('verbose', { abbr: 'v' });
    parser.addOption('mode', { abbr: 'm' });
    const result = parser.parse(['-av', '-mfast']);
    expect(result.flag('all')).toBe(true);
    expect(result.flag('verbose')).toBe(true);
    expect(result.option('mode')).toBe('fast');
    expect(parser.parse(['-m', 'slow']).option('mode')).toBe('slow');
  });

  it('preserves terminator, rest, original arguments, and trailing option behavior', () => {
    const args = ['--verbose', 'file', '--', '--not-an-option'];
    const parser = new ArgParser();
    parser.addFlag('verbose');
    const result = parser.parse(args);
    args.push('later');
    expect(result.arguments).toEqual(['--verbose', 'file', '--', '--not-an-option']);
    expect(result.rest).toEqual(['file', '--not-an-option']);
    expect(Object.isFrozen(result.rest)).toBe(true);

    const stopAtFirstWord = new ArgParser({ allowTrailingOptions: false });
    stopAtFirstWord.addFlag('verbose');
    expect(stopAtFirstWord.parse(['file', '--verbose']).rest).toEqual(['file', '--verbose']);
  });

  it('splits repeated multi-options, including empty comma segments', () => {
    const parser = new ArgParser();
    parser.addMultiOption('tag');
    const result = parser.parse(['--tag=a,,b,', '--tag', 'c']);
    expect(result.multiOption('tag')).toEqual(['a', '', 'b', '', 'c']);
    expect(Object.isFrozen(result.multiOption('tag'))).toBe(true);
  });

  it('validates comma-split allowed values and preserves an option-looking value', () => {
    const parser = new ArgParser();
    parser.addMultiOption('mode', { allowed: ['debug', 'release'] });
    parser.addOption('file');
    const result = parser.parse(['--mode=debug,release', '--file', '--unknown']);
    expect(result.multiOption('mode')).toEqual(['debug', 'release']);
    expect(result.option('file')).toBe('--unknown');
    expect(() => parser.parse(['--mode=debug,profile'])).toThrow('not an allowed value');
  });

  it('validates allowed values and attaches parser argument metadata', () => {
    const parser = new ArgParser();
    parser.addOption('mode', { allowed: ['safe'] });
    expect(() => parser.parse(['--mode=unsafe'])).toThrow(ArgParserException);
    try {
      parser.parse(['--mode=unsafe']);
    } catch (error) {
      expect(error).toMatchObject({ argumentName: '--mode' });
    }
  });

  it('runs callbacks in registration order with parsed and default values', () => {
    const calls: string[] = [];
    const parser = new ArgParser();
    parser.addFlag('enabled', { callback: (value) => calls.push(`flag:${value}`) });
    parser.addOption('mode', { defaultsTo: 'safe', callback: (value) => calls.push(`mode:${value}`) });
    parser.addMultiOption('tag', { callback: (value) => calls.push(`tags:${value.join(',')}`) });
    parser.parse(['--enabled']);
    expect(calls).toEqual(['flag:true', 'mode:safe', 'tags:']);
  });

  it('uses null for absent single values in generic access and callbacks', () => {
    let callbackValue: string | null | undefined = undefined;
    const parser = new ArgParser();
    parser.addOption('value', { callback: (value) => { callbackValue = value; } });
    const result = parser.parse([]);
    expect(result.value('value')).toBeNull();
    expect(result.option('value')).toBeNull();
    expect(callbackValue).toBeNull();
  });

  it('reports missing values, invalid flags, mandatory values, and lookup errors', () => {
    const parser = new ArgParser();
    parser.addFlag('verbose');
    parser.addOption('mode', { mandatory: true });
    expect(() => parser.parse(['--verbose=true'])).toThrow('should not be given a value');
    expect(() => parser.parse(['--mode'])).toThrow('Missing argument');
    expect(() => parser.parse([])).toThrow('is mandatory');
    const result = new ArgParser().parse([]);
    expect(() => result.value('missing')).toThrow('Could not find an option');
  });

  it('treats allowAnything input as positional without invoking callbacks', () => {
    const parser = ArgParser.allowAnything();
    const result = parser.parse(['--unknown', 'value']);
    expect(result.rest).toEqual(['--unknown', 'value']);
    expect(result.arguments).toEqual(['--unknown', 'value']);
  });
});
