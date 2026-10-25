import { TERM_KEYS, type TermKey } from '../core/i18n/term-keys';
import {
  HELP_ANSWERS,
  KLEINUNTERNEHMER_TAXES_QUESTIONS,
  PAGE_QUESTIONS,
  type HelpPage,
  type HelpTopic,
} from '../data/help';

// The rules of the Help page: which help belongs to the page the person came from, and the search over the answers and
// the German terms. They only know ids and texts they are given, never the language of the page or the clock.

/** The first part of an address and the Help page its pages belong to. Anything else (the homepage, print pages, sign-in) is `start`. */
const PAGE_OF_SEGMENT = new Map<string, HelpPage>([
  ['payments', 'payments'],
  ['review', 'payments'],
  ['documents', 'documents'],
  ['invoices', 'invoices'],
  ['taxes', 'taxes'],
  ['reports', 'reports'],
  ['settings', 'settings'],
  ['account', 'settings'],
]);

/**
 * The Help page for the page a person came from, read from its address. A query and a fragment don't count. The
 * homepage, a page Help has no questions for (printouts, Add a business, sign-in, Help itself) and no page at all
 * give `start`, Getting started.
 */
export function helpPageOf(url: string | null): HelpPage {
  if (!url) return 'start';
  const path = url.split(/[?#]/, 1)[0];
  return PAGE_OF_SEGMENT.get(path.split('/')[1] ?? '') ?? 'start';
}

/**
 * The questions for a page, as ids of answers. Under Taxes, a Kleinunternehmer gets their own list, which starts with
 * the limit and leaves out the VAT return questions (they have no VAT return); every other page, and every other
 * business, gets the page's list. Always a new list.
 */
export function pageQuestions(page: HelpPage, kleinunternehmer: boolean): string[] {
  return [
    ...(page === 'taxes' && kleinunternehmer
      ? KLEINUNTERNEHMER_TAXES_QUESTIONS
      : PAGE_QUESTIONS[page]),
  ];
}

/**
 * A text as the search compares it: lower case, an umlaut and its two-letter spelling written the same way (ä and ae
 * are a, ö and oe are o, ü and ue are u, ß is ss), other accents dropped, runs of spaces as one, and trimmed. Search
 * applies it to both sides, so "uebertragung" and "Übertragung" find the same words.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä|ae/g, 'a')
    .replace(/ö|oe/g, 'o')
    .replace(/ü|ue/g, 'u')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** What a search finds: an answer (with its topic, to show beside it) or a German term. */
export type HelpHit =
  { kind: 'answer'; id: string; topic: HelpTopic } | { kind: 'term'; key: TermKey };

/**
 * Looks for a query in the answers' questions and texts and in the terms' translations, German words and explanations
 * (all in the language of the page), ignoring case, spaces and the spelling of umlauts and accents. The hits come in
 * this order: answers whose question matches, answers whose text matches, terms whose label or German word matches,
 * terms whose explanation matches; within each group in the order of the data. A blank query finds nothing, and an
 * answer or a term with no text in `texts` is left out (the translation file may still be on its way).
 */
export function searchHelp(
  query: string,
  texts: {
    answers: Record<string, { q: string; a: string }>;
    terms: Record<TermKey, { label: string; de: string; explain: string }>;
  },
): HelpHit[] {
  const needle = normalizeForSearch(query);
  if (!needle) return [];
  const has = (text: string) => normalizeForSearch(text).includes(needle);

  const byQuestion: HelpHit[] = [];
  const byText: HelpHit[] = [];
  for (const { id, topic } of HELP_ANSWERS) {
    const answer = texts.answers[id];
    if (!answer) continue;
    if (has(answer.q)) byQuestion.push({ kind: 'answer', id, topic });
    else if (has(answer.a)) byText.push({ kind: 'answer', id, topic });
  }

  const byName: HelpHit[] = [];
  const byExplanation: HelpHit[] = [];
  for (const key of TERM_KEYS) {
    const term = texts.terms[key];
    if (!term) continue;
    if (has(term.label) || has(term.de)) byName.push({ kind: 'term', key });
    else if (has(term.explain)) byExplanation.push({ kind: 'term', key });
  }

  return [...byQuestion, ...byText, ...byName, ...byExplanation];
}

/**
 * The terms grouped by the first letter of their German word, for German terms A–Z: Ä counts as A, Ö as O and Ü as U,
 * and the letters and the words within a letter are in German order (`Intl.Collator('de')`). The German word is the
 * same in every language, so the list does not depend on the language of the page.
 */
export function termsAZ(
  terms: Record<TermKey, { de: string }>,
): { letter: string; keys: TermKey[] }[] {
  const collator = new Intl.Collator('de');
  const letterOf = (key: TermKey) => terms[key].de.trim().normalize('NFD').charAt(0).toUpperCase();

  const groups = new Map<string, TermKey[]>();
  for (const key of [...TERM_KEYS].sort((a, b) => collator.compare(terms[a].de, terms[b].de))) {
    const letter = letterOf(key);
    groups.set(letter, [...(groups.get(letter) ?? []), key]);
  }
  return [...groups]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([letter, keys]) => ({ letter, keys }));
}
