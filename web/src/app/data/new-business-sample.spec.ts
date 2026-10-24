import { monthBefore } from '../domain/dates';
import { certainMatch } from '../domain/document-matching';
import { applyReadResult, newReadingDoc, nextPoolResult } from '../domain/document-upload';
import { presetSteps } from '../domain/home-cards';
import { invoiceRows, nextInvoiceNumber } from '../domain/invoices';
import { monthRows } from '../domain/months';
import { paymentStatus } from '../domain/payment-status';
import { CATEGORIES, OFFICE, OTHER_COSTS, PHONE, RENT, REVENUE_19, SOFTWARE, TRAVEL } from './categories';
import { DEMO_TODAY } from './demo-date';
import {
  NEW_BUSINESS_POOL,
  isVisitBusiness,
  newBusiness,
  newBusinessAccount,
  newBusinessAccountId,
  newBusinessPayments,
  type NewBusinessInput,
  type NewOwner,
} from './new-business-sample';
import { PERSON } from './sample-person';

const OWNER: NewOwner = { personId: PERSON.id, name: 'Sara Weber', email: PERSON.email };
const INPUT: NewBusinessInput = { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' };

describe('isVisitBusiness', () => {
  it('knows the ids of businesses made during the visit: new-<n>', () => {
    expect(isVisitBusiness('new-1')).toBe(true);
    expect(isVisitBusiness('new-27')).toBe(true);
  });

  it('does not take the sample businesses or anything that only looks like it', () => {
    for (const id of ['weber-design', 'sara-yoga', 'cafe-linde', '', 'new-', 'new-x', 'new-1-main', 'xnew-1', 'new-1 ']) {
      expect(isVisitBusiness(id), id).toBe(false);
    }
  });
});

describe('newBusiness', () => {
  const business = () => newBusiness('new-3', INPUT, OWNER);

  it('is called what the person named it, with an inbox address of its own', () => {
    expect(business()).toMatchObject({ id: 'new-3', name: 'Atelier Neu', inboxEmail: 'new-3@inbox.example' });
  });

  it('has the legal form and the kind of work that were answered, and no other tax answer', () => {
    expect(business().legalForm).toBe('sole');
    expect(business().taxProfile).toEqual({
      businessKind: 'freelance',
      kleinunternehmer: false,
      vatPeriod: null,
      permanentExtension: false,
      vatBasis: null,
      taxState: null,
      taxNumber: null,
      vatId: null,
      fiscalYearStart: '01-01',
    });
    const partnership = newBusiness('new-4', { name: 'Café Neu', kind: 'trade', legalForm: 'gbr' }, OWNER);
    expect(partnership.legalForm).toBe('gbr');
    expect(partnership.taxProfile.businessKind).toBe('trade');
  });

  it('has no accounts, payments, documents, returns, notices, rules, invoices or history', () => {
    expect(business()).toMatchObject({
      accounts: [],
      transactions: [],
      documents: [],
      vatReturns: [],
      notices: [],
      noticeHistory: [],
      categoryRules: [],
      invoices: [],
      history: [],
    });
  });

  it('starts its year with nothing before the first payment and nothing set aside', () => {
    expect(business().yearOpening).toEqual({ incomeCents: 0, costsCents: 0, costsByCategory: [], untilMonth: '2026-09' });
    // Its opening line ends the month before today's, so the running month is the first one it shows.
    expect(business().yearOpening.untilMonth).toBe(monthBefore(DEMO_TODAY));
    expect(business().incomeTaxReserveCents).toBe(0);
  });

  it('has no month closed: only October, which is running, comes after its empty opening line', () => {
    expect(business().closedMonths).toEqual([]);
    expect(monthRows(business(), DEMO_TODAY).map((row) => [row.from, row.state])).toEqual([['2026-10', 'running']]);
  });

  it('is owned by the person, who joined today, and nobody else has access', () => {
    expect(business().people).toEqual([
      {
        id: 'new-3-m1',
        personId: PERSON.id,
        name: 'Sara Weber',
        email: 'sara@example.com',
        role: 'owner',
        status: 'joined',
        invitedOn: null,
        expiresOn: null,
        joinedOn: DEMO_TODAY,
      },
    ]);
    expect(business().supportUntil).toBeNull();
  });

  it('prints its invoices with its name, no address yet, the usual numbering and no bank account', () => {
    expect(business().invoiceProfile).toEqual({
      name: 'Atelier Neu',
      street: '',
      postcode: '',
      city: '',
      email: 'new-3@invoices.example',
      iban: null,
      numberPattern: 'RE-{YYYY}-{NNN}',
      paymentTermDays: 14,
      language: 'de',
    });
  });

  it('has nothing to show on Invoices in any setup state, and its first invoice is numbered 001', () => {
    expect(invoiceRows(business(), presetSteps('new'))).toEqual([]);
    expect(invoiceRows(business(), presetSteps('active'))).toEqual([]);
    expect(nextInvoiceNumber(business(), '2026')).toBe('RE-2026-001');
  });

  it('shares nothing between two businesses made from the same answers', () => {
    const one = business();
    const other = business();
    expect(one).toEqual(other);
    expect(one.people).not.toBe(other.people);
    expect(one.taxProfile).not.toBe(other.taxProfile);
    expect(one.yearOpening.costsByCategory).not.toBe(other.yearOpening.costsByCategory);
    expect(one.closedMonths).not.toBe(other.closedMonths);
  });
});

describe('newBusinessAccount', () => {
  it('is the business account at the bank, with a made-up IBAN, not connected yet', () => {
    expect(newBusinessAccount('new-2', 'Commerzbank')).toEqual({
      id: 'new-2-main',
      kind: 'bank',
      name: 'Commerzbank',
      balanceCents: 1834566,
      lastUpdate: '2026-10-21',
      connection: { kind: 'statement', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false },
      product: 'business',
      iban: 'DE89370400440532013000',
    });
  });

  it('has an id the state service can find again', () => {
    expect(newBusinessAccountId('new-2')).toBe('new-2-main');
    expect(newBusinessAccount('new-9', 'ING').id).toBe(newBusinessAccountId('new-9'));
  });
});

describe('newBusinessPayments', () => {
  const account = newBusinessAccount('new-2', 'Qonto');
  const payments = () => newBusinessPayments('new-2', account, 'Sara Weber');

  it('are eight October payments, newest first, with ids from t1 to t8', () => {
    expect(payments().map((p) => p.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'].map((t) => `new-2-${t}`));
    expect(payments().map((p) => p.date)).toEqual([
      '2026-10-20',
      '2026-10-16',
      '2026-10-14',
      '2026-10-12',
      '2026-10-09',
      '2026-10-07',
      '2026-10-05',
      '2026-10-02',
    ]);
  });

  it('say who paid, how much and for what', () => {
    expect(
      payments().map((p) => [p.counterparty, p.amountCents, p.booking?.labelKey ?? null, p.reference]),
    ).toEqual([
      ['Fischer & Co. KG', 119000, REVENUE_19.labelKey, 'Rechnung 2026-001'],
      ['Hausverwaltung Brandt', -45000, RENT.labelKey, 'Miete Büro Oktober'],
      ['Telekom', -3995, PHONE.labelKey, 'Mobilfunk Oktober'],
      ['Adobe', -5949, SOFTWARE.labelKey, 'Creative Cloud Oktober'],
      ['Deutsche Bahn', -8900, TRAVEL.labelKey, 'Fahrkarte Berlin–Leipzig'],
      ['Lindner Studio GmbH', 238000, REVENUE_19.labelKey, 'Rechnung 2026-002'],
      ['Amazon', -3490, null, expect.stringMatching(/^Bestellung /)],
      ['Sara Weber', -50000, null, 'Überweisung Privatkonto'],
    ]);
  });

  it('are all on the account, none private and each with its own made-up IBAN', () => {
    for (const p of payments()) {
      expect(p.accountId, p.id).toBe('new-2-main');
      expect(p.isPrivate, p.id).toBe(false);
      expect(p.counterpartyIban, p.id).toMatch(/^DE\d{20}$/);
      expect(Number.isInteger(p.amountCents), p.id).toBe(true);
      expect(p.beforePrivate, p.id).toBeNull();
      expect(p.beforeLink, p.id).toBeNull();
    }
    const ibans = payments().map((p) => p.counterpartyIban);
    expect(new Set(ibans).size).toBe(ibans.length);
  });

  it('have no receipt yet, so each one waits for the person', () => {
    for (const p of payments()) {
      expect(p.receipt, p.id).toBe('missing');
      expect(p.receiptFile, p.id).toBeNull();
    }
    expect(payments().map((p) => paymentStatus(p))).toEqual([
      'noReceipt',
      'noReceipt',
      'noReceipt',
      'noReceipt',
      'noReceipt',
      'confirm',
      'unclear',
      'unclear',
    ]);
  });

  it('book the six it can sort and confirm all of them but the second customer', () => {
    const booked = payments().filter((p) => p.booking !== null);
    expect(booked.map((p) => p.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6'].map((t) => `new-2-${t}`));
    expect(payments().filter((p) => !p.confirmed).map((p) => p.id)).toEqual(['new-2-t6']);
  });

  it('offer three categories for the Amazon order, and none for the private transfer', () => {
    const [amazon, owner] = [payments()[6], payments()[7]];
    expect(amazon.suggestions).toEqual([OFFICE.labelKey, SOFTWARE.labelKey, OTHER_COSTS.labelKey]);
    expect(owner.suggestions).toBeUndefined();
    for (const p of payments().slice(0, 6)) expect(p.suggestions, p.id).toBeUndefined();
  });

  it('name the owner on the transfer to the private account, whoever the owner is', () => {
    expect(newBusinessPayments('new-5', newBusinessAccount('new-5', 'ING'), 'Omar Haddad')[7].counterparty).toBe(
      'Omar Haddad',
    );
  });

  it('keep their history newest first: imported is the oldest line, an automatic booking comes after it', () => {
    for (const p of payments()) {
      expect(p.history.at(-1), p.id).toEqual({ date: p.date, key: 'imported', params: { account: 'Qonto' } });
      if (p.booking) expect(p.history[0], p.id).toEqual({ date: p.date, key: 'autoBooked', params: { category: p.booking.labelKey } });
      expect(p.history, p.id).toHaveLength(p.booking ? 2 : 1);
    }
  });

  it('use bookings of the known categories', () => {
    for (const p of payments()) {
      if (p.booking) expect(CATEGORIES, p.id).toContainEqual(p.booking);
      for (const key of p.suggestions ?? []) expect(CATEGORIES.map((c) => c.labelKey), p.id).toContain(key);
    }
  });

  it('are new objects on every call, with a history of their own', () => {
    const [one, other] = [payments(), payments()];
    expect(one).toEqual(other);
    expect(one[0]).not.toBe(other[0]);
    expect(one[0].history).not.toBe(other[0].history);
  });
});

describe('NEW_BUSINESS_POOL', () => {
  const payments = newBusinessPayments('new-2', newBusinessAccount('new-2', 'Qonto'), 'Sara Weber');
  /** What a file would be after it was read as this pool entry. */
  const read = (index: number) => applyReadResult(newReadingDoc('up-1', 'scan.pdf', 'file'), NEW_BUSINESS_POOL[index]);

  it('is in the order the demo shows it: two sure matches, one that cannot be told apart, then two plain receipts', () => {
    expect(NEW_BUSINESS_POOL.map((r) => [r.name, r.amountCents, r.booking?.labelKey ?? null, r.plain])).toEqual([
      ['Telekom', 3995, PHONE.labelKey, false],
      ['Deutsche Bahn', 8900, TRAVEL.labelKey, false],
      ['Bürobedarf Klein', 2990, OFFICE.labelKey, false],
      ['Copyshop Mitte', 1250, OFFICE.labelKey, true],
      ['Parkhaus Zentrum', 600, TRAVEL.labelKey, true],
    ]);
  });

  it('the Telekom receipt matches the Telekom payment for sure, and the Deutsche Bahn receipt the train ticket', () => {
    expect(NEW_BUSINESS_POOL[0]).toMatchObject({ date: '2026-10-14', direction: 'received' });
    expect(NEW_BUSINESS_POOL[1]).toMatchObject({ date: '2026-10-09', direction: 'received' });
    expect(certainMatch(read(0), payments)?.id).toBe('new-2-t3');
    expect(certainMatch(read(1), payments)?.id).toBe('new-2-t5');
  });

  it('the other receipts match no payment for sure, and the third cannot say whether it was sent or received', () => {
    expect(NEW_BUSINESS_POOL[2].direction).toBeNull();
    for (const index of [2, 3, 4]) expect(certainMatch(read(index), payments), `${index}`).toBeNull();
  });

  it('the plain receipts are the ones that repeat once the pool is used up: no duplicate, a clear direction', () => {
    expect(NEW_BUSINESS_POOL.map((r) => r.plain)).toEqual([false, false, false, true, true]);
    for (const r of NEW_BUSINESS_POOL.filter((x) => x.plain)) {
      expect(r.duplicateOf, r.name ?? '').toBeNull();
      expect(r.direction, r.name ?? '').toBe('received');
    }
    expect(nextPoolResult(NEW_BUSINESS_POOL, 5).name).toBe('Copyshop Mitte');
    expect(nextPoolResult(NEW_BUSINESS_POOL, 6).name).toBe('Parkhaus Zentrum');
    expect(nextPoolResult(NEW_BUSINESS_POOL, 7).name).toBe('Copyshop Mitte');
  });

  it('every booking is a known category and every amount is positive whole cents; nothing is a duplicate or has a due date', () => {
    for (const r of NEW_BUSINESS_POOL) {
      if (r.booking) expect(CATEGORIES).toContainEqual(r.booking);
      expect(Number.isInteger(r.amountCents), r.name ?? '').toBe(true);
      expect(r.amountCents!, r.name ?? '').toBeGreaterThan(0);
      expect(r.vatRate, r.name ?? '').toBe(r.booking?.vatRate ?? 0);
      expect(r.duplicateOf, r.name ?? '').toBeNull();
      expect(r.dueDate, r.name ?? '').toBeNull();
    }
  });
});
