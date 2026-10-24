import { TestBed } from '@angular/core/testing';
import { SUPPLIES } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Account, ColumnMapping, SampleStatement, Transaction } from '../data/models';
import { foundAccountsOf } from '../data/banks';
import type { NewBusinessInput, NewOwner } from '../data/new-business-sample';
import { BUSINESSES } from '../data/sample-data';
import { PERSON } from '../data/sample-person';
import { noConnection } from '../domain/bank-connection';
import { invoiceStatus } from '../domain/invoices';
import { changeCategory } from '../domain/payment-actions';
import { paymentStatus } from '../domain/payment-status';
import { guessMapping, undoBlockedBy } from '../domain/statement-import';
import { yearSummary } from '../domain/tax-year';
import { DemoStateService } from './demo-state.service';
import { businessOf } from './demo-state.testing';
import { IMPORT_MS, StatementImportService, type ImportSummary } from './statement-import.service';

/** A statement account the person added: the Volksbank of Weber Design, for the CAMT sample. */
const volksbank = (id = 'wd-volksbank'): Account => ({
  id,
  kind: 'bank',
  name: 'Volksbank',
  balanceCents: 0,
  lastUpdate: DEMO_TODAY,
  connection: noConnection('statement'),
  product: 'business',
  iban: 'DE02120300000000202051',
});

const OWNER: NewOwner = { personId: PERSON.id, name: 'Sara Weber', email: PERSON.email };
const INPUT: NewBusinessInput = { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' };

describe('StatementImportService', () => {
  let demo: DemoStateService;
  let service: StatementImportService;

  const payments = (): Transaction[] => demo.business().transactions;
  const payment = (id: string): Transaction => payments().find((tx) => tx.id === id)!;
  const paymentOf = (name: string): Transaction => payments().find((tx) => tx.counterparty === name)!;
  const doc = (id: string) => demo.documents().find((d) => d.id === id)!;
  const invoice = (number: string) => demo.business().invoices.find((i) => i.number === number)!;

  /** Imports and waits for it: the mapping the statement says, else the guessed one. */
  async function run(accountId: string, statement: SampleStatement, mapping?: ColumnMapping): Promise<ImportSummary | null> {
    const done = service.import(accountId, statement, mapping ?? statement.mapping ?? guessMapping(statement));
    await vi.advanceTimersByTimeAsync(IMPORT_MS);
    return done;
  }

  /** Makes a business for Sara, opens it and gives it a statement account, as "My bank isn't listed" does. */
  function visitWithAccount(): { id: string; accountId: string } {
    const id = demo.createBusiness(OWNER, INPUT);
    demo.setBusiness(id);
    const accountId = `${id}-statement`;
    demo.addAccount(volksbank(accountId));
    return { id, accountId };
  }

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    demo = TestBed.inject(DemoStateService);
    service = TestBed.inject(StatementImportService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Café Linde's Sparkasse statement", () => {
    beforeEach(() => demo.setBusiness('cafe-linde'));

    it('cafe preview: 5 new, 2 already here', () => {
      const statement = service.nextSample('cl-sparkasse');
      const preview = service.preview('cl-sparkasse', statement, statement.mapping!);
      expect(preview).toMatchObject({ newCount: 5, duplicateCount: 2, closedCount: 0, unreadable: 0, from: '2026-10-05', to: '2026-10-21' });
      expect(preview.rows.filter((row) => row.state === 'duplicate').map((row) => row.duplicateOf)).toEqual(['cl-t3', 'cl-t4']);
    });

    it('importing adds 5 payments, books 3 automatically, 2 need you, ticks the bank step', async () => {
      demo.setSetup('new');
      const before = payments().length;
      const statement = service.nextSample('cl-sparkasse');

      const done = service.import('cl-sparkasse', statement, statement.mapping!);
      expect(service.importing()).toBe(true);
      await vi.advanceTimersByTimeAsync(IMPORT_MS - 1);
      expect(service.importing()).toBe(true);
      expect(payments()).toHaveLength(before);
      expect(demo.setup().bank).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      const summary = await done;
      expect(service.importing()).toBe(false);
      expect(summary).toEqual({ importId: 'imp-1', added: 5, bookedAutomatically: 3, needsYou: 2, skipped: 2 });
      expect(payments()).toHaveLength(before + 5);
      expect(demo.setup()).toEqual({ bank: true, tax: false, receipt: false });
      expect(demo.business().imports).toEqual([
        {
          id: 'imp-1',
          accountId: 'cl-sparkasse',
          statementId: 'cl-sparkasse-oktober',
          fileName: 'sparkasse-oktober.csv',
          importedOn: DEMO_TODAY,
          paymentIds: ['imp-1-r0', 'imp-1-r1', 'imp-1-r2', 'imp-1-r4', 'imp-1-r6'],
          skippedCount: 2,
        },
      ]);
    });

    it('builds the payments as the statement says, in the account it was imported into', async () => {
      await run('cl-sparkasse', service.nextSample('cl-sparkasse'));
      expect(paymentOf('Kontoführung')).toMatchObject({
        id: 'imp-1-r6',
        accountId: 'cl-sparkasse',
        date: '2026-10-05',
        amountCents: -1290,
        receipt: 'notNeeded',
        confirmed: true,
        booking: { labelKey: 'bankFees', skr03: '4970' },
      });
      expect(paymentOf('Kontoführung').history.map((line) => line.key)).toEqual(['autoBooked', 'imported']);
      expect(paymentOf('Kontoführung').history.at(-1)!.params).toEqual({ account: 'Sparkasse', file: 'sparkasse-oktober.csv' });
      expect(paymentStatus(paymentOf('Kartenumsätze SumUp'))).toBe('booked');
      expect(paymentStatus(paymentOf('Versicherung Allianz'))).toBe('booked');
      expect(paymentStatus(paymentOf('Metro Großmarkt'))).toBe('noReceipt');
      expect(paymentStatus(paymentOf('Bäckerei-Großhandel Krüger'))).toBe('noReceipt');
      // The two rows the app had already (electricity and water, rent) were skipped: no payment of the import is for them.
      const names = payments().filter((tx) => tx.id.startsWith('imp-1-')).map((tx) => tx.counterparty);
      expect(names).toHaveLength(5);
      expect(names).not.toContain('Stadtwerke Hamburg');
      expect(names).not.toContain('Hausverwaltung Lindenallee');
    });

    it('puts the first row of the file in front, so payments of one day keep the order of the file', async () => {
      const before = payments().map((tx) => tx.id);
      await run('cl-sparkasse', service.nextSample('cl-sparkasse'));
      expect(payments().map((tx) => tx.id)).toEqual(['imp-1-r0', 'imp-1-r1', 'imp-1-r2', 'imp-1-r4', 'imp-1-r6', ...before]);
    });

    it('importing the same statement twice adds nothing', async () => {
      await run('cl-sparkasse', service.nextSample('cl-sparkasse'));
      const after = demo.business();

      const statement = service.nextSample('cl-sparkasse'); // once its samples are used, the last again
      expect(service.preview('cl-sparkasse', statement, statement.mapping!)).toMatchObject({ newCount: 0, duplicateCount: 7 });
      const summary = await run('cl-sparkasse', statement);

      expect(summary).toEqual({ importId: '', added: 0, bookedAutomatically: 0, needsYou: 0, skipped: 7 });
      expect(demo.business()).toBe(after);
      expect(demo.business().imports).toHaveLength(1);
    });

    it("year figures move by exactly the booked new rows of Café's import", async () => {
      const before = yearSummary(demo.business());
      await run('cl-sparkasse', service.nextSample('cl-sparkasse'));
      const after = yearSummary(demo.business());

      // Card sales of 1.284,50 € at 19 % are 1.079,41 € net; the fee (4970) and the insurance (4360) carry no VAT. The two suppliers still need a receipt, so they do not count yet.
      expect(after.paymentsIncomeCents - before.paymentsIncomeCents).toBe(107941);
      expect(after.paymentsCostsCents - before.paymentsCostsCents).toBe(1290 + 8900);
      expect(after.profitCents - before.profitCents).toBe(107941 - 1290 - 8900);
      expect(after.byCategory.find((c) => c.labelKey === 'bankFees')?.cents).toBe(1290);
      expect(after.byCategory.find((c) => c.labelKey === 'goods7')?.cents).toBe(before.byCategory.find((c) => c.labelKey === 'goods7')!.cents);
    });

    it('undo refused once a payment was answered', async () => {
      await run('cl-sparkasse', service.nextSample('cl-sparkasse'));
      demo.updateTransaction('imp-1-r1', (tx) => changeCategory(tx, SUPPLIES));
      const business = demo.business();

      expect(undoBlockedBy(business, business.imports[0], () => false)).toBe('worked');
      expect(demo.undoImport('imp-1')).toBe(false);
      expect(demo.business()).toBe(business);
    });

    it('undo refused once a month of its payments is closed', async () => {
      const september: SampleStatement = {
        id: 'test-september',
        fileName: 'september.csv',
        format: 'bankCsv',
        bankLabel: 'Test CSV',
        header: ['Datum', 'Name', 'Betrag'],
        cells: [['12.09.2026', 'Testzahlung', '-10,00']],
        mapping: { roles: ['date', 'who', 'amount'], moneyOut: 'minus' },
        meta: [{ booking: 'bankFees', confirmed: true, receipt: 'notNeeded' }],
      };
      expect(await run('cl-sparkasse', september)).toMatchObject({ added: 1, bookedAutomatically: 1 });
      expect(undoBlockedBy(demo.business(), demo.business().imports[0], () => false)).toBeNull();

      // Café's third-quarter return is sent: July to September are closed from then on.
      demo.recordSentReturn({ periodStart: '2026-07-01', periodEnd: '2026-09-30', sentOn: DEMO_TODAY, chargedCents: 0, paidCents: 0, resultCents: 0, ticket: 'ET-2026-1022-00001', taxOffice: null });
      const business = demo.business();
      expect(demo.undoImport('imp-1')).toBe(false);
      expect(demo.business()).toBe(business);
    });

    it('imports into the business that started it, even when another is opened meanwhile', async () => {
      const weber = businessOf(demo, 'weber-design');
      const statement = service.nextSample('cl-sparkasse');
      const done = service.import('cl-sparkasse', statement, statement.mapping!);
      demo.setBusiness('weber-design');
      await vi.advanceTimersByTimeAsync(IMPORT_MS);

      expect(await done).toMatchObject({ added: 5 });
      expect(demo.business()).toBe(weber);
      expect(businessOf(demo, 'cafe-linde').imports).toHaveLength(1);
      expect(businessOf(demo, 'cafe-linde').transactions).toHaveLength(BUSINESSES[2].transactions.length + 5);
    });
  });

  describe("Weber Design's Volksbank statement (an account the person added)", () => {
    beforeEach(() => demo.addAccount(volksbank()));

    it("weber's volksbank row links its receipt automatically", async () => {
      const statement = service.nextSample('wd-volksbank');
      expect(statement.id).toBe('wd-volksbank-oktober');
      const summary = await run('wd-volksbank', statement);

      const mayer = paymentOf('Druckerei Mayer');
      expect(mayer).toMatchObject({ accountId: 'wd-volksbank', amountCents: -14280, receipt: 'attached', receiptFile: 'druckerei-mayer-rechnung.pdf' });
      expect(mayer.history[0].key).toBe('receiptLinkedAuto');
      expect(paymentStatus(mayer)).toBe('booked');
      expect(doc('wd-d8').paymentId).toBe(mayer.id);
      expect(doc('wd-d8').history[0]).toMatchObject({ key: 'linkedAuto', params: { name: 'Druckerei Mayer' } });

      // Nothing else is matched by guessing: the PayPal payment has no category and no receipt.
      expect(paymentStatus(paymentOf('PayPal (Europe)'))).toBe('unclear');
      expect(paymentOf('PayPal (Europe)').receipt).toBe('missing');
      expect(summary).toEqual({ importId: 'imp-1', added: 4, bookedAutomatically: 3, needsYou: 1, skipped: 0 });
    });

    it("an invoice named in a row's reference is paid automatically", async () => {
      expect(invoiceStatus(invoice('RE-2026-039'), demo.business())).toBe('overdue');
      await run('wd-volksbank', service.nextSample('wd-volksbank'));

      const lange = paymentOf('Bäckerei Lange');
      expect(lange.history.find((line) => line.key === 'paysInvoice')).toEqual({ date: DEMO_TODAY, key: 'paysInvoice', params: { number: 'RE-2026-039', auto: 'true' } });
      expect(invoice('RE-2026-039').paymentIds).toEqual([lange.id]);
      expect(invoiceStatus(invoice('RE-2026-039'), demo.business())).toBe('paid');
      expect(doc('wd-d3')).toMatchObject({ paymentId: lange.id });
      expect(doc('wd-d3').history[0].key).toBe('linkedAuto');
      expect(paymentStatus(lange)).toBe('booked');
    });

    it('undo removes payments and their automatic links', async () => {
      const before = structuredClone(demo.business());
      const summary = (await run('wd-volksbank', service.nextSample('wd-volksbank')))!;
      expect(payments()).toHaveLength(before.transactions.length + 4);

      expect(demo.undoImport(summary.importId)).toBe(true);

      expect(demo.business().transactions).toEqual(before.transactions);
      expect(demo.business().documents).toEqual(before.documents);
      expect(demo.business().invoices).toEqual(before.invoices);
      expect(invoiceStatus(invoice('RE-2026-039'), demo.business())).toBe('overdue');
      expect(doc('wd-d8').paymentId).toBeNull();
      expect(demo.business().imports).toEqual([]);
      expect(demo.business().history[0]).toEqual({ date: DEMO_TODAY, key: 'importUndone', params: { file: 'volksbank-oktober.xml' } });
    });

    it('imports again after an undo, with an id of its own', async () => {
      await run('wd-volksbank', service.nextSample('wd-volksbank'));
      expect(demo.undoImport('imp-1')).toBe(true);

      const again = await run('wd-volksbank', service.nextSample('wd-volksbank'));
      expect(again).toMatchObject({ importId: 'imp-2', added: 4 });
      expect(payments().filter((tx) => tx.accountId === 'wd-volksbank').map((tx) => tx.id).sort()).toEqual(['imp-2-r0', 'imp-2-r1', 'imp-2-r2', 'imp-2-r3']);
      expect(doc('wd-d8').paymentId).toBe('imp-2-r1');
    });

    it('undo is refused once the person worked on a payment that was matched on its own', async () => {
      await run('wd-volksbank', service.nextSample('wd-volksbank'));
      demo.updateTransaction('imp-1-r1', (tx) => changeCategory(tx, SUPPLIES)); // the Druckerei Mayer payment, matched to its receipt on its own
      const business = demo.business();
      expect(demo.undoImport('imp-1')).toBe(false);
      expect(demo.business()).toBe(business);
      expect(doc('wd-d8').paymentId).toBe('imp-1-r1');
    });
  });

  describe("Sara Weber Yoga's export with an unknown layout", () => {
    beforeEach(() => demo.setBusiness('sara-yoga'));

    it("sara's statement needs columns matched; complete mapping previews 4 new", () => {
      const statement = service.nextSample('sy-qonto');
      expect(statement.mapping).toBeNull();

      const nothing: ColumnMapping = { roles: statement.header.map(() => 'ignore'), moneyOut: 'minus' };
      expect(service.preview('sy-qonto', statement, nothing)).toMatchObject({ newCount: 0, unreadable: 4 });

      const wrongDate: ColumnMapping = { ...guessMapping(statement), roles: guessMapping(statement).roles.map((role, i) => (i === 0 ? 'ignore' : i === 2 ? 'date' : role)) };
      expect(service.preview('sy-qonto', statement, wrongDate)).toMatchObject({ newCount: 0, unreadable: 4 });

      expect(service.preview('sy-qonto', statement, guessMapping(statement))).toMatchObject({
        newCount: 4,
        duplicateCount: 0,
        closedCount: 0,
        unreadable: 0,
        from: '2026-10-06',
        to: '2026-10-20',
      });
    });

    it('imports the rows with the signs the Betrag column carries', async () => {
      const summary = await run('sy-qonto', service.nextSample('sy-qonto'));
      expect(summary).toEqual({ importId: 'imp-1', added: 4, bookedAutomatically: 2, needsYou: 2, skipped: 0 });
      expect(paymentOf('Bettina Schulz')).toMatchObject({ amountCents: 6000, accountId: 'sy-qonto', booking: { labelKey: 'revenueKU' }, receipt: 'missing' });
      expect(paymentOf('Hiscox Versicherung')).toMatchObject({ amountCents: -3200, reference: 'Berufshaftpflicht Oktober' });
    });

    it('an incomplete mapping imports nothing', async () => {
      const statement = service.nextSample('sy-qonto');
      const before = demo.business();
      const summary = await run('sy-qonto', statement, { roles: statement.header.map(() => 'ignore'), moneyOut: 'minus' });
      expect(summary).toEqual({ importId: '', added: 0, bookedAutomatically: 0, needsYou: 0, skipped: 0 });
      expect(demo.business()).toBe(before);
    });

    it("a row in a month that is closed (Sara's August) is not imported", async () => {
      const august: SampleStatement = {
        id: 'test-august',
        fileName: 'august.csv',
        format: 'bankCsv',
        bankLabel: 'Test CSV',
        header: ['Datum', 'Name', 'Betrag'],
        cells: [['12.08.2026', 'Zu spät', '-10,00'], ['12.10.2026', 'Rechtzeitig', '-11,00']],
        mapping: { roles: ['date', 'who', 'amount'], moneyOut: 'minus' },
        meta: [{ booking: 'bankFees', confirmed: true, receipt: 'notNeeded' }, { booking: 'bankFees', confirmed: true, receipt: 'notNeeded' }],
      };
      expect(service.preview('sy-qonto', august, august.mapping!)).toMatchObject({ newCount: 1, closedCount: 1 });
      expect(await run('sy-qonto', august)).toMatchObject({ added: 1, skipped: 0 });
      expect(payments().map((tx) => tx.counterparty)).toContain('Rechtzeitig');
      expect(payments().map((tx) => tx.counterparty)).not.toContain('Zu spät');
    });

    it('an ended bank connection can still take a statement', async () => {
      expect(demo.business().accounts.find((a) => a.id === 'sy-qonto')!.connection.consentUntil).toBe('2026-10-20');
      expect(await run('sy-qonto', service.nextSample('sy-qonto'))).toMatchObject({ added: 4 });
    });
  });

  describe('a business made during the visit', () => {
    it('visit business gets the generic statement', async () => {
      const { id, accountId } = visitWithAccount();
      expect(demo.setup().bank).toBe(false);

      const statement = service.nextSample(accountId);
      expect(statement.id).toBe(`generic-${id}`);
      expect(service.preview(accountId, statement, statement.mapping!)).toMatchObject({ newCount: 8, duplicateCount: 0 });

      // A new client has no receipts yet, so nothing is booked on its own.
      expect(await run(accountId, statement)).toEqual({ importId: 'imp-1', added: 8, bookedAutomatically: 0, needsYou: 8, skipped: 0 });
      expect(payments()).toHaveLength(8);
      expect(payments().every((tx) => tx.accountId === accountId)).toBe(true);
      expect(demo.setup().bank).toBe(true);
    });

    it('connecting the demo bank after importing the generic statement adds no duplicate payments', async () => {
      const { id, accountId } = visitWithAccount();
      await run(accountId, service.nextSample(accountId));
      const imported = payments().map((tx) => tx.id);
      expect(imported).toHaveLength(8);

      demo.connectAccounts('qonto', foundAccountsOf(id, 'qonto'), '2026-01-01');

      expect(payments().map((tx) => tx.id)).toEqual(imported);
      expect(demo.business().accounts.map((a) => a.id)).toEqual([accountId, `${id}-main`]);
    });

    it('hands out the statement of each account in turn, in each data generation (no sample has a second statement yet, so the last repeats)', () => {
      const { id, accountId } = visitWithAccount();
      const counts = (): Record<string, number> => Object.fromEntries((service as unknown as { used: Map<string, number> }).used);
      demo.addAccount(volksbank(`${id}-second`));

      service.nextSample(accountId);
      service.nextSample(accountId);
      service.nextSample(`${id}-second`);
      expect(counts()).toEqual({ [`0:${id}:${accountId}`]: 2, [`0:${id}:${id}-second`]: 1 });

      demo.resetData();
      demo.setBusiness('cafe-linde');
      service.nextSample('cl-sparkasse');
      expect(counts()[`1:cafe-linde:cl-sparkasse`]).toBe(1);
    });
  });

  describe('importing', () => {
    it('reset during importing imports nothing', async () => {
      demo.setBusiness('cafe-linde');
      const statement = service.nextSample('cl-sparkasse');
      const done = service.import('cl-sparkasse', statement, statement.mapping!);
      expect(service.importing()).toBe(true);

      demo.resetData();
      expect(service.importing()).toBe(false);
      await vi.advanceTimersByTimeAsync(IMPORT_MS);

      expect(await done).toBeNull();
      expect(businessOf(demo, 'cafe-linde')).toEqual(BUSINESSES[2]);
      expect(service.importing()).toBe(false);
    });

    it('a second import while one is running changes nothing, and says so', async () => {
      demo.setBusiness('cafe-linde');
      const statement = service.nextSample('cl-sparkasse');
      const first = service.import('cl-sparkasse', statement, statement.mapping!);
      const second = service.import('cl-sparkasse', statement, statement.mapping!);
      await vi.advanceTimersByTimeAsync(IMPORT_MS);

      expect(await second).toBeNull();
      expect(await first).toMatchObject({ importId: 'imp-1', added: 5 });
      expect(demo.business().imports).toHaveLength(1);
    });

    it('an import can start again once the reset has dropped the earlier one', async () => {
      demo.setBusiness('cafe-linde');
      const statement = service.nextSample('cl-sparkasse');
      const dropped = service.import('cl-sparkasse', statement, statement.mapping!);
      demo.resetData();
      demo.setBusiness('cafe-linde');
      const fresh = service.import('cl-sparkasse', statement, statement.mapping!);
      await vi.advanceTimersByTimeAsync(IMPORT_MS);

      expect(await dropped).toBeNull();
      expect(await fresh).toMatchObject({ added: 5 });
      expect(service.importing()).toBe(false);
    });

    it('an account that is not there takes nothing', async () => {
      demo.setBusiness('cafe-linde');
      const statement = service.nextSample('cl-sparkasse');
      const before = demo.business();
      expect(await run('nope', statement)).toBeNull();
      expect(demo.business()).toBe(before);
    });

    it('asking for a statement of an account that is not there is a mistake of the caller', () => {
      expect(() => service.nextSample('nope')).toThrow();
    });

    it('the preview follows the open business: its payments decide what is already here', () => {
      demo.setBusiness('cafe-linde');
      const statement = service.nextSample('cl-sparkasse');
      expect(service.preview('cl-sparkasse', statement, statement.mapping!).duplicateCount).toBe(2);
      demo.setBusiness('weber-design');
      // Weber has no account cl-sparkasse and none of these payments.
      expect(service.preview('cl-sparkasse', statement, statement.mapping!).duplicateCount).toBe(0);
    });
  });
});
