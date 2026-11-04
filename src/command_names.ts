/** Returns command names after rejecting duplicates within the command itself. */
export function commandNames(name: string, aliases: readonly string[]): string[] {
  const names = [name, ...aliases];
  if (new Set(names).size !== names.length) {
    throw new TypeError(`Duplicate command "${name}".`);
  }
  return names;
}
