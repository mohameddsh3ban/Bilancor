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

  it('the kind label above a review card is a short state, never a question (the card asks its own)', () => {
    const files = { en, de, ar };
    for (const [lang, file] of Object.entries(files)) {
      for (const [problem, label] of Object.entries(file.review.kind)) {
        expect(label, `${lang} review.kind.${problem}`).not.toMatch(/[?؟]/);
      }
    }
  });

  it('has a history text for tax changes, connecting and renewing a bank, and adding a cash box', () => {
    for (const key of ['taxChanged', 'bankConnected', 'bankRenewed', 'cashAdded']) {
      expect(enKeys).toContain(`history.${key}`);
    }
    expect(en.history.bankConnected).toContain('{{account}}');
    expect(en.history.bankConnected).toContain('{{bank}}');
    expect(en.history.bankRenewed).toContain('{{bank}}');
  });

  it('has the German tax terms with label, de and explain', () => {
    const terms = [
      'ustva',
      'euer',
      'kleinunternehmer',
      'skr03',
      'eigenbeleg',
      'eingangsbeleg',
      'ausgangsbeleg',
      'freiberufler',
      'gewerbe',
      'dauerfristverlaengerung',
      'istVersteuerung',
      'sollVersteuerung',
      'steuernummer',
      'ustIdNr',
      'finanzamt',
      'umsatzsteuer',
      'vorsteuer',
      'elster',
      'einkommensteuererklaerung',
      'feststellungserklaerung',
      'umsatzsteuererklaerung',
      'uebertragungsprotokoll',
    ];
    for (const term of terms) {
      for (const part of ['label', 'de', 'explain']) {
        expect(enKeys).toContain(`terms.${term}.${part}`);
      }
    }
  });
});
