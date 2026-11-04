export const OptionType = {
  flag: 'flag',
  single: 'single',
  multiple: 'multiple',
} as const;

export type OptionType = (typeof OptionType)[keyof typeof OptionType];

/** Public metadata contract for a registered command-line option. */
export abstract class Option {
  abstract readonly name: string;
  abstract readonly abbr: string | undefined;
  abstract readonly type: OptionType;
  abstract readonly defaultsTo:
    | boolean
    | string
    | readonly string[]
    | null
    | undefined;
  abstract readonly aliases: readonly string[];
}
