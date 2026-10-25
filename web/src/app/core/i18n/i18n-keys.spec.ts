import en from '../../../../public/i18n/en.json';
import de from '../../../../public/i18n/de.json';
import ar from '../../../../public/i18n/ar.json';
import { HELP_ANSWERS, HELP_TOPICS } from '../../data/help';
import { TERM_KEYS } from './term-keys';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

interface HelpTexts {
  topics?: Record<string, unknown>;
  answers?: Record<string, { q?: unknown; a?: unknown } | undefined>;
}

/** The `help` block of a translation file, read loosely so a missing text fails a test instead of the build. */
function helpOf(file: object): HelpTexts {
  return ((file as Record<string, unknown>)['help'] ?? {}) as HelpTexts;
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

  it('has a history text for every change to people and support access, naming who did it', () => {
    const keys = [
      'personInvited',
      'invitationCancelled',
      'personJoined',
      'roleChanged',
      'personRemoved',
      'personLeft',
      'ownerChanged',
      'supportOn',
      'supportOff',
    ];
    for (const lang of [en, de, ar]) {
      const history = lang.history as Record<string, string>;
      for (const key of keys) expect(history[key], key).toMatch(/\{\{(by|name)\}\}/);
    }
    expect(en.history.personInvited).toContain('{{email}}');
    expect(en.history.personInvited).toContain('{{role}}');
    expect(en.history.supportOn).toContain('{{until}}');
  });

  it('has a history text for a payment marked as paid with own money and for adding the Own money account, as for the cash box', () => {
    for (const lang of [en, de, ar]) {
      expect(lang.history.paidWithOwnMoney).toBeTruthy();
      expect(lang.history.ownMoneyAdded).toBeTruthy();
      expect(lang.history.paidWithOwnMoney).not.toBe(lang.history.paidInCash);
    }
    expect(en.history.paidWithOwnMoney).toBe('You marked it as paid with your own money');
    expect(de.history.paidWithOwnMoney).toBe('Du hast sie als mit eigenem Geld bezahlt markiert');
  });

  it('has a history text for a closed month, naming the month and who closed it, and one for a month its VAT return closed', () => {
    for (const lang of [en, de, ar]) {
      expect(lang.history.monthClosed).toContain('{{month}}');
      expect(lang.history.monthClosed).toContain('{{by}}');
      // No person behind it, so no {{by}}.
      expect(lang.history.monthClosedByReturn).toContain('{{month}}');
      expect(lang.history.monthClosedByReturn).not.toContain('{{by}}');
    }
  });

  it('has a history text for a self-issued receipt (its number) and for the VAT it takes off the payment', () => {
    for (const lang of [en, de, ar]) {
      expect(lang.history.selfIssued).toContain('{{number}}');
      expect(lang.history.vatRemovedSelfIssued).toBeTruthy();
    }
    expect(en.history.vatRemovedSelfIssued).toBe('VAT removed: self-issued receipt');
  });

  it('has a name for every role, and what the three roles that can be given can and can not do', () => {
    for (const lang of [en, de, ar]) {
      const roles = lang.roles as Record<string, Record<string, string>>;
      for (const role of ['owner', 'full', 'receipts', 'advisor']) {
        expect(roles[role]['name'], role).toBeTruthy();
      }
      for (const role of ['full', 'receipts', 'advisor']) {
        expect(roles[role]['can'], role).toBeTruthy();
        expect(roles[role]['cant'], role).toBeTruthy();
      }
    }
  });

  it('has the German tax terms with label, de and explain', () => {
    for (const term of TERM_KEYS) {
      for (const part of ['label', 'de', 'explain']) {
        expect(enKeys).toContain(`terms.${term}.${part}`);
      }
    }
  });

  it('every answer has a question and a text in all three languages, and no text is a placeholder', () => {
    const english = helpOf(en);
    for (const [lang, file] of Object.entries({ en, de, ar })) {
      const help = helpOf(file);
      const texts: [key: string, text: unknown, englishText: unknown][] = [
        ...HELP_TOPICS.map(
          (topic) =>
            [`help.topics.${topic}`, help.topics?.[topic], english.topics?.[topic]] as [
              string,
              unknown,
              unknown,
            ],
        ),
        ...HELP_ANSWERS.flatMap(({ id }) =>
          (['q', 'a'] as const).map(
            (part) =>
              [
                `help.answers.${id}.${part}`,
                help.answers?.[id]?.[part],
                english.answers?.[id]?.[part],
              ] as [string, unknown, unknown],
          ),
        ),
      ];

      for (const [key, text, englishText] of texts) {
        const where = `${lang} ${key}`;
        expect(typeof text, `${where} is missing`).toBe('string');
        const value = text as string;
        expect(value.trim(), `${where} is empty`).not.toBe('');
        expect(value, `${where} has spaces around it`).toBe(value.trim());
        expect(value, `${where} is a placeholder`).not.toMatch(
          /TODO|TBD|FIXME|lorem|placeholder|xxx/i,
        );
        // Plain text: no HTML, no Markdown, no interpolation.
        expect(value, `${where} is not plain text`).not.toMatch(/[<>*`#]|\{\{|\]\(/);
        if (lang !== 'en') expect(value, `${where} is a copy of the English`).not.toBe(englishText);
        if (lang === 'ar') {
          // Western digits only, as on bank statements and receipts.
          const digits = value.match(/\p{Nd}/gu)?.join('') ?? '';
          expect(digits, `${where} has digits other than 0-9`).toMatch(/^[0-9]*$/);
        }
      }

      for (const { id } of HELP_ANSWERS) {
        expect(help.answers?.[id]?.q, `${lang} ${id}.q is a question`).toMatch(/[?؟]$/);
        // One to three short paragraphs, split by one blank line.
        const paragraphs = String(help.answers?.[id]?.a).split('\n\n');
        expect(paragraphs.length, `${lang} ${id}.a paragraphs`).toBeLessThanOrEqual(3);
        for (const paragraph of paragraphs) {
          expect(paragraph, `${lang} ${id}.a has an empty or broken paragraph`).toMatch(
            /^\S[^\n]*\S$/,
          );
        }
      }
    }
  });

  it('an answer that talks about the VAT return says it is for a business that charges VAT', () => {
    // The same Help for everyone, and a Kleinunternehmer has no VAT return: the condition is said in words.
    const answers = helpOf(en).answers ?? {};
    for (const { id } of HELP_ANSWERS) {
      const text = String(answers[id]?.a ?? '');
      if (/VAT return/.test(text)) {
        expect(text, `en ${id}`).toMatch(/if your business charges VAT/i);
      }
    }
  });

  it('every answer names its German terms by their German word, in all three languages', () => {
    for (const [lang, file] of Object.entries({ en, de, ar })) {
      const help = helpOf(file);
      const terms = file.terms as unknown as Record<string, { de: string }>;
      for (const { id, terms: keys } of HELP_ANSWERS) {
        const text = `${String(help.answers?.[id]?.q ?? '')} ${String(help.answers?.[id]?.a ?? '')}`;
        for (const key of keys) {
          expect(text, `${lang} ${id} names ${key}`).toContain(terms[key].de);
        }
      }
    }
  });

  it('an English or Arabic answer that names a German term by its German word offers it as a chip', () => {
    // In English and Arabic a German word is there to be explained. (German writes its own words, so it is not checked.)
    const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const [lang, file] of Object.entries({ en, ar })) {
      const help = helpOf(file);
      const terms = file.terms as unknown as Record<string, { de: string }>;
      for (const { id, terms: keys } of HELP_ANSWERS) {
        const text = `${String(help.answers?.[id]?.q ?? '')} ${String(help.answers?.[id]?.a ?? '')}`;
        for (const key of TERM_KEYS) {
          // The whole word: "Rechnung" is not named by "E-Rechnung" or "XRechnung".
          const named = new RegExp(
            `(?<![\\p{L}\\p{N}-])${escape(terms[key].de)}(?![\\p{L}\\p{N}-])`,
            'u',
          );
          if (named.test(text)) expect(keys, `${lang} ${id} names ${terms[key].de}`).toContain(key);
        }
      }
    }
  });
});
