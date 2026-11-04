/** Error raised when parser configuration or command-line input is invalid. */
export class ArgParserException extends Error {
  readonly commands: readonly string[];
  readonly argumentName: string | undefined;
  readonly source: string | undefined;
  readonly offset: number | undefined;

  constructor(
    message: string,
    commands: Iterable<string> = [],
    argumentName?: string,
    source?: string,
    offset?: number,
  ) {
    super(message);
    this.name = 'ArgParserException';
    this.commands = Object.freeze([...commands]);
    this.argumentName = argumentName;
    this.source = source;
    this.offset = offset;
  }
}

/** Error presented to users when command usage is invalid. */
export class UsageException extends Error {
  readonly usage: string;

  constructor(message: string, usage: string) {
    super(message);
    this.name = 'UsageException';
    this.usage = usage;
  }

  override toString(): string {
    return `${this.message}\n\n${this.usage}`;
  }
}
