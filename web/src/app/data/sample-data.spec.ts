import { paymentStatus } from '../domain/payment-status';
import { revenueLimitStatus } from '../domain/revenue-limit';
import { profileTaxOffice } from '../domain/tax-details';
import { yearSummary } from '../domain/tax-year';
import { periodFor, vatReturnFor } from '../domain/vat-return';
import { GERMAN_STATES, TAX_OFFICES } from './banks';
import { CATEGORIES, PRIVATE_IN, PRIVATE_OUT } from './categories';
import { BUSINESSES, PERSON } from './sample-data';
import { UPLOAD_POOLS, linkedDocFor } from './sample-documents';

describe('sample data', () => {
  it('three businesses, all belonging to PERSON', () => {
    expect(BUSINESSES.length).toBe(3);
    for (const b of BUSINESSES) {
      expect(PERSON.businessIds).toContain(b.id);
    }
  });

  it('exactly one Kleinunternehmer, with no VAT returns', () => {
    const ku = BUSINESSES.filter((b) => b.taxProfile.kleinunternehmer);
    expect(ku.length).toBe(1);
    expect(ku[0].vatReturns).toEqual([]);
  });

  it('every transaction points to an account of its business', () => {
    for (const b of BUSINESSES) {
      const ids = b.accounts.map((a) => a.id);
      for (const t of b.transactions) {
        expect(ids).toContain(t.accountId);
      }
    }
  });

  it('amounts are integer cents', () => {
    for (const b of BUSINESSES) {
      for (const a of b.accounts) expect(Number.isInteger(a.balanceCents)).toBe(true);
      for (const t of b.transactions) expect(Number.isInteger(t.amountCents)).toBe(true);
    }
  });
});

describe('sample payments', () => {
  const statusesOf = (id: string) => new Set(BUSINESSES.find((b) => b.id === id)!.transactions.map(paymentStatus));

  it('every business has payments in August, September and October 2026', () => {
    for (const b of BUSINESSES) {
      for (const month of ['2026-08', '2026-09', '2026-10']) {
        expect(b.transactions.some((t) => t.date.startsWith(month))).toBe(true);
      }
    }
  });

  it('weber-design and sara-yoga show all four statuses, cafe-linde only booked', () => {
    const all = ['booked', 'confirm', 'noReceipt', 'unclear'];
    expect([...statusesOf('weber-design')].sort()).toEqual([...all].sort());
    expect([...statusesOf('sara-yoga')].sort()).toEqual([...all].sort());
    expect([...statusesOf('cafe-linde')]).toEqual(['booked']);
  });

  it('weber-design keeps the statuses of its six October payments', () => {
    const wd = BUSINESSES.find((b) => b.id === 'weber-design')!;
    const status = (id: string) => paymentStatus(wd.transactions.find((t) => t.id === id)!);
    expect(['wd-t1', 'wd-t2', 'wd-t3', 'wd-t4', 'wd-t5', 'wd-t6'].map(status)).toEqual([
      'confirm',
      'booked',
      'noReceipt',
      'unclear',
      'booked',
      'booked',
    ]);
  });

  it('payments to confirm or clarify always have a receipt attached', () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions) {
        if (['confirm', 'unclear'].includes(paymentStatus(t))) expect(t.receipt).toBe('attached');
      }
    }
  });

  it('a receipt file exists exactly when the receipt is attached', () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions) expect(t.receiptFile !== null).toBe(t.receipt === 'attached');
    }
  });

  it('every payment has an IBAN, a reference and at least one history entry', () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions) {
        expect(t.counterpartyIban).toMatch(/^DE\d{20}$/);
        expect(t.reference.length).toBeGreaterThan(0);
        expect(t.history.length).toBeGreaterThan(0);
      }
    }
  });

  it('every payment keeps its history newest first: imported is the oldest line', () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions) {
        expect(t.history.at(-1)?.key, t.id).toBe('imported');
        expect(t.history.filter((h) => h.key === 'imported'), t.id).toHaveLength(1);
        const dates = t.history.map((h) => h.date);
        expect([...dates].sort().reverse(), t.id).toEqual(dates);
      }
    }
  });

  it('an automatic booking comes after the import and before a private mark', () => {
    const tx = BUSINESSES.find((b) => b.id === 'weber-design')!.transactions.find((t) => t.id === 'wd-t15')!;
    expect(tx.history.map((h) => h.key)).toEqual(['markedPrivate', 'autoBooked', 'imported']);
  });

  it('payment ids are unique across the sample data', () => {
    const ids = BUSINESSES.flatMap((b) => b.transactions.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every unclear sample payment has 1–3 suggestions from CATEGORIES', () => {
    const known = CATEGORIES.map((c) => c.labelKey);
    const unclear = BUSINESSES.flatMap((b) => b.transactions).filter((t) => paymentStatus(t) === 'unclear');
    expect(unclear.map((t) => t.id)).toEqual(['wd-t4', 'wd-t18', 'sy-t7']);
    for (const t of unclear) {
      expect(t.suggestions?.length, t.id).toBeGreaterThanOrEqual(1);
      expect(t.suggestions!.length, t.id).toBeLessThanOrEqual(3);
      expect(new Set(t.suggestions).size, t.id).toBe(t.suggestions!.length);
      for (const key of t.suggestions!) expect(known, `${t.id} ${key}`).toContain(key);
    }
  });

  it('weber-design has the new Amazon payment wd-t18: unclear, with its receipt attached and the same suggestions as wd-t4', () => {
    const wd = BUSINESSES.find((b) => b.id === 'weber-design')!;
    const t18 = wd.transactions.find((t) => t.id === 'wd-t18')!;
    expect(paymentStatus(t18)).toBe('unclear');
    expect(t18).toMatchObject({ date: '2026-10-02', counterparty: 'Amazon', amountCents: -2390, accountId: 'wd-qonto', booking: null, receipt: 'attached' });
    expect(t18.suggestions).toEqual(wd.transactions.find((t) => t.id === 'wd-t4')!.suggestions);
    expect(wd.documents.filter((d) => d.paymentId === 'wd-t18').map((d) => d.id)).toEqual(['doc-wd-t18']);
  });

  it('every booking is a known category or a private booking', () => {
    const known = [...CATEGORIES, PRIVATE_OUT, PRIVATE_IN];
    for (const b of BUSINESSES) {
      for (const t of b.transactions) {
        if (t.booking) expect(known).toContainEqual(t.booking);
      }
    }
  });
});

describe('sample documents', () => {
  const business = (id: string) => BUSINESSES.find((b) => b.id === id)!;

  it("every payment with a receipt attached has exactly one document linked to it, except a part payment of an invoice: that invoice's own document waits for the rest", () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions.filter((x) => x.receipt === 'attached')) {
        const partPayment = b.invoices.some((i) => i.paymentIds.includes(t.id) && i.docId !== `doc-${t.id}`);
        expect(b.documents.filter((d) => d.paymentId === t.id), t.id).toHaveLength(partPayment ? 0 : 1);
      }
    }
  });

  it('no document is linked to a payment whose receipt is not attached, or to a payment of another business', () => {
    for (const b of BUSINESSES) {
      const attached = b.transactions.filter((t) => t.receipt === 'attached').map((t) => t.id);
      for (const d of b.documents) {
        if (d.paymentId !== null) expect(attached, d.id).toContain(d.paymentId);
      }
    }
  });

  it('document ids are unique per business', () => {
    for (const b of BUSINESSES) {
      const ids = b.documents.map((d) => d.id);
      expect(new Set(ids).size, b.id).toBe(ids.length);
    }
  });

  it('every document booking is a known category', () => {
    for (const b of BUSINESSES) {
      for (const d of b.documents) {
        if (d.booking) expect(CATEGORIES, d.id).toContainEqual(d.booking);
      }
    }
  });

  it('every document keeps its history newest first, with the adding line oldest', () => {
    for (const b of BUSINESSES) {
      for (const d of b.documents) {
        expect(d.history.at(-1)?.key, d.id).toMatch(/^added(Photo|File|Email)$/);
        const dates = d.history.map((h) => h.date);
        expect([...dates].sort().reverse(), d.id).toEqual(dates);
      }
    }
  });

  it('the documents that are not linked wait for a payment or a decision, or are closed invoices: wd-d1 to wd-d6, sy-d1, sy-d2 and cl-d1', () => {
    const unlinked = BUSINESSES.flatMap((b) => b.documents.filter((d) => d.paymentId === null).map((d) => d.id));
    expect(unlinked).toEqual(['wd-d1', 'wd-d2', 'wd-d3', 'wd-d4', 'wd-d5', 'wd-d6', 'sy-d1', 'sy-d2', 'cl-d1']);
  });

  it('wd-d1 is a photo with no amount yet; wd-d4 and sy-d1 are receipts for payments that lack one', () => {
    const d1 = business('weber-design').documents.find((d) => d.id === 'wd-d1')!;
    expect(d1).toMatchObject({ fileName: 'IMG_2041.jpg', source: 'photo', amountCents: null, direction: 'received', invoiceNo: 'K-55120' });
    const d4 = business('weber-design').documents.find((d) => d.id === 'wd-d4')!;
    const t17 = business('weber-design').transactions.find((t) => t.id === 'wd-t17')!;
    expect(d4.amountCents).toBe(-t17.amountCents);
    expect(d4.date).toBe(t17.date);
    const sy = business('sara-yoga');
    const sy1 = sy.documents.find((d) => d.id === 'sy-d1')!;
    const sy8 = sy.transactions.find((t) => t.id === 'sy-t8')!;
    expect(sy1.amountCents).toBe(-sy8.amountCents);
    expect(sy8.receipt).toBe('missing');
  });

  it('wd-d2 and wd-d3 are invoices sent to customers, with due dates', () => {
    const wd = business('weber-design').documents;
    expect(wd.find((d) => d.id === 'wd-d2')).toMatchObject({ direction: 'sent', dueDate: '2026-10-30', amountCents: 238000 });
    expect(wd.find((d) => d.id === 'wd-d3')).toMatchObject({ direction: 'sent', dueDate: '2026-09-30', amountCents: 119000 });
  });

  it('every business has an inbox address of its own', () => {
    expect(BUSINESSES.map((b) => b.inboxEmail)).toEqual([
      'weber-design@inbox.example',
      'sara-yoga@inbox.example',
      'cafe-linde@inbox.example',
    ]);
  });

  it('weber-design has the new payment wd-t17, which still lacks its receipt', () => {
    const t17 = business('weber-design').transactions.find((t) => t.id === 'wd-t17')!;
    expect(paymentStatus(t17)).toBe('noReceipt');
    expect(t17).toMatchObject({ date: '2026-10-08', counterparty: 'SCHREIBWAREN BOETTCHER', amountCents: -2380, accountId: 'wd-qonto' });
    expect(t17.reference).toBe('Kartenzahlung 08.10.');
    expect(t17.beforeLink).toBeNull();
  });

  it('every payment starts with nothing saved from before a link', () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions) expect(t.beforeLink, t.id).toBeNull();
    }
  });
});

describe('linkedDocFor', () => {
  const find = (id: string) => {
    for (const b of BUSINESSES) {
      const found = b.transactions.find((t) => t.id === id);
      if (found) return found;
    }
    throw new Error(`no sample payment ${id}`);
  };

  it('describes a supplier invoice the payment settles', () => {
    const tx = find('wd-t2');
    const d = linkedDocFor(tx, false);
    expect(d).toMatchObject({
      id: 'doc-wd-t2',
      fileName: 'telekom-rechnung-oktober.pdf',
      source: 'file',
      addedOn: tx.date,
      fromUpload: false,
      reading: false,
      name: 'Telekom',
      direction: 'received',
      invoiceNo: tx.reference,
      date: tx.date,
      dueDate: null,
      amountCents: 3995,
      vatRate: 19,
      duplicateOf: null,
      paymentId: 'wd-t2',
    });
    expect(d.booking).toEqual(tx.booking);
    expect(d.bookingConfirmed).toBe(tx.confirmed);
  });

  it('describes a customer invoice that an incoming payment settles', () => {
    const d = linkedDocFor(find('wd-t7'), false);
    expect(d).toMatchObject({ direction: 'sent', amountCents: 297500, vatRate: 19, name: 'Atelier Sommer GmbH' });
  });

  it('a Kleinunternehmer sends invoices without VAT, and keeps an unconfirmed booking unconfirmed', () => {
    const d = linkedDocFor(find('sy-t2'), true);
    expect(d).toMatchObject({ direction: 'sent', vatRate: 0, bookingConfirmed: false });
  });

  it('a Kleinunternehmer still pays the VAT on what they buy', () => {
    expect(linkedDocFor(find('sy-t3'), true)).toMatchObject({ direction: 'received', vatRate: 19 });
  });

  it('keeps no booking, and logs no suggested category, when the payment has none', () => {
    const d = linkedDocFor(find('wd-t4'), false);
    expect(d.booking).toBeNull();
    expect(d.vatRate).toBe(0);
    expect(d.history.map((h) => h.key)).toEqual(['linkedAuto', 'addedFile']);
  });

  it('records, newest first, the automatic link, the reading and the adding of the file', () => {
    const tx = find('wd-t2');
    const d = linkedDocFor(tx, false);
    expect(d.history).toEqual([
      { date: tx.date, key: 'linkedAuto', params: { name: 'Telekom' } },
      { date: tx.date, key: 'docRead', params: { category: 'phone' } },
      { date: tx.date, key: 'addedFile', params: {} },
    ]);
  });
});

describe('upload pools', () => {
  it('there is a pool for every business', () => {
    expect(Object.keys(UPLOAD_POOLS).sort()).toEqual(BUSINESSES.map((b) => b.id).sort());
  });

  it('each pool is in the order the demo shows it, and keeps at least one plain receipt to repeat', () => {
    expect(UPLOAD_POOLS['weber-design'].map((r) => r.name)).toEqual([
      'Deutsche Bahn',
      'Telekom',
      'Krause & Partner',
      'Copyshop Mitte',
      'Parkhaus Alexa',
    ]);
    expect(UPLOAD_POOLS['sara-yoga'].map((r) => r.name)).toEqual(['Yogashop Berlin', 'Raumhaus Berlin']);
    expect(UPLOAD_POOLS['cafe-linde'].map((r) => r.name)).toEqual(['Metro Großmarkt', 'Bäckerei Frisch']);
    for (const pool of Object.values(UPLOAD_POOLS)) expect(pool.some((r) => r.plain)).toBe(true);
  });

  it('the plain receipts are the ones that are safe to repeat: no duplicate, no missing direction, no sure match', () => {
    for (const pool of Object.values(UPLOAD_POOLS)) {
      for (const r of pool.filter((x) => x.plain)) {
        expect(r.duplicateOf, r.name ?? '').toBeNull();
        expect(r.direction, r.name ?? '').not.toBeNull();
      }
    }
    const weber = UPLOAD_POOLS['weber-design'];
    expect(weber.map((r) => r.plain)).toEqual([false, false, false, true, true]);
  });

  it('weber-design: Deutsche Bahn matches wd-t3 for sure, Telekom copies an existing document, Krause has no direction', () => {
    const [bahn, telekom, krause] = UPLOAD_POOLS['weber-design'];
    const wd = BUSINESSES.find((b) => b.id === 'weber-design')!;
    const t3 = wd.transactions.find((t) => t.id === 'wd-t3')!;
    expect(bahn).toMatchObject({ direction: 'received', invoiceNo: '8841', date: t3.date, amountCents: -t3.amountCents });
    expect(bahn.booking).toEqual(t3.booking);
    expect(telekom.duplicateOf).toBe('doc-wd-t2');
    const original = wd.documents.find((d) => d.id === 'doc-wd-t2')!;
    expect(telekom).toMatchObject({ amountCents: original.amountCents, name: original.name });
    expect(krause).toMatchObject({ direction: null, invoiceNo: '2026-117', amountCents: 45000, date: '2026-10-21' });
  });

  it('a pooled duplicate points at a document of the same business', () => {
    for (const b of BUSINESSES) {
      for (const r of UPLOAD_POOLS[b.id].filter((x) => x.duplicateOf !== null)) {
        expect(b.documents.map((d) => d.id), r.name ?? '').toContain(r.duplicateOf);
      }
    }
  });

  it('every pooled booking is a known category and every amount is positive whole cents', () => {
    for (const pool of Object.values(UPLOAD_POOLS)) {
      for (const r of pool) {
        if (r.booking) expect(CATEGORIES).toContainEqual(r.booking);
        expect(Number.isInteger(r.amountCents), r.name ?? '').toBe(true);
        expect(r.amountCents!, r.name ?? '').toBeGreaterThan(0);
      }
    }
  });
});

describe('sample data revenue notice', () => {
  it('shows the same whole percent as the revenue tracker', () => {
    const sara = BUSINESSES.find((b) => b.id === 'sara-yoga')!;
    const notice = sara.notices.find((n) => n.kind === 'revenueLimit')!;
    expect(notice.params['percent']).toBe(revenueLimitStatus(yearSummary(sara).incomeCents).percent);
  });
});

describe('sample bank connections', () => {
  const business = (id: string) => BUSINESSES.find((b) => b.id === id)!;
  const account = (businessId: string, accountId: string) => business(businessId).accounts.find((a) => a.id === accountId)!;

  it('every account has a connection and a product', () => {
    for (const b of BUSINESSES) {
      for (const a of b.accounts) {
        expect(['connected', 'statement', 'cash'], a.id).toContain(a.connection.kind);
        expect(['business', 'savings', 'card', 'cash'], a.id).toContain(a.product);
        expect(a.connection.kind === 'cash', a.id).toBe(a.kind === 'cash');
        expect(a.product === 'cash', a.id).toBe(a.kind === 'cash');
        expect(a.iban === null, a.id).toBe(a.kind === 'cash');
        if (a.iban !== null) expect(a.iban, a.id).toMatch(/^DE\d{20}$/);
      }
    }
  });

  it('only a connected account has a consent end and a last fetch', () => {
    for (const b of BUSINESSES) {
      for (const a of b.accounts) {
        const c = a.connection;
        if (c.kind === 'connected') {
          expect(c.consentUntil, a.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(c.lastFetched, a.id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
          expect(c.fetchFrom, a.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        } else {
          expect([c.consentUntil, c.lastFetched, c.fetchFrom], a.id).toEqual([null, null, null]);
        }
        expect(c.broken, a.id).toBe(false);
      }
    }
  });

  it("weber-design's Qonto consent ends 2026-10-27", () => {
    expect(account('weber-design', 'wd-qonto').connection).toMatchObject({
      kind: 'connected',
      consentUntil: '2026-10-27',
      lastFetched: '2026-10-22T06:12',
      broken: false,
    });
    expect(account('weber-design', 'wd-cash')).toMatchObject({ product: 'cash', iban: null, connection: { kind: 'cash' } });
  });

  it("sara-yoga's Qonto consent ended 2026-10-20", () => {
    expect(account('sara-yoga', 'sy-qonto').connection).toMatchObject({ kind: 'connected', consentUntil: '2026-10-20' });
  });

  it("cafe-linde's Qonto has about four months left", () => {
    const { kind, consentUntil } = account('cafe-linde', 'cl-qonto').connection;
    expect(kind).toBe('connected');
    const days = (Date.parse(consentUntil!) - Date.parse('2026-10-22')) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(110);
    expect(days).toBeLessThanOrEqual(130);
  });

  it("cafe-linde's Sparkasse is a statement account", () => {
    expect(account('cafe-linde', 'cl-sparkasse').connection.kind).toBe('statement');
    expect(account('cafe-linde', 'cl-cash').connection.kind).toBe('cash');
  });

  it('the sample accounts are business accounts or cash boxes, each with an IBAN of its own', () => {
    const ibans = BUSINESSES.flatMap((b) => b.accounts.map((a) => a.iban).filter((i) => i !== null));
    expect(new Set(ibans).size).toBe(ibans.length);
    for (const b of BUSINESSES) {
      for (const a of b.accounts) expect(['business', 'cash'], a.id).toContain(a.product);
    }
  });

  it('no stored bankExpiry notice is left open', () => {
    for (const b of BUSINESSES) {
      expect(b.notices.filter((n) => n.kind === 'bankExpiry'), b.id).toEqual([]);
    }
    const ids = BUSINESSES.flatMap((b) => b.notices.map((n) => n.id));
    expect(ids).not.toContain('wd-n2');
    expect(ids).not.toContain('cl-n1');
  });

  it('the notices that are not about the bank stay, and so do the old ones in the history', () => {
    expect(business('weber-design').notices.map((n) => n.id)).toEqual(['wd-n1', 'wd-n3']);
    expect(business('sara-yoga').notices.map((n) => n.id)).toEqual(['sy-n1']);
    expect(business('cafe-linde').notices).toEqual([]);
    expect(business('weber-design').noticeHistory.map((n) => n.id)).toEqual(['wd-h1', 'wd-h2']);
    expect(business('cafe-linde').noticeHistory.map((n) => n.id)).toEqual(['cl-h1']);
  });

  it('every business starts with an empty history', () => {
    for (const b of BUSINESSES) expect(b.history, b.id).toEqual([]);
  });
});

describe('sample tax answers', () => {
  const business = (id: string) => BUSINESSES.find((b) => b.id === id)!;

  it('every tax profile with kleinunternehmer has no VAT answers', () => {
    const small = BUSINESSES.filter((b) => b.taxProfile.kleinunternehmer);
    expect(small.length).toBeGreaterThan(0);
    for (const b of small) {
      expect(b.taxProfile, b.id).toMatchObject({ vatPeriod: null, permanentExtension: false, vatBasis: null });
    }
  });

  it('every tax profile that charges VAT has a return period and a basis', () => {
    for (const b of BUSINESSES.filter((x) => !x.taxProfile.kleinunternehmer)) {
      expect(['monthly', 'quarterly', 'yearly'], b.id).toContain(b.taxProfile.vatPeriod);
      expect(['ist', 'soll'], b.id).toContain(b.taxProfile.vatBasis);
    }
  });

  it("weber-design's answers are the ones in the design", () => {
    expect(business('weber-design').taxProfile).toEqual({
      businessKind: 'freelance',
      kleinunternehmer: false,
      vatPeriod: 'monthly',
      permanentExtension: false,
      vatBasis: 'ist',
      taxState: 'berlin',
      taxNumber: '27/123/45678',
      vatId: null,
      fiscalYearStart: '01-01',
    });
  });

  it('sara-yoga is a freelance Kleinunternehmer in Berlin, and cafe-linde a trade with quarterly returns paid when invoiced', () => {
    expect(business('sara-yoga').taxProfile).toMatchObject({ businessKind: 'freelance', kleinunternehmer: true, taxState: 'berlin' });
    expect(business('cafe-linde').taxProfile).toMatchObject({
      businessKind: 'trade',
      kleinunternehmer: false,
      vatPeriod: 'quarterly',
      permanentExtension: false,
      vatBasis: 'soll',
    });
    expect(business('cafe-linde').taxProfile.taxState).not.toBe('berlin');
  });

  it("every tax number matches its state's format and a tax office prefix of that state", () => {
    for (const b of BUSINESSES) {
      const { taxState, taxNumber } = b.taxProfile;
      const state = GERMAN_STATES.find((s) => s.id === taxState);
      expect(state, b.id).toBeDefined();
      expect(state!.taxNumberPattern!.test(taxNumber!), b.id).toBe(true);
      const digits = taxNumber!.replace(/\D/g, '');
      expect(TAX_OFFICES.some((o) => o.state === taxState && digits.startsWith(o.prefix)), b.id).toBe(true);
    }
  });

  it('the financial year of every sample business is the calendar year', () => {
    for (const b of BUSINESSES) expect(b.taxProfile.fiscalYearStart, b.id).toBe('01-01');
  });
});

describe('sample VAT returns', () => {
  const business = (id: string) => BUSINESSES.find((b) => b.id === id)!;

  it('weber-design has sent August (on 8 September) and September 2026 (on 8 October)', () => {
    expect(business('weber-design').vatReturns).toMatchObject([
      { periodStart: '2026-08-01', periodEnd: '2026-08-31', sentOn: '2026-09-08', ticket: 'ET-2026-0908-41827' },
      { periodStart: '2026-09-01', periodEnd: '2026-09-30', sentOn: '2026-10-08' },
    ]);
  });

  it('what weber-design sent equals what the booked payments of those months give', () => {
    const wd = business('weber-design');
    for (const sent of wd.vatReturns) {
      const view = vatReturnFor(wd, periodFor(sent.periodStart, 'monthly'));
      expect(view.period.end, sent.periodEnd).toBe(sent.periodEnd);
      expect(sent.chargedCents, sent.periodEnd).toBe(view.chargedCents);
      expect(sent.paidCents, sent.periodEnd).toBe(view.paidCents);
      expect(sent.resultCents, sent.periodEnd).toBe(view.resultCents);
      expect(view.needsYouCount, sent.periodEnd).toBe(0);
    }
  });

  it('cafe-linde has sent its Q2 on 9 July, with figures of its own', () => {
    const [q2, ...more] = business('cafe-linde').vatReturns;
    expect(more).toEqual([]);
    expect(q2).toMatchObject({ periodStart: '2026-04-01', periodEnd: '2026-06-30', sentOn: '2026-07-09' });
    expect(q2.resultCents).toBe(q2.chargedCents - q2.paidCents);
    expect(q2.resultCents).toBeGreaterThan(0);
  });

  it('every sent return adds up, ends after it starts and was sent after its period ended, with a ticket that names the day', () => {
    for (const b of BUSINESSES) {
      for (const r of b.vatReturns) {
        expect(r.resultCents, b.id).toBe(r.chargedCents - r.paidCents);
        expect(Number.isInteger(r.chargedCents) && Number.isInteger(r.paidCents), b.id).toBe(true);
        expect(r.periodEnd > r.periodStart, b.id).toBe(true);
        expect(r.sentOn > r.periodEnd, b.id).toBe(true);
        expect(r.ticket, b.id).toMatch(/^ET-2026-\d{4}-\d{5}$/);
        expect(r.ticket.slice(8, 12), b.id).toBe(r.sentOn.slice(5, 7) + r.sentOn.slice(8, 10));
      }
    }
  });

  it('every sent return names the tax office its business files with, as stored (not looked up again)', () => {
    const offices = { 'weber-design': 'Berlin Friedrichshain-Kreuzberg', 'cafe-linde': 'Hamburg-Altona' };
    for (const b of BUSINESSES) {
      for (const r of b.vatReturns) {
        expect(r.taxOffice, b.id).toBe(offices[b.id as keyof typeof offices]);
        expect(r.taxOffice, b.id).toBe(profileTaxOffice(b.taxProfile));
      }
    }
  });

  it('sara-yoga, a Kleinunternehmer, has sent none', () => {
    expect(business('sara-yoga').vatReturns).toEqual([]);
  });

  it("cafe-linde's Q3 is made of booked payments only, so it can be sent: July has a few, and the result is not zero", () => {
    const cafe = business('cafe-linde');
    const july = cafe.transactions.filter((t) => t.date.startsWith('2026-07'));
    expect(july.length).toBeGreaterThanOrEqual(2);
    for (const t of july) expect(paymentStatus(t), t.id).toBe('booked');
    const q3 = vatReturnFor(cafe, periodFor('2026-07-01', 'quarterly'));
    expect(q3.needsYouCount).toBe(0);
    expect(q3.resultCents).toBeGreaterThan(0);
  });
});

describe('sample year figures', () => {
  const business = (id: string) => BUSINESSES.find((b) => b.id === id)!;

  it('the Café is a GbR, the other businesses are run by one person', () => {
    expect(BUSINESSES.map((b) => [b.id, b.legalForm])).toEqual([
      ['weber-design', 'sole'],
      ['sara-yoga', 'sole'],
      ['cafe-linde', 'gbr'],
    ]);
  });

  it('every opening line has costs that add up to their categories, below its income', () => {
    for (const b of BUSINESSES) {
      const { incomeCents, costsCents, costsByCategory } = b.yearOpening;
      expect(Number.isInteger(incomeCents) && Number.isInteger(costsCents), b.id).toBe(true);
      expect(costsByCategory.reduce((sum, c) => sum + c.cents, 0), b.id).toBe(costsCents);
      expect(costsCents, b.id).toBeGreaterThan(0);
      expect(costsCents, b.id).toBeLessThan(incomeCents);
    }
  });

  it('every opening category is a known one, once, with whole positive cents, so its label resolves', () => {
    for (const b of BUSINESSES) {
      const keys = b.yearOpening.costsByCategory.map((c) => c.labelKey);
      expect(new Set(keys).size, b.id).toBe(keys.length);
      for (const c of b.yearOpening.costsByCategory) {
        const known = CATEGORIES.find((x) => x.labelKey === c.labelKey);
        expect(known, `${b.id} ${c.labelKey}`).toBeDefined();
        expect({ skr03: c.skr03, nameDe: c.nameDe }, `${b.id} ${c.labelKey}`).toEqual({ skr03: known!.skr03, nameDe: known!.nameDe });
        expect(Number.isInteger(c.cents) && c.cents > 0, `${b.id} ${c.labelKey}`).toBe(true);
      }
    }
  });

  it('the opening line stops where the first sample payment begins, so no month is counted twice', () => {
    const first = (id: string) => business(id).transactions.map((t) => t.date).sort()[0];
    expect(first('weber-design')).toBe('2026-08-05');
    expect(first('sara-yoga')).toBe('2026-08-04');
    expect(first('cafe-linde')).toBe('2026-07-10');
  });
});
