import type { Doc, DocDirection, Transaction } from '../data/models';
import { docStatus, isClosedInvoice } from './document-status';

// Pure matching between documents and payments: which payments could a document belong to, and the other way round.

const DAY_MS = 24 * 60 * 60 * 1000;
const CERTAIN_DAYS = 7;

/** The words of a name: lower case, umlauts written out, split on anything that is not a letter or digit, no word under 3 characters. */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3);
}

/** A name as its words joined by a space, to compare two names. */
function normalizedName(name: string): string {
  return nameTokens(name).join(' ');
}

/** Money out belongs to a received document, money in to a sent one. */
function directionOfPayment(tx: Transaction): DocDirection | null {
  if (tx.amountCents < 0) return 'received';
  return tx.amountCents > 0 ? 'sent' : null;
}

/** Whole days between two ISO dates; the dates are read as UTC, so no clock or time zone is involved. */
function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;
}

interface Rank {
  sameAmount: boolean;
  sharedWords: number;
  days: number; // Infinity while the document has no date
}

function rankOf(doc: Doc, tx: Transaction): Rank {
  const paymentWords = new Set(nameTokens(tx.counterparty));
  return {
    sameAmount: doc.amountCents !== null && Math.abs(tx.amountCents) === doc.amountCents,
    sharedWords: [...new Set(nameTokens(doc.name ?? ''))].filter((word) => paymentWords.has(word)).length,
    days: doc.date === null ? Infinity : daysApart(doc.date, tx.date),
  };
}

/** Equal amount first, then more shared words, then the smaller date distance. */
function compareRanks(a: Rank, b: Rank): number {
  if (a.sameAmount !== b.sameAmount) return a.sameAmount ? -1 : 1;
  if (a.sharedWords !== b.sharedWords) return b.sharedWords - a.sharedWords;
  if (a.days !== b.days) return a.days - b.days;
  return 0;
}

/** The payments a document could belong to, best first: receipt missing, not private, money in the document's direction. */
export function paymentCandidates(doc: Doc, txs: readonly Transaction[]): Transaction[] {
  if (doc.direction === null) return [];
  return txs
    .filter((tx) => tx.receipt === 'missing' && !tx.isPrivate && directionOfPayment(tx) === doc.direction)
    .map((tx) => ({ tx, rank: rankOf(doc, tx) }))
    .sort((a, b) => compareRanks(a.rank, b.rank))
    .map(({ tx }) => tx);
}

/**
 * The documents that could belong to a payment, best first: not linked, read, not a duplicate, direction matching the payment.
 * A cancelled invoice and a cancellation invoice are never offered: no payment settles them.
 */
export function documentCandidates(tx: Transaction, docs: readonly Doc[]): Doc[] {
  const direction = directionOfPayment(tx);
  if (direction === null) return [];
  return docs
    .filter((doc) => {
      const status = docStatus(doc);
      return doc.paymentId === null && doc.direction === direction && status !== 'reading' && status !== 'duplicate' && !isClosedInvoice(doc);
    })
    .map((doc) => ({ doc, rank: rankOf(doc, tx) }))
    .sort((a, b) => compareRanks(a.rank, b.rank))
    .map(({ doc }) => doc);
}

/**
 * The payment a new document surely belongs to: the only candidate with the same amount, a date at most 7 days away,
 * and a name that contains the document's name or is contained in it. Anything less sure is left to the person,
 * and a possible duplicate is never sure: it is the person who says whether it is a second document or the same one.
 */
export function certainMatch(doc: Doc, txs: readonly Transaction[]): Transaction | null {
  if (doc.duplicateOf !== null) return null;
  const { amountCents, date, name } = doc;
  if (amountCents === null || date === null || name === null) return null;
  const docName = normalizedName(name);
  if (docName === '') return null;
  const surely = paymentCandidates(doc, txs).filter((tx) => {
    const payerName = normalizedName(tx.counterparty);
    return (
      Math.abs(tx.amountCents) === amountCents &&
      daysApart(date, tx.date) <= CERTAIN_DAYS &&
      payerName !== '' &&
      (payerName.includes(docName) || docName.includes(payerName))
    );
  });
  return surely.length === 1 ? surely[0] : null;
}
