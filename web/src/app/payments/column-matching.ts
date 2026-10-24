import type { ColumnMapping, ColumnRole, SampleStatement } from '../data/models';

// "Match the columns" for a statement whose layout is not known: what each column of the file can be called, and the
// changes a person makes to the guessed mapping. Pure functions; reading the rows is `readRows` in domain/statement-import.ts.

/**
 * The meanings a column can be given, in the order the choice lists them. Money out is a meaning of its own only while it has its own
 * column; with a minus sign it is the amount's sign.
 */
export function roleChoices(moneyOut: ColumnMapping['moneyOut']): ColumnRole[] {
  return moneyOut === 'column'
    ? ['date', 'amount', 'amountOut', 'who', 'purpose', 'ignore']
    : ['date', 'amount', 'who', 'purpose', 'ignore'];
}

/**
 * The mapping with column `index` given `role`. Every meaning but `ignore` belongs to one column, so giving it takes it from
 * the column that had it, which is then ignored. A new mapping; the old one is not changed.
 */
export function withRole(mapping: ColumnMapping, index: number, role: ColumnRole): ColumnMapping {
  const roles = mapping.roles.map((current, i): ColumnRole => {
    if (i === index) return role;
    return role !== 'ignore' && current === role ? 'ignore' : current;
  });
  return { ...mapping, roles };
}

/**
 * The mapping with money out shown the other way. A column of money out has no use once it is shown with a minus sign, so it is
 * ignored then. The same mapping comes back when money out is shown that way already.
 */
export function withMoneyOut(
  mapping: ColumnMapping,
  moneyOut: ColumnMapping['moneyOut'],
): ColumnMapping {
  if (mapping.moneyOut === moneyOut) return mapping;
  const roles = mapping.roles.map((role): ColumnRole =>
    moneyOut === 'minus' && role === 'amountOut' ? 'ignore' : role,
  );
  return { roles, moneyOut };
}

/** The first filled cells of a column, so the person can tell what it holds. Empty for a column no row fills, or one the file does not have. */
export function columnSamples(statement: SampleStatement, index: number, count = 2): string[] {
  return statement.cells
    .map((cells) => (cells[index] ?? '').trim())
    .filter((cell) => cell !== '')
    .slice(0, count);
}
