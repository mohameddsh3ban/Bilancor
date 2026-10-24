import en from '../../../public/i18n/en.json';
import de from '../../../public/i18n/de.json';
import ar from '../../../public/i18n/ar.json';
import { TERM_KEYS, type TermKey } from '../core/i18n/term-keys';
import {
  HELP_ANSWERS,
  KLEINUNTERNEHMER_TAXES_QUESTIONS,
  PAGE_QUESTIONS,
  TERM_PAGES,
  type HelpPage,
} from '../data/help';
import {
  helpPageOf,
  normalizeForSearch,
  pageQuestions,
  searchHelp,
  termsAZ,
  type HelpHit,
} from './help';

type TermTexts = { label: string; de: string; explain: string };
type SearchTexts = Parameters<typeof searchHelp>[1];

/** Every term with empty texts, so a spec only fills in the terms it is about. */
const BLANK_TERMS = Object.fromEntries(
  TERM_KEYS.map((key) => [key, { label: '', de: '', explain: '' }]),
) as Record<TermKey, TermTexts>;

const texts = (
  answers: SearchTexts['answers'],
  terms: Partial<Record<TermKey, TermTexts>> = {},
): SearchTexts => ({
  answers,
  terms: { ...BLANK_TERMS, ...terms },
});

/** The German word of every term, as the A–Z list takes it. */
const germanOf = (terms: object) =>
  Object.fromEntries(
    TERM_KEYS.map((key) => [key, { de: (terms as Record<TermKey, TermTexts>)[key].de }]),
  ) as Record<TermKey, { de: string }>;

describe('helpPageOf', () => {
  it('maps the pages of the app to the Help page they belong to', () => {
    const pages: [string, HelpPage][] = [
      ['/', 'start'],
      ['/payments', 'payments'],
      ['/payments/wd-t3', 'payments'],
      ['/payments/import', 'payments'],
      ['/payments/wd-t3/self-issued', 'payments'],
      ['/review', 'payments'],
      ['/documents', 'documents'],
      ['/documents/wd-d1', 'documents'],
      ['/invoices', 'invoices'],
      ['/invoices/new', 'invoices'],
      ['/invoices/wd-i1', 'invoices'],
      ['/invoices/wd-i1/edit', 'invoices'],
      ['/taxes', 'taxes'],
      ['/reports', 'reports'],
      ['/settings', 'settings'],
      ['/settings/tax', 'settings'],
      ['/settings/invoice', 'settings'],
      ['/settings/bank/connect', 'settings'],
      ['/account', 'settings'],
    ];
    for (const [url, page] of pages) expect(helpPageOf(url), url).toBe(page);
  });

  it('ignores a query and a fragment', () => {
    expect(helpPageOf('/taxes?tab=year')).toBe('taxes');
    expect(helpPageOf('/settings#people')).toBe('settings');
    expect(helpPageOf('/payments/wd-t3?filter=open#receipt')).toBe('payments');
    expect(helpPageOf('/?welcome=1')).toBe('start');
    expect(helpPageOf('/sign-in?next=%2Fpayments')).toBe('start');
  });

  it('falls back to Getting started for the pages Help does not know, and for no page at all', () => {
    for (const url of [
      '/print/month',
      '/print/payment/wd-t3',
      '/businesses/new',
      '/soon/help',
      '/sign-in',
      '/help',
      '/help/terms',
      '/payment',
      '/paymentsx',
      '/accounts',
      '',
      '#people',
      '?tab=year',
    ]) {
      expect(helpPageOf(url), url).toBe('start');
    }
    expect(helpPageOf(null)).toBe('start');
  });

  it('puts every answer link on the Help page its own route belongs to', () => {
    for (const answer of HELP_ANSWERS) {
      if (answer.link) expect(helpPageOf(answer.link.route), answer.id).toBe(answer.link.page);
    }
  });
});

describe('pageQuestions', () => {
  it('lists the questions of each page', () => {
    for (const page of Object.keys(PAGE_QUESTIONS) as HelpPage[]) {
      expect(pageQuestions(page, false), page).toEqual(PAGE_QUESTIONS[page]);
    }
  });

  it("starts a Kleinunternehmer's Taxes questions with the limit, and offers no VAT return question", () => {
    const questions = pageQuestions('taxes', true);
    expect(questions).toEqual(['klein-limit', 'close-month', 'export-advisor']);
    for (const id of questions)
      expect(
        HELP_ANSWERS.map((answer) => answer.id),
        id,
      ).toContain(id);
    expect(questions).not.toContain('vat-due');
    expect(questions).not.toContain('send-return');
    expect(questions).not.toContain('payment-blocks-send');
  });

  it('leaves every other page as it is for a Kleinunternehmer', () => {
    for (const page of Object.keys(PAGE_QUESTIONS) as HelpPage[]) {
      if (page !== 'taxes') expect(pageQuestions(page, true), page).toEqual(PAGE_QUESTIONS[page]);
    }
  });

  it('gives a list of its own, so changing it never changes the data', () => {
    const before = [...PAGE_QUESTIONS.taxes];
    pageQuestions('taxes', false).push('x');
    pageQuestions('taxes', true).push('x');
    expect(PAGE_QUESTIONS.taxes).toEqual(before);
    expect(KLEINUNTERNEHMER_TAXES_QUESTIONS).toEqual([
      'klein-limit',
      'close-month',
      'export-advisor',
    ]);
  });
});

describe('normalizeForSearch', () => {
  it('lower-cases and trims', () => {
    expect(normalizeForSearch('  Ausgangsbeleg ')).toBe('ausgangsbeleg');
    expect(normalizeForSearch('   ')).toBe('');
  });

  it('writes an umlaut and its two-letter spelling the same way, and ß as ss', () => {
    expect(normalizeForSearch('Übertragung')).toBe(normalizeForSearch('Uebertragung'));
    expect(normalizeForSearch('Übertragung')).toBe('ubertragung');
    expect(normalizeForSearch('Käse')).toBe(normalizeForSearch('kaese'));
    expect(normalizeForSearch('Löschen')).toBe(normalizeForSearch('loeschen'));
    expect(normalizeForSearch('Straße')).toBe('strasse');
  });

  it('drops other accents and keeps Arabic letters', () => {
    expect(normalizeForSearch('Café')).toBe('cafe');
    expect(normalizeForSearch('فاتورة')).toBe('فاتورة');
  });

  it('treats a run of spaces or a line break as one space', () => {
    expect(normalizeForSearch('VAT  return\n\nsent')).toBe('vat return sent');
  });
});

describe('searchHelp', () => {
  const realTerms = { answers: {}, terms: en.terms } as unknown as SearchTexts;

  const termHits = (hits: HelpHit[]) =>
    hits.flatMap((hit) => (hit.kind === 'term' ? [hit.key] : []));

  it('ignores case, spaces and the spelling of umlauts', () => {
    for (const query of ['Ausgangsbeleg', 'ausgangsbeleg', '  AUSGANGSBELEG  ']) {
      expect(termHits(searchHelp(query, realTerms)), query).toContain('ausgangsbeleg');
    }
    for (const query of ['Übertragung', 'uebertragung', 'ubertragung', 'ÜBERTRAGUNGSPROTOKOLL']) {
      expect(termHits(searchHelp(query, realTerms)), query).toContain('uebertragungsprotokoll');
    }
  });

  it('finds nothing for a blank query', () => {
    expect(searchHelp('', realTerms)).toEqual([]);
    expect(searchHelp('   ', realTerms)).toEqual([]);
    expect(searchHelp('\n', realTerms)).toEqual([]);
  });

  it('finds nothing for a word that is nowhere', () => {
    expect(searchHelp('zzzqqq', realTerms)).toEqual([]);
  });

  it('finds a term by its German word, its translation and its explanation, in every language', () => {
    for (const file of [en, de, ar]) {
      const terms = file.terms as unknown as Record<TermKey, TermTexts>;
      const all = { answers: {}, terms } as SearchTexts;
      expect(termHits(searchHelp(terms['ustva'].de, all))).toContain('ustva');
      expect(termHits(searchHelp(terms['ustva'].label, all))).toContain('ustva');
      expect(termHits(searchHelp(terms['ustva'].explain, all))).toContain('ustva');
    }
  });

  it('lists question matches before text matches before terms, each in the order of the data', () => {
    const found = searchHelp(
      'return',
      texts(
        {
          // Earlier in the data than 'send-return', but only its text matches.
          'vat-due': { q: 'When is it due?', a: 'The return is due on the 10th.' },
          'send-return': { q: 'How do I send the return?', a: 'Tap Send.' },
          'klein-limit': { q: 'What is the limit?', a: 'Nothing to do with it.' },
        },
        {
          euer: {
            label: 'Annual profit report',
            de: 'EÜR',
            explain: 'You send it with the year-end return.',
          },
          umsatzsteuererklaerung: {
            label: 'Annual VAT return',
            de: 'Umsatzsteuererklärung',
            explain: 'Once a year.',
          },
        },
      ),
    );
    expect(found).toEqual([
      { kind: 'answer', id: 'send-return', topic: 'taxes' },
      { kind: 'answer', id: 'vat-due', topic: 'taxes' },
      // A term's own words come before a term that only mentions the word in its explanation.
      { kind: 'term', key: 'umsatzsteuererklaerung' },
      { kind: 'term', key: 'euer' },
    ]);
  });

  it('lists an answer once, even when both its question and its text match', () => {
    const found = searchHelp(
      'bank',
      texts({ 'connect-bank': { q: 'How do I connect my bank?', a: 'Pick your bank.' } }),
    );
    expect(found).toEqual([{ kind: 'answer', id: 'connect-bank', topic: 'payments' }]);
  });

  it('finds an answer by the other spelling of an umlaut', () => {
    const found = searchHelp(
      'uebertragung',
      texts({ 'send-return': { q: 'Was ist das?', a: 'Das Übertragungsprotokoll.' } }),
    );
    expect(found).toEqual([{ kind: 'answer', id: 'send-return', topic: 'taxes' }]);
  });

  it('leaves out an answer that has no text in the language', () => {
    expect(searchHelp('return', texts({}))).toEqual([]);
  });
});

describe('termsAZ', () => {
  it('places every term once, under a single capital letter, with the letters in order', () => {
    for (const file of [en, de, ar]) {
      const groups = termsAZ(germanOf(file.terms));
      expect(groups.flatMap((group) => group.keys).sort()).toEqual([...TERM_KEYS].sort());
      for (const group of groups) {
        expect(group.letter).toMatch(/^[A-Z]$/);
        expect(group.keys.length).toBeGreaterThan(0);
      }
      const letters = groups.map((group) => group.letter);
      expect(letters).toEqual([...letters].sort());
      expect(new Set(letters).size).toBe(letters.length);
    }
  });

  it('groups a term by the first letter of its German word', () => {
    const groups = termsAZ(germanOf(de.terms));
    const letterOf = (key: TermKey) => groups.find((group) => group.keys.includes(key))!.letter;
    expect(letterOf('ustva')).toBe('U');
    expect(letterOf('euer')).toBe('E');
    expect(letterOf('eRechnung')).toBe('E');
    expect(letterOf('steuerberater')).toBe('S');
    expect(letterOf('bwa')).toBe('B');
  });

  it('puts Ä with A, Ö with O and Ü with U', () => {
    const groups = termsAZ(germanOf(de.terms));
    const letterOf = (key: TermKey) => groups.find((group) => group.keys.includes(key))!.letter;
    expect(letterOf('uebertragungsprotokoll')).toBe('U');
    const umlauts = termsAZ({
      ...germanOf(de.terms),
      euer: { de: 'Ärger' },
      bwa: { de: 'Ölpreis' },
      gbr: { de: 'Überweisung' },
    });
    const of = (key: TermKey) => umlauts.find((group) => group.keys.includes(key))!.letter;
    expect(of('euer')).toBe('A');
    expect(of('bwa')).toBe('O');
    expect(of('gbr')).toBe('U');
    expect(umlauts.map((group) => group.letter)).not.toContain('Ä');
  });

  it('sorts the German way: Ä among the As, not after Z', () => {
    const groups = termsAZ({
      ...germanOf(de.terms),
      euer: { de: 'Ärger' },
      ustva: { de: 'Arzt' },
      kleinunternehmer: { de: 'Abc' },
    });
    const a = groups.find((group) => group.letter === 'A')!;
    const ordered = a.keys.filter((key) => ['kleinunternehmer', 'euer', 'ustva'].includes(key));
    expect(ordered).toEqual(['kleinunternehmer', 'euer', 'ustva']);
  });

  it('sorts the terms of a letter by their German word', () => {
    const groups = termsAZ(germanOf(de.terms));
    const words = germanOf(de.terms);
    for (const group of groups) {
      const sorted = [...group.keys].sort((a, b) =>
        new Intl.Collator('de').compare(words[a].de, words[b].de),
      );
      expect(group.keys, group.letter).toEqual(sorted);
    }
  });

  it('does not depend on the language of the page: the German word is the same in every translation file', () => {
    expect(germanOf(en.terms)).toEqual(germanOf(de.terms));
    expect(germanOf(ar.terms)).toEqual(germanOf(de.terms));
  });
});

describe('every term key', () => {
  it('has its texts and a place in A–Z', () => {
    const placed = termsAZ(germanOf(en.terms)).flatMap((group) => group.keys);
    for (const [lang, file] of Object.entries({ en, de, ar })) {
      const terms = file.terms as unknown as Record<TermKey, TermTexts>;
      for (const key of TERM_KEYS) {
        for (const part of ['label', 'de', 'explain'] as const) {
          expect(terms[key][part], `${lang} terms.${key}.${part}`).toBeTruthy();
        }
      }
    }
    for (const key of TERM_KEYS) {
      expect(placed, key).toContain(key);
      expect(TERM_PAGES[key].length, key).toBeGreaterThan(0);
    }
  });
});
