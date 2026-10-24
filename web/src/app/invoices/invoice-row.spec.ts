import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { CATEGORIES } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Doc, Invoice } from '../data/models';
import { addDays } from '../domain/bank-connection';
import { invoiceRows, type InvoiceRow } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceListRow } from './invoice-row';

const FILE_DOC: Doc = {
  id: 'f-1',
  fileName: 'rechnung-hartmann.pdf',
  source: 'file',
  addedOn: '2026-10-12',
  fromUpload: true,
  reading: false,
  name: 'Hartmann Verlag',
  direction: 'sent',
  invoiceNo: '2026-17',
  date: '2026-10-12',
  dueDate: '2026-11-11',
  amountCents: 47600,
  vatRate: 19,
  duplicateOf: null,
  booking: CATEGORIES[0],
  bookingConfirmed: true,
  paymentId: null,
  history: [],
  invoice: null,
  selfIssued: null,
};

describe('InvoiceListRow', () => {
  let demo: DemoStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const rows = (): InvoiceRow[] => invoiceRows(demo.business(), demo.setup());
  const rowOf = (number: string): InvoiceRow =>
    rows().find((r) => (r.kind === 'invoice' ? r.invoice.number : r.doc.invoiceNo) === number)!;

  function render(row: InvoiceRow): HTMLElement {
    const fixture = TestBed.createComponent(InvoiceListRow);
    fixture.componentRef.setInput('row', row);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** Changes an invoice of the open business and renders its row again. */
  function changed(number: string, change: (invoice: Invoice) => Invoice): HTMLElement {
    const invoice = (rowOf(number) as Extract<InvoiceRow, { kind: 'invoice' }>).invoice;
    demo.saveInvoice(change(invoice));
    return render(rowOf(number));
  }

  /** The words of a node on one line; the marks that keep an amount left-to-right are not words. */
  const text = (node: Element | null) =>
    node?.textContent
      ?.replace(/[\u2066-\u2069]/g, '')
      .replace(/\s+/g, ' ')
      .trim() ?? '';
  const q = (el: HTMLElement, testId: string) =>
    el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  describe('an open invoice', () => {
    it('shows the customer, the number and date, the amount, and when it is due', () => {
      const el = render(rowOf('RE-2026-044'));
      expect(text(q(el, 'invoice-name'))).toBe('Studio Kern');
      expect(text(q(el, 'invoice-meta'))).toBe('RE-2026-044 · 16 Oct');
      expect(text(q(el, 'invoice-amount'))).toBe('€2,380.00');
      expect(text(q(el, 'invoice-status'))).toBe('Due 30 Oct');
    });

    it('opens the invoice, and has no reminder button', () => {
      const el = render(rowOf('RE-2026-044'));
      expect(q(el, 'invoice-link')!.getAttribute('href')).toBe('/invoices/inv-wd-044');
      expect(q(el, 'invoice-remind')).toBeNull();
      expect(q(el, 'invoice-reminded')).toBeNull();
    });

    it('says Due today on the day it is due', () => {
      const el = changed('RE-2026-044', (i) => ({
        ...i,
        issueDate: addDays(DEMO_TODAY, -14),
        paymentTermDays: 14,
      }));
      expect(text(q(el, 'invoice-status'))).toBe('Due today');
      expect(q(el, 'invoice-remind')).toBeNull();
    });
  });

  describe('an overdue invoice', () => {
    it('is red and says for how many days', () => {
      const el = render(rowOf('RE-2026-039'));
      expect(text(q(el, 'invoice-name'))).toBe('Bäckerei Lange');
      expect(text(q(el, 'invoice-status'))).toBe('Overdue 22 days');
      expect(q(el, 'invoice-status')!.className).toContain('text-negative');
    });

    it('says day, not days, for one day', () => {
      const el = changed('RE-2026-039', (i) => ({
        ...i,
        issueDate: addDays(DEMO_TODAY, -15),
        paymentTermDays: 14,
      }));
      expect(text(q(el, 'invoice-status'))).toBe('Overdue 1 day');
    });

    it('offers Send reminder right on the row, as a link to the invoice with the reminder open', () => {
      const el = render(rowOf('RE-2026-039'));
      const remind = q(el, 'invoice-remind')!;
      expect(text(remind)).toBe('Send reminder');
      expect(remind.tagName).toBe('A');
      expect(remind.getAttribute('href')).toBe('/invoices/inv-wd-039?remind=1');
      expect(q(el, 'invoice-reminded')).toBeNull();
      // a link inside a link is not allowed: the button sits beside the row's own link
      expect(remind.closest('[data-testid="invoice-link"]')).toBeNull();
      expect(remind.getAttribute('aria-describedby')).toBe(q(el, 'invoice-name')!.id);
    });

    it('offers Send formal reminder once the friendly one is a week old, and says when that was sent', () => {
      demo.setBusiness('cafe-linde');
      const el = render(rowOf('RE-2026-053'));
      expect(text(q(el, 'invoice-name'))).toBe('Kanzlei Hoffmann');
      expect(text(q(el, 'invoice-status'))).toBe('Overdue 13 days');
      expect(text(q(el, 'invoice-remind'))).toBe('Send formal reminder');
      expect(q(el, 'invoice-remind')!.getAttribute('href')).toBe('/invoices/inv-cl-053?remind=1');
      expect(text(q(el, 'invoice-reminded'))).toBe('Reminded 12 Oct');
    });

    it('between the two levels there is no button, only when it was reminded and when the formal one is possible', () => {
      const el = changed('RE-2026-039', (i) => ({
        ...i,
        reminders: [{ level: 1, sentOn: '2026-10-20' }],
      }));
      expect(q(el, 'invoice-remind')).toBeNull();
      expect(text(q(el, 'invoice-reminded'))).toBe(
        'Reminded 20 Oct · formal reminder possible from 27 Oct',
      );
    });

    it('after the formal reminder there is only the date of the last one', () => {
      const el = changed('RE-2026-039', (i) => ({
        ...i,
        reminders: [
          { level: 1, sentOn: '2026-10-05' },
          { level: 2, sentOn: '2026-10-15' },
        ],
      }));
      expect(q(el, 'invoice-remind')).toBeNull();
      expect(text(q(el, 'invoice-reminded'))).toBe('Reminded 15 Oct');
    });

    it('an invoice that is not overdue shows no reminder line, even when it was reminded earlier', () => {
      const el = changed('RE-2026-044', (i) => ({
        ...i,
        reminders: [{ level: 1, sentOn: '2026-10-20' }],
      }));
      expect(q(el, 'invoice-reminded')).toBeNull();
    });
  });

  describe('the other statuses', () => {
    it('a draft has "Draft" where the number would be, and its amount', () => {
      const el = render(rows()[0]); // drafts come first
      expect(text(q(el, 'invoice-name'))).toBe('Bezirksamt Pankow');
      expect(text(q(el, 'invoice-meta'))).toBe('Draft · 22 Oct');
      expect(text(q(el, 'invoice-amount'))).toBe('€4,165.00');
      expect(text(q(el, 'invoice-status'))).toBe('Draft');
      expect(q(el, 'invoice-link')!.getAttribute('href')).toBe('/invoices/inv-wd-draft');
      expect(q(el, 'invoice-remind')).toBeNull();
    });

    it('a draft with no customer yet says so', () => {
      const draft = (rows()[0] as Extract<InvoiceRow, { kind: 'invoice' }>).invoice;
      demo.saveInvoice({ ...draft, customer: { ...draft.customer, name: '  ' } });
      const el = render(rows()[0]);
      expect(text(q(el, 'invoice-name'))).toBe('No customer yet');
    });

    it('a paid invoice says the day the money came in, in green', () => {
      const el = render(rowOf('RE-2026-041'));
      expect(text(q(el, 'invoice-status'))).toBe('Paid 20 Oct');
      expect(q(el, 'invoice-status')!.className).toContain('text-positive');
      expect(text(q(el, 'invoice-amount'))).toBe('€1,500.00');
    });

    it('a part-paid invoice says what is left, and keeps its full amount', () => {
      demo.setBusiness('sara-yoga');
      const el = render(rowOf('RE-2026-021'));
      expect(text(q(el, 'invoice-status'))).toBe('Partly paid · €300.00 left');
      expect(text(q(el, 'invoice-amount'))).toBe('€600.00');
      expect(q(el, 'invoice-remind')).toBeNull();
    });

    it('a part-paid invoice past its due date can be reminded', () => {
      demo.setBusiness('sara-yoga');
      const el = changed('RE-2026-021', (i) => ({
        ...i,
        issueDate: '2026-09-01',
        paymentTermDays: 14,
      }));
      expect(text(q(el, 'invoice-status'))).toBe('Partly paid · €300.00 left');
      expect(text(q(el, 'invoice-remind'))).toBe('Send reminder');
    });

    it('a cancelled invoice says Cancelled, and its cancellation invoice says Cancellation with a negative amount', () => {
      const cancelled = render(rowOf('RE-2026-040'));
      expect(text(q(cancelled, 'invoice-status'))).toBe('Cancelled');
      expect(text(q(cancelled, 'invoice-amount'))).toBe('€595.00');
      expect(q(cancelled, 'invoice-remind')).toBeNull();
      const cancellation = render(rowOf('RE-2026-042'));
      expect(text(q(cancellation, 'invoice-status'))).toBe('Cancellation');
      expect(text(q(cancellation, 'invoice-amount'))).toBe('-€595.00');
    });
  });

  describe('an invoice added from a file', () => {
    function fileRow(patch: Partial<Doc> = {}): InvoiceRow {
      const doc = { ...FILE_DOC, ...patch };
      demo.addDocument('weber-design', doc);
      return rows().find((r) => r.kind === 'file' && r.doc.id === doc.id)!;
    }

    it('says where it comes from, shows its own data and opens the document on Documents', () => {
      const el = render(fileRow());
      expect(text(q(el, 'invoice-name'))).toBe('Hartmann Verlag');
      expect(text(q(el, 'invoice-meta'))).toBe('2026-17 · 12 Oct · Added from a file');
      expect(text(q(el, 'invoice-amount'))).toBe('€476.00');
      expect(text(q(el, 'invoice-status'))).toBe('Due 11 Nov');
      expect(q(el, 'invoice-link')!.getAttribute('href')).toBe('/documents/f-1');
      expect(q(el, 'invoice-remind')).toBeNull();
    });

    it('an overdue one counts its days and is red, with no reminder: it is not written here', () => {
      const el = render(fileRow({ id: 'f-2', invoiceNo: '2026-18', dueDate: '2026-10-12' }));
      expect(text(q(el, 'invoice-status'))).toBe('Overdue 10 days');
      expect(q(el, 'invoice-status')!.className).toContain('text-negative');
      expect(q(el, 'invoice-remind')).toBeNull();
    });

    it('one without a due date is simply Open', () => {
      const el = render(fileRow({ id: 'f-3', invoiceNo: '2026-19', dueDate: null }));
      expect(text(q(el, 'invoice-status'))).toBe('Open');
    });

    it('a paid one says Paid, with the day when its payment is known', () => {
      const tx = demo.business().transactions.find((t) => t.amountCents > 0)!;
      const el = render(fileRow({ id: 'f-4', invoiceNo: '2026-20', paymentId: tx.id }));
      expect(text(q(el, 'invoice-status'))).toMatch(/^Paid \d{1,2} \w{3}$/);
      expect(q(el, 'invoice-status')!.className).toContain('text-positive');
    });

    it('with no number the date comes first, with no stray dot', () => {
      const el = render(fileRow({ id: 'f-5', invoiceNo: '' }));
      expect(text(q(el, 'invoice-meta'))).toBe('12 Oct · Added from a file');
    });
  });

  describe('left to right', () => {
    it('keeps the number, the amount and the dates in their own order in Arabic', () => {
      TestBed.inject(LanguageService).setLang('ar');
      const el = render(rowOf('RE-2026-044'));
      for (const id of ['invoice-amount']) {
        expect(q(el, id)!.closest('bdi')!.getAttribute('dir'), id).toBe('ltr');
      }
      const number = q(el, 'invoice-meta')!.querySelector('bdi')!;
      expect(number.getAttribute('dir')).toBe('ltr');
      expect(number.textContent!.trim()).toBe('RE-2026-044');
      expect(q(el, 'invoice-name')!.getAttribute('dir')).toBe('auto');
      expect(text(q(el, 'invoice-status'))).not.toContain('Due');
    });

    it('wraps the amount of "partly paid" so the euro sign stays with its digits in Arabic', () => {
      TestBed.inject(LanguageService).setLang('ar');
      demo.setBusiness('sara-yoga');
      const el = render(rowOf('RE-2026-021'));
      expect(q(el, 'invoice-status')!.textContent).toMatch(/⁦[^⁩]*300[^⁩]*⁩/);
    });
  });
});
