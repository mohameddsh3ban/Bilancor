import type { ColumnMapping, SampleStatement } from '../data/models';
import { columnSamples, roleChoices, withMoneyOut, withRole } from './column-matching';

const mapping = (
  roles: ColumnMapping['roles'],
  moneyOut: ColumnMapping['moneyOut'] = 'minus',
): ColumnMapping => ({ roles, moneyOut });

const STATEMENT: SampleStatement = {
  id: 'test',
  fileName: 'test.csv',
  format: 'unknownCsv',
  bankLabel: null,
  header: ['Datum', 'Name', 'Betrag'],
  cells: [
    ['20.10.2026', 'Bettina Schulz', '60,00'],
    ['', '', ''],
    ['17.10.2026', 'Hiscox', '-32,00'],
    ['14.10.2026', 'Papeterie Wolf', '-24,90'],
  ],
  mapping: null,
  meta: [],
};

describe('roleChoices', () => {
  it('offers date, amount, who, what for and ignore while money out has a minus sign', () => {
    expect(roleChoices('minus')).toEqual(['date', 'amount', 'who', 'purpose', 'ignore']);
  });

  it('adds money out when it has its own column', () => {
    expect(roleChoices('column')).toEqual([
      'date',
      'amount',
      'amountOut',
      'who',
      'purpose',
      'ignore',
    ]);
  });
});

describe('withRole', () => {
  it('gives a column a meaning and leaves the others as they are', () => {
    expect(withRole(mapping(['date', 'ignore', 'amount']), 1, 'who')).toEqual(
      mapping(['date', 'who', 'amount']),
    );
  });

  it('takes a meaning from the column that had it, which is then ignored: one column for each meaning', () => {
    expect(withRole(mapping(['date', 'who', 'amount']), 0, 'who')).toEqual(
      mapping(['who', 'ignore', 'amount']),
    );
  });

  it('lets any number of columns be ignored', () => {
    expect(withRole(mapping(['ignore', 'who', 'ignore']), 2, 'ignore')).toEqual(
      mapping(['ignore', 'who', 'ignore']),
    );
    expect(withRole(mapping(['date', 'who', 'amount']), 2, 'ignore')).toEqual(
      mapping(['date', 'who', 'ignore']),
    );
  });

  it('keeps how money out is shown, and gives back a new mapping', () => {
    const before = mapping(['date', 'who', 'amount'], 'column');
    const after = withRole(before, 1, 'ignore');
    expect(after.moneyOut).toBe('column');
    expect(after).not.toBe(before);
    expect(before.roles).toEqual(['date', 'who', 'amount']);
  });
});

describe('withMoneyOut', () => {
  it('shows money out its own way and leaves the columns alone when it has a minus sign to start with', () => {
    expect(withMoneyOut(mapping(['date', 'who', 'amount']), 'column')).toEqual(
      mapping(['date', 'who', 'amount'], 'column'),
    );
  });

  it('ignores the money out column when money out goes back to a minus sign, which has no use for it', () => {
    expect(
      withMoneyOut(mapping(['date', 'amount', 'amountOut', 'who'], 'column'), 'minus'),
    ).toEqual(mapping(['date', 'amount', 'ignore', 'who'], 'minus'));
  });

  it('changes nothing, and gives back the same mapping, when money out is shown that way already', () => {
    const before = mapping(['date', 'who', 'amount']);
    expect(withMoneyOut(before, 'minus')).toBe(before);
  });
});

describe('columnSamples', () => {
  it('is the first filled cells of the column, to recognise it by', () => {
    expect(columnSamples(STATEMENT, 0)).toEqual(['20.10.2026', '17.10.2026']);
    expect(columnSamples(STATEMENT, 2, 3)).toEqual(['60,00', '-32,00', '-24,90']);
  });

  it('is empty for a column no row fills, or one the file does not have', () => {
    expect(
      columnSamples(
        {
          ...STATEMENT,
          cells: [
            ['', 'x', ''],
            ['', 'y'],
          ],
        },
        0,
      ),
    ).toEqual([]);
    expect(columnSamples(STATEMENT, 7)).toEqual([]);
  });
});
