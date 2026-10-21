import en from '../../../../public/i18n/en.json';
import de from '../../../../public/i18n/de.json';
import ar from '../../../../public/i18n/ar.json';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('translation files', () => {
  const enKeys = flatten(en).sort();

  it('every en key exists in de and ar', () => {
    expect(flatten(de).sort()).toEqual(enKeys);
    expect(flatten(ar).sort()).toEqual(enKeys);
  });

  it('has the four German tax terms with label, de and explain', () => {
    for (const term of ['ustva', 'euer', 'kleinunternehmer', 'skr03']) {
      for (const part of ['label', 'de', 'explain']) {
        expect(enKeys).toContain(`terms.${term}.${part}`);
      }
    }
  });
});
