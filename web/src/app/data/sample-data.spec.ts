import { paymentStatus } from '../domain/payment-status';
import { revenueLimitStatus } from '../domain/revenue-limit';
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

  it('exactly one Kleinunternehmer, with no VAT due', () => {
    const ku = BUSINESSES.filter((b) => b.taxProfile.kleinunternehmer);
    expect(ku.length).toBe(1);
    expect(ku[0].vatDue).toBeNull();
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

  it('every payment with a receipt attached has exactly one document linked to it', () => {
    for (const b of BUSINESSES) {
      for (const t of b.transactions.filter((x) => x.receipt === 'attached')) {
        expect(b.documents.filter((d) => d.paymentId === t.id), t.id).toHaveLength(1);
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

  it('the documents that are not linked wait for a payment or a decision: wd-d1 to wd-d4 and sy-d1', () => {
    const unlinked = BUSINESSES.flatMap((b) => b.documents.filter((d) => d.paymentId === null).map((d) => d.id));
    expect(unlinked).toEqual(['wd-d1', 'wd-d2', 'wd-d3', 'wd-d4', 'sy-d1']);
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
    expect(notice.params['percent']).toBe(revenueLimitStatus(sara.revenueThisYearCents).percent);
  });
});
