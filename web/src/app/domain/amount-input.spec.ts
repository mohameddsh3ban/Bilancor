import { amountInput, parseDocAmount } from './amount-input';

describe('parseDocAmount', () => {
  it.each([
    ['71,39', 7139],
    ['71.39', 7139],
    ['49,90', 4990],
    ['49.90', 4990],
    ['1.234,50', 123450],
    ['120', 12000],
  ])('reads %s as %i cents', (typed, cents) => {
    expect(parseDocAmount(typed)).toBe(cents);
  });

  it.each(['', '0', '0,00', '-5', 'abc'])('refuses %j', (typed) => {
    expect(parseDocAmount(typed)).toBeNull();
  });
});

describe('amountInput', () => {
  it('writes cents with two decimals and the decimal mark of the language', () => {
    expect(amountInput(238000, 'en')).toBe('2380.00');
    expect(amountInput(5, 'en')).toBe('0.05');
    expect(amountInput(7139, 'de')).toBe('71,39');
    expect(amountInput(7139, 'ar')).toBe('71.39');
  });
});
