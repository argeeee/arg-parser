/** Pads `source` with spaces until it reaches `length` characters. */
export function padRight(source: string, length: number): string {
  return source + ' '.repeat(Math.max(0, length - source.length));
}

/** Wraps each line of text while keeping its leading indentation. */
export function wrapText(
  text: string,
  options: { readonly length?: number; readonly hangingIndent?: number } = {},
): string {
  const { length, hangingIndent = 0 } = options;
  if (length === undefined) return text;

  const result: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trimStart();
    const leadingWhitespace = line.slice(0, line.length - trimmed.length);
    let notIndented: string[];

    if (hangingIndent !== 0) {
      const firstLines = wrapTextAsLines(trimmed, { length: length - leadingWhitespace.length });
      const first = firstLines.shift() ?? '';
      notIndented = [first];
      const remainder = trimmed.slice(first.length).trimStart();
      if (firstLines.length > 0) {
        notIndented.push(...wrapTextAsLines(remainder, {
          length: length - leadingWhitespace.length - hangingIndent,
        }));
      }
    } else {
      notIndented = wrapTextAsLines(trimmed, { length: length - leadingWhitespace.length });
    }

    let indent = '';
    for (const part of notIndented) {
      if (part.length === 0) {
        result.push('');
      } else {
        result.push(`${indent}${leadingWhitespace}${part}`);
        indent ||= ' '.repeat(hangingIndent);
      }
    }
  }
  return result.join('\n');
}

/** Wraps text into trimmed lines, accounting for an existing start column. */
export function wrapTextAsLines(
  text: string,
  options: { readonly start?: number; readonly length?: number } = {},
): string[] {
  const { start = 0, length } = options;
  if (start < 0) throw new RangeError('start must be non-negative');
  if (length === undefined) return text.split('\n');

  const effectiveLength = Math.max(length - start, 10);
  const result: string[] = [];
  for (const originalLine of text.split('\n')) {
    const line = originalLine.trim();
    if (line.length <= effectiveLength) {
      result.push(line);
      continue;
    }

    let currentLineStart = 0;
    let lastWhitespace: number | undefined;
    let i = 0;
    while (i < line.length) {
      if (isWhitespace(line.charCodeAt(i))) lastWhitespace = i;
      if (i - currentLineStart >= effectiveLength) {
        if (lastWhitespace !== undefined) i = lastWhitespace;
        result.push(line.slice(currentLineStart, i).trim());
        while (i < line.length && isWhitespace(line.charCodeAt(i))) i++;
        currentLineStart = i;
        lastWhitespace = undefined;
      } else {
        i++;
      }
    }
    result.push(line.slice(currentLineStart).trim());
  }
  return result;
}

function isWhitespace(code: number): boolean {
  return (code >= 0x0009 && code <= 0x000d) || code === 0x0020 || code === 0x0085 ||
    code === 0x1680 || code === 0x180e || (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 || code === 0x2029 || code === 0x202f || code === 0x205f ||
    code === 0x3000 || code === 0xfeff;
}
