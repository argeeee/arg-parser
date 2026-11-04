import { describe, expect, it } from 'vitest';
import { padRight, wrapText, wrapTextAsLines } from './utils.js';

describe('usage text utilities', () => {
  it('pads only when needed', () => {
    expect(padRight('foo', 6)).toBe('foo   ');
    expect(padRight('longer', 2)).toBe('longer');
  });

  it('wraps on whitespace and splits unbroken words at the minimum width', () => {
    expect(wrapText('This is a long line that needs to be wrapped.', { length: 40 }))
      .toBe('This is a long line that needs to be\nwrapped.');
    expect(wrapTextAsLines('0123456789'.repeat(5), { length: 1 }))
      .toEqual(['0123456789', '0123456789', '0123456789', '0123456789', '0123456789']);
  });

  it('preserves indentation and hanging indentation across embedded newlines', () => {
    expect(wrapText('    This is an indented long line that needs wrapping.', { length: 40 }))
      .toBe('    This is an indented long line that\n    needs wrapping.');
    expect(wrapText('This is a long line that needs to be wrapped.', { length: 40, hangingIndent: 6 }))
      .toBe('This is a long line that needs to be\n      wrapped.');
  });

  it('preserves empty lines and original whitespace when wrapping is disabled', () => {
    expect(wrapTextAsLines(' first\n\n second')).toEqual([' first', '', ' second']);
    expect(wrapText('  keep this  ')).toBe('  keep this  ');
  });
});
