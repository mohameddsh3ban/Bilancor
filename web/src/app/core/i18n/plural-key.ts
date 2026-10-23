/** The translation key for a count: `base.one` for one thing and `base.many` for any other number. */
export function pluralKey(base: string, count: number): string {
  return `${base}.${count === 1 ? 'one' : 'many'}`;
}
