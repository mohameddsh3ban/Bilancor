import { TestBed } from '@angular/core/testing';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { invoiceRowOf, type InvoiceRow } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceStatusChip, chipView, paidOn } from './invoice-status-chip';

describe('invoice status chip', () => {
  let demo: DemoStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    demo = TestBed.inject(DemoStateService);
  });

  const rowOf = (id: string): InvoiceRow => invoiceRowOf(demo.business(), demo.setup(), id)!;

  describe('paidOn', () => {
    it('is the day of the latest of the payments', () => {
      // Weber's payments wd-t7 (9 Oct) and wd-t1 (20 Oct): the invoice was paid when the last of them came in.
      expect(paidOn(['wd-t7', 'wd-t1'], demo.business())).toBe('2026-10-20');
      expect(paidOn(['wd-t1', 'wd-t7'], demo.business())).toBe('2026-10-20');
    });

    it('is none without a payment the business knows', () => {
      expect(paidOn([], demo.business())).toBeNull();
      expect(paidOn(['nope'], demo.business())).toBeNull();
    });
  });

  describe('chipView', () => {
    it('says Draft, Cancelled and Cancellation in grey words', () => {
      expect(chipView(rowOf('inv-wd-draft'), demo.business())).toMatchObject({
        key: 'draft',
        tone: 'neutral',
      });
      expect(chipView(rowOf('inv-wd-040'), demo.business())).toMatchObject({
        key: 'cancelled',
        tone: 'neutral',
      });
      expect(chipView(rowOf('inv-wd-042'), demo.business())).toMatchObject({
        key: 'cancellation',
        tone: 'neutral',
      });
    });

    it('counts the days an invoice is overdue, with its own wording for one day', () => {
      expect(chipView(rowOf('inv-wd-039'), demo.business())).toMatchObject({
        key: 'overdueDays.many',
        tone: 'late',
        days: 22,
      });
      expect(chipView(rowOf('inv-wd-039'), demo.business(), '2026-10-01')).toMatchObject({
        key: 'overdueDays.one',
        days: 1,
      });
    });

    it('says when it is paid', () => {
      expect(chipView(rowOf('inv-wd-043'), demo.business())).toMatchObject({
        key: 'paidOn',
        tone: 'paid',
        date: '2026-10-09',
      });
    });

    it('a paid invoice with no payment the business knows just says Paid', () => {
      const { invoice } = rowOf('inv-wd-043') as Extract<InvoiceRow, { kind: 'invoice' }>;
      const row: InvoiceRow = {
        kind: 'invoice',
        invoice: { ...invoice, paymentIds: [] },
        status: 'paid',
      };
      expect(chipView(row, demo.business())).toMatchObject({
        key: 'paid',
        tone: 'paid',
        date: null,
      });
    });
  });

  it('renders the words of the chip with its colour', () => {
    const fixture = TestBed.createComponent(InvoiceStatusChip);
    fixture.componentRef.setInput('row', rowOf('inv-wd-039'));
    fixture.detectChanges();
    const chip = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="invoice-status"]',
    )!;
    expect(chip.textContent?.trim()).toBe('Overdue 22 days');
    expect(chip.className).toContain('text-negative');
  });
});
