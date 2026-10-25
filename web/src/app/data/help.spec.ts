import { routes } from '../app.routes';
import { TERM_KEYS } from '../core/i18n/term-keys';
import {
  HELP_ANSWERS,
  HELP_TOPICS,
  KLEINUNTERNEHMER_TAXES_QUESTIONS,
  PAGE_QUESTIONS,
  TERM_PAGES,
  type HelpPage,
  type HelpTopic,
} from './help';

/** The pages in the order of the menu. */
const PAGES: HelpPage[] = [
  'start',
  'payments',
  'documents',
  'invoices',
  'taxes',
  'reports',
  'settings',
];
const ids = HELP_ANSWERS.map((answer) => answer.id);
const idsOf = (topic: HelpTopic) =>
  HELP_ANSWERS.filter((answer) => answer.topic === topic).map((answer) => answer.id);

describe('HELP_TOPICS', () => {
  it('lists the seven topics in the order the Help page shows them', () => {
    expect([...HELP_TOPICS]).toEqual([
      'start',
      'payments',
      'receipts',
      'invoices',
      'taxes',
      'account',
      'privacy',
    ]);
  });
});

describe('HELP_ANSWERS', () => {
  it('has a lower-case, hyphenated id for every answer, and no id twice', () => {
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives each topic at least two answers, and the counts add up to every answer', () => {
    let total = 0;
    for (const topic of HELP_TOPICS) {
      expect(idsOf(topic).length, topic).toBeGreaterThanOrEqual(2);
      total += idsOf(topic).length;
    }
    expect(total).toBe(HELP_ANSWERS.length);
  });

  it('holds the 24 sample questions of the design, grouped by topic in the order of the topics', () => {
    expect(HELP_ANSWERS).toHaveLength(24);
    expect(HELP_TOPICS.map((topic) => idsOf(topic).length)).toEqual([3, 4, 3, 3, 6, 3, 2]);
    expect(HELP_TOPICS.flatMap(idsOf)).toEqual(ids);
  });

  it('names only German terms the app explains, each once', () => {
    for (const answer of HELP_ANSWERS) {
      for (const key of answer.terms) expect(TERM_KEYS, `${answer.id}: ${key}`).toContain(key);
      expect(new Set(answer.terms).size, answer.id).toBe(answer.terms.length);
    }
  });

  it('links to a page that is in the app, or to none', () => {
    const shell = routes.find((route) => route.path === '' && route.children)!;
    const paths = new Set(
      shell.children!.map((route) => `/${route.path}`.replace(/\/$/, '') || '/'),
    );
    for (const answer of HELP_ANSWERS) {
      if (!answer.link) continue;
      expect(paths.has(answer.link.route), `${answer.id}: ${answer.link.route}`).toBe(true);
      expect(PAGES, answer.id).toContain(answer.link.page);
      if (answer.link.fragment !== undefined)
        expect(answer.link.fragment, answer.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
});

describe('PAGE_QUESTIONS', () => {
  it('has questions for each page, and every one is an answer', () => {
    expect(Object.keys(PAGE_QUESTIONS).sort()).toEqual([...PAGES].sort());
    for (const page of PAGES) {
      expect(PAGE_QUESTIONS[page].length, page).toBeGreaterThan(0);
      expect(new Set(PAGE_QUESTIONS[page]).size, page).toBe(PAGE_QUESTIONS[page].length);
      for (const id of PAGE_QUESTIONS[page]) expect(ids, `${page}: ${id}`).toContain(id);
    }
  });

  it('gives Home, Payments, Documents, Invoices and Settings the answers of their topic', () => {
    expect(PAGE_QUESTIONS.start).toEqual(idsOf('start'));
    expect(PAGE_QUESTIONS.payments).toEqual(idsOf('payments'));
    expect(PAGE_QUESTIONS.documents).toEqual(idsOf('receipts'));
    expect(PAGE_QUESTIONS.invoices).toEqual(idsOf('invoices'));
    expect(PAGE_QUESTIONS.settings).toEqual(idsOf('account'));
  });

  it('gives Taxes the first three questions of its topic, and Reports closing a month, the export and the VAT return', () => {
    expect(PAGE_QUESTIONS.taxes).toEqual(['vat-due', 'send-return', 'payment-blocks-send']);
    expect(PAGE_QUESTIONS.taxes).toEqual(idsOf('taxes').slice(0, 3));
    expect(PAGE_QUESTIONS.reports).toEqual(['close-month', 'export-advisor', 'vat-due']);
  });

  it('keeps the Kleinunternehmer limit out of Taxes, where only a Kleinunternehmer sees it first', () => {
    expect(idsOf('taxes')).toContain('klein-limit');
    expect(PAGE_QUESTIONS.taxes).not.toContain('klein-limit');
  });

  it("gives a Kleinunternehmer's Taxes the limit and the year-end questions, with no VAT return question", () => {
    expect(KLEINUNTERNEHMER_TAXES_QUESTIONS).toEqual([
      'klein-limit',
      'close-month',
      'export-advisor',
    ]);
    expect(new Set(KLEINUNTERNEHMER_TAXES_QUESTIONS).size).toBe(
      KLEINUNTERNEHMER_TAXES_QUESTIONS.length,
    );
    for (const id of KLEINUNTERNEHMER_TAXES_QUESTIONS) expect(ids, id).toContain(id);
    expect(KLEINUNTERNEHMER_TAXES_QUESTIONS).not.toContain('vat-due');
    expect(KLEINUNTERNEHMER_TAXES_QUESTIONS).not.toContain('send-return');
  });
});

describe('TERM_PAGES', () => {
  it('has a place for every term key, and for nothing else', () => {
    expect(Object.keys(TERM_PAGES).sort()).toEqual([...TERM_KEYS].sort());
    for (const key of TERM_KEYS) {
      expect(TERM_PAGES[key].length, key).toBeGreaterThan(0);
      expect(new Set(TERM_PAGES[key]).size, key).toBe(TERM_PAGES[key].length);
      for (const page of TERM_PAGES[key]) expect(PAGES, key).toContain(page);
    }
  });

  it('lists the pages of a term in the order of the menu', () => {
    for (const key of TERM_KEYS) {
      const order = TERM_PAGES[key].map((page) => PAGES.indexOf(page));
      expect(order, key).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it('puts a few terms where the app shows them', () => {
    expect(TERM_PAGES.bwa).toEqual(['reports']);
    expect(TERM_PAGES.gdpdu).toEqual(['reports']);
    expect(TERM_PAGES.festschreibung).toEqual(['reports']);
    expect(TERM_PAGES.elster).toEqual(['taxes']);
    expect(TERM_PAGES.kontoauszug).toEqual(['payments']);
    expect(TERM_PAGES.zugferd).toEqual(['invoices']);
  });
});
