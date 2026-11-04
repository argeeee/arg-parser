import { describe, expect, it, vi } from 'vitest';
import { ArgParser } from './args.js';
import { OptionType } from './option.js';

describe('ArgParser grammar registration', () => {
  it('registers flags, single options, and multi-options in insertion order', () => {
    const parser = new ArgParser();
    parser.addFlag('verbose', { abbr: 'v', aliases: ['chatty'] });
    parser.addOption('format', { abbr: 'f', defaultsTo: 'text', allowed: ['text', 'json'] });
    parser.addMultiOption('include', { defaultsTo: ['one'], aliases: ['i'] });

    expect([...parser.options.keys()]).toEqual(['verbose', 'format', 'include']);
    expect(parser.findByNameOrAlias('chatty')?.name).toBe('verbose');
    expect(parser.findByNameOrAlias('i')?.name).toBe('include');
    expect(parser.findByAbbreviation('f')?.name).toBe('format');
    expect(parser.defaultFor('format')).toBe('text');
    expect(parser.defaultFor('include')).toEqual(['one']);
    expect(parser.findByNameOrAlias('verbose')?.type).toBe(OptionType.flag);
    expect(parser.findByNameOrAlias('include')?.splitCommas).toBe(true);
  });

  it('uses Dart-compatible defaults and snapshots option metadata', () => {
    const allowed = ['first', 'second'];
    const defaults = ['base'];
    const allowedHelp = new Map([['first', 'first mode']]);
    const callback = vi.fn();
    const parser = new ArgParser({ allowTrailingOptions: false, usageLineLength: 72 });
    parser.addOption('mode', { allowed, allowedHelp });
    parser.addMultiOption('tag', { defaultsTo: defaults, callback });
    allowed.push('mutated');
    defaults.push('mutated');
    allowedHelp.set('second', 'second mode');

    const mode = parser.findByNameOrAlias('mode');
    const tag = parser.findByNameOrAlias('tag');
    expect(parser.allowTrailingOptions).toBe(false);
    expect(parser.usageLineLength).toBe(72);
    expect(mode?.allowed).toEqual(['first', 'second']);
    expect(Object.isFrozen(mode?.allowed)).toBe(true);
    expect([...mode?.allowedHelp ?? []]).toEqual([['first', 'first mode']]);
    expect((mode?.allowedHelp as Map<string, string>).set).toBeUndefined();
    expect(tag?.defaultsTo).toEqual(['base']);
    expect(Object.isFrozen(tag?.defaultsTo)).toBe(true);
    expect(callback).not.toHaveBeenCalled();

    expect((parser.options as Map<string, unknown>).clear).toBeUndefined();
    expect(parser.findByNameOrAlias('mode')).toBe(mode);
  });

  it('creates child parsers and prevents callers from changing registered maps', () => {
    const parser = new ArgParser();
    const child = parser.addCommand('build');
    child.addFlag('release');
    const optionsView = parser.options as Map<string, unknown>;
    const commandsView = parser.commands as Map<string, unknown>;
    expect(optionsView.set).toBeUndefined();
    expect(commandsView.clear).toBeUndefined();

    expect(parser.commands.get('build')).toBe(child);
    expect(parser.commands.size).toBe(1);
    expect(parser.addCommand).toBeTypeOf('function');
    expect(() => parser.addCommand('build')).toThrow('Duplicate command "build".');
  });

  it('keeps previously acquired option and command views live and read-only', () => {
    const parser = new ArgParser();
    const optionsView = parser.options;
    const commandsView = parser.commands;

    parser.addFlag('verbose');
    const child = parser.addCommand('build');

    expect(parser.options).toBe(optionsView);
    expect(parser.commands).toBe(commandsView);
    expect(optionsView.has('verbose')).toBe(true);
    expect(optionsView.size).toBe(1);
    expect(commandsView.get('build')).toBe(child);
    expect(commandsView.size).toBe(1);
    expect((optionsView as Map<string, unknown>).set).toBeUndefined();
    expect((commandsView as Map<string, unknown>).delete).toBeUndefined();
  });

  it('rejects invalid names, abbreviations, collisions, and invalid constraints', () => {
    const parser = new ArgParser();
    for (const name of ['', '-bad', 'bad name', 'bad/name', 'bad\\name']) {
      expect(() => parser.addFlag(name)).toThrow(TypeError);
    }
    expect(() => parser.addOption('long', { abbr: 'xy' })).toThrow('Abbreviation must be null or have length 1.');
    expect(() => parser.addOption('hyphen', { abbr: '-' })).toThrow('Abbreviation cannot be "-".');
    expect(() => parser.addFlag('one', { abbr: 'o' })).not.toThrow();
    expect(() => parser.addOption('two', { abbr: 'o' })).toThrow('already used by "one"');
    expect(() => parser.addOption('two', { aliases: ['one'] })).toThrow('Duplicate option or alias');
    expect(() => parser.addOption('required', { mandatory: true, defaultsTo: 'x' })).toThrow('cannot be mandatory');
    expect(() => parser.addFlag('fixed', { negatable: false, hideNegatedUsage: true })).toThrow('hideNegatedUsage');
    expect(() => parser.defaultFor('missing')).toThrow('No option named missing');
  });

  it('supports allowAnything as an empty grammar and rejects grammar mutation', () => {
    const parser = ArgParser.allowAnything();
    expect(parser.allowsAnything).toBe(true);
    expect(parser.allowTrailingOptions).toBe(false);
    expect(parser.usage).toBe('');
    expect(parser.options.size).toBe(0);
    expect(parser.commands.size).toBe(0);
    expect(parser.findByNameOrAlias('x')).toBeUndefined();
    expect(parser.findByAbbreviation('x')).toBeUndefined();
    expect(() => parser.addFlag('x')).toThrow('addFlag');
    expect(() => parser.addOption('x')).toThrow('addOption');
    expect(() => parser.addMultiOption('x')).toThrow('addMultiOption');
    expect(() => parser.addCommand('x')).toThrow('addCommands');
    expect(() => parser.addSeparator('x')).toThrow('addSeparator');
    expect(() => { parser.defaultCommand = 'x'; }).toThrow('defaultCommand');
    expect(() => parser.defaultFor('x')).toThrow('No option named x');
  });
});
