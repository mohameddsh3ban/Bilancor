import en from '../../../../public/i18n/en.json';
import de from '../../../../public/i18n/de.json';
import ar from '../../../../public/i18n/ar.json';
import { TERM_KEYS, type TermKey } from './term-keys';

const keysOf = (terms: Record<string, unknown>): string[] =>
  Object.keys(terms).filter((key) => key !== 'whatIs');

describe('TERM_KEYS', () => {
  it('lists every terms.* key except whatIs, eigenbeleg included', () => {
    for (const lang of [en, de, ar]) {
      expect([...TERM_KEYS].sort()).toEqual(keysOf(lang.terms).sort());
    }
    expect(TERM_KEYS).toContain('eigenbeleg');
    expect(TERM_KEYS).not.toContain('whatIs' as TermKey);
  });

  it('lists each key once', () => {
    expect(new Set(TERM_KEYS).size).toBe(TERM_KEYS.length);
  });
});
