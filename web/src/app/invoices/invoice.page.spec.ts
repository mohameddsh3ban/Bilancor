import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance } from 'vitest';
import { routes } from '../app.routes';
import { formatDate } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DEMO_TODAY } from '../data/demo-date';
import { owedSummary } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService } from '../state/invoice.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { InvoicePage } from './invoice.page';

/** Stands in for the edit page, which comes with the new-invoice screen: the page only has to lead there. */
@Component({ template: '' })
class EditStub {}

const body = (testId: string) => document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

describe('InvoicePage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    harness = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: 'invoices/:id', component: InvoicePage },
          { path: 'invoices/:id/edit', component: EditStub },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** Opens an invoice; a test that opens another one navigates the harness it has. */
  async function render(url: string): Promise<void> {
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  /** The words of a node on one line; the marks that keep an amount left-to-right are not words. */
  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim() ?? '';
  const historyLines = () =>
    qa('history-item').map((item) => text(item.querySelector('[data-testid="history-text"]')));

  describe('the header', () => {
    it('names the customer, says where the invoice stands, and gives number, amount and due date', async () => {
      await render('/invoices/inv-wd-044');
      expect(text(q('invoice-customer'))).toBe('Studio Kern');
      expect(q('invoice-customer')!.tagName).toBe('H1');
      expect(text(q('invoice-status'))).toBe('Due 30 Oct');
      expect(text(q('invoice-meta'))).toBe(
        'Invoice (Rechnung) RE-2026-044 · €2,380.00 · due 30 Oct',
      );
      expect(q('invoice-meta')!.querySelector('bdi[dir="ltr"]')).not.toBeNull();
      // "Rechnung" is a German term: its explanation is one tap away.
      expect(q('invoice-meta')!.querySelector('button')).not.toBeNull();
    });

    it('shows the status of an overdue invoice in words', async () => {
      await render('/invoices/inv-wd-039');
      expect(text(q('invoice-customer'))).toBe('Bäckerei Lange');
      expect(text(q('invoice-status'))).toBe('Overdue 22 days');
      expect(text(q('invoice-meta'))).toBe(
        `Invoice (Rechnung) RE-2026-039 · €1,190.00 · due ${formatDate('2026-09-30', 'en')}`,
      );
    });

    it('a draft has no number yet, and says Draft', async () => {
      await render('/invoices/inv-wd-draft');
      expect(text(q('invoice-customer'))).toBe('Bezirksamt Pankow');
      expect(text(q('invoice-status'))).toBe('Draft');
      expect(text(q('invoice-meta'))).toBe('Invoice (Rechnung) · €4,165.00 · due 5 Nov');
    });

    it('a draft without a customer says so', async () => {
      const draft = demo.business().invoices.find((invoice) => invoice.id === 'inv-wd-draft')!;
      demo.saveInvoice({ ...draft, customer: { ...draft.customer, name: '' } });
      await render('/invoices/inv-wd-draft');
      expect(text(q('invoice-customer'))).toBe('No customer yet');
    });

    it('a cancellation invoice is named as one, with its negative amount and no due date', async () => {
      await render('/invoices/inv-wd-042');
      expect(text(q('invoice-customer'))).toBe('Agentur Nord');
      expect(text(q('invoice-status'))).toBe('Cancellation');
      expect(text(q('invoice-meta'))).toBe(
        'Cancellation invoice (Stornorechnung) RE-2026-042 · -€595.00',
      );
    });

    it('a cancelled invoice says Cancelled', async () => {
      await render('/invoices/inv-wd-040');
      expect(text(q('invoice-status'))).toBe('Cancelled');
    });

    it('a paid invoice says when it was paid', async () => {
      await render('/invoices/inv-wd-043');
      expect(text(q('invoice-status'))).toBe('Paid 9 Oct');
    });

    it('a part-paid invoice says what is left', async () => {
      demo.setBusiness('sara-yoga');
      await render('/invoices/inv-sy-021');
      expect(text(q('invoice-status'))).toBe('Partly paid · €300.00 left');
    });

    it('goes back to the list', async () => {
      await render('/invoices/inv-wd-044');
      expect(q('back-link')!.getAttribute('href')).toBe('/invoices');
      expect(text(q('back-link'))).toBe('Invoices');
    });
  });

  describe('the invoice itself', () => {
    it('is the paper, in a part of the page with a name', async () => {
      await render('/invoices/inv-wd-044');
      const section = q('invoice-paper')!.closest('section')!;
      expect(section.getAttribute('aria-label')).toBe('The invoice as your customer sees it');
      expect(text(q('paper-title'))).toBe('Rechnung');
      expect(text(q('paper-customer'))).toContain('Studio Kern');
    });

    it('the paper is ltr in Arabic, and the rest of the page mirrors', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('/invoices/inv-wd-044');
      expect(document.documentElement.dir).toBe('rtl');
      expect(q('invoice-paper')!.getAttribute('dir')).toBe('ltr');
      expect(q('invoice-paper')!.getAttribute('lang')).toBe('de');
      expect(text(q('back-link'))).toBe('الفواتير');
      expect(text(q('paper-title'))).toBe('Rechnung');
    });
  });

  describe('what happened', () => {
    it('lists the history, newest first, under its own heading', async () => {
      await render('/invoices/inv-wd-043');
      expect(text(q('history-section')!.querySelector('h2'))).toBe('What happened');
      expect(historyLines()).toEqual([
        'Paid in full',
        'You sent it by email to buchhaltung@atelier-sommer.example',
        'You created the invoice',
      ]);
      expect(qa('history-item').map((item) => text(item.querySelector('time')))).toEqual([
        '9 Oct',
        '8 Oct',
        '8 Oct',
      ]);
    });

    it('history links to the paying payment', async () => {
      await render('/invoices/inv-wd-043');
      const links = qa('history-link');
      expect(links).toHaveLength(1);
      expect(text(links[0])).toBe('Paid in full');
      expect(links[0].getAttribute('href')).toBe('/payments/wd-t7');
    });

    it('a part payment links to its payment', async () => {
      demo.setBusiness('sara-yoga');
      await render('/invoices/inv-sy-021');
      const links = qa('history-link');
      expect(links.map((link) => text(link))).toEqual(['Part payment received']);
      expect(links[0].getAttribute('href')).toBe('/payments/sy-t15');
    });

    it('several payments each link to their own, oldest to the first', async () => {
      demo.setBusiness('sara-yoga');
      const invoice = demo.business().invoices.find((i) => i.id === 'inv-sy-021')!;
      demo.saveInvoice({
        ...invoice,
        paymentIds: ['sy-t15', 'sy-t12'],
        history: [{ date: '2026-10-22', key: 'invoicePaid', params: {} }, ...invoice.history],
      });
      await render('/invoices/inv-sy-021');
      expect(qa('history-link').map((link) => [text(link), link.getAttribute('href')])).toEqual([
        ['Paid in full', '/payments/sy-t12'],
        ['Part payment received', '/payments/sy-t15'],
      ]);
    });

    it('a cash payment after a part payment: each line leads to its own payment', async () => {
      demo.setBusiness('sara-yoga');
      TestBed.inject(InvoiceService).markPaidInCash('inv-sy-021', DEMO_TODAY);
      const cash = demo.business().transactions[0];
      await render('/invoices/inv-sy-021');
      expect(historyLines()).toEqual([
        'Paid in full',
        'You marked it as paid in cash',
        'Part payment received',
        'You sent it by email to praxis@physio-zentrum-mitte.example',
        'You created the invoice',
      ]);
      expect(qa('history-link').map((link) => [text(link), link.getAttribute('href')])).toEqual([
        ['Paid in full', `/payments/${cash.id}`],
        ['Part payment received', '/payments/sy-t15'],
      ]);
    });

    it('a line that names its payment leads to that payment, whatever the order the payments are listed in', async () => {
      demo.setBusiness('sara-yoga');
      const invoice = demo.business().invoices.find((i) => i.id === 'inv-sy-021')!;
      // Listed the other way round than the lines: by place, the newest line would lead to sy-t12.
      demo.saveInvoice({
        ...invoice,
        paymentIds: ['sy-t15', 'sy-t12'],
        history: [
          { date: '2026-10-22', key: 'invoicePaid', params: { paymentId: 'sy-t15' } },
          { date: '2026-10-21', key: 'invoicePartlyPaid', params: { paymentId: 'sy-t12' } },
        ],
      });
      await render('/invoices/inv-sy-021');
      expect(qa('history-link').map((link) => [text(link), link.getAttribute('href')])).toEqual([
        ['Paid in full', '/payments/sy-t15'],
        ['Part payment received', '/payments/sy-t12'],
      ]);
    });

    it('a line that names a payment this business does not have is plain text', async () => {
      demo.setBusiness('sara-yoga');
      const invoice = demo.business().invoices.find((i) => i.id === 'inv-sy-021')!;
      demo.saveInvoice({
        ...invoice,
        history: [{ date: '2026-10-22', key: 'invoicePaid', params: { paymentId: 'gone' } }],
      });
      await render('/invoices/inv-sy-021');
      expect(qa('history-link')).toHaveLength(0);
      expect(historyLines()).toEqual(['Paid in full']);
    });

    it('a cancelled invoice links to its cancellation invoice, and that one back to the original', async () => {
      await render('/invoices/inv-wd-040');
      const link = q('history-link')!;
      expect(text(link)).toBe('You cancelled it with cancellation invoice RE-2026-042');
      expect(link.getAttribute('href')).toBe('/invoices/inv-wd-042');

      await render('/invoices/inv-wd-042');
      expect(historyLines()).toEqual(['You created it to cancel invoice RE-2026-040']);
      expect(q('history-link')!.getAttribute('href')).toBe('/invoices/inv-wd-040');
    });

    it('a copy links to the invoice it was copied from', async () => {
      const draft = demo.business().invoices.find((invoice) => invoice.id === 'inv-wd-draft')!;
      demo.saveInvoice({
        ...draft,
        history: [
          { date: '2026-10-22', key: 'invoiceDuplicated', params: { number: 'RE-2026-044' } },
        ],
      });
      await render('/invoices/inv-wd-draft');
      expect(text(q('history-link'))).toBe('You copied it from invoice RE-2026-044');
      expect(q('history-link')!.getAttribute('href')).toBe('/invoices/inv-wd-044');
    });

    it('lines that lead nowhere are plain text', async () => {
      await render('/invoices/inv-wd-039');
      expect(historyLines()).toEqual([
        'You sent it by email to info@baeckerei-lange.example',
        'You created the invoice',
      ]);
      expect(qa('history-link')).toHaveLength(0);
    });

    it('names the reminders by level', async () => {
      demo.setBusiness('cafe-linde');
      await render('/invoices/inv-cl-053');
      expect(historyLines()[0]).toBe('You sent reminder 1 of 2 by email');
    });
  });

  describe('the next step', () => {
    it('a draft offers Edit, a link to the edit page, and no PDF', async () => {
      await render('/invoices/inv-wd-draft');
      const edit = q('edit-invoice')!;
      expect(text(edit)).toBe('Edit');
      expect(edit.tagName).toBe('A');
      expect(edit.getAttribute('href')).toBe('/invoices/inv-wd-draft/edit');
      expect(q('download-pdf')).toBeNull();
    });

    it('a sent invoice offers Download PDF, a link to the print view, and no Edit', async () => {
      await render('/invoices/inv-wd-044');
      const download = q('download-pdf')!;
      expect(text(download)).toBe('Download PDF');
      expect(download.tagName).toBe('A');
      expect(download.getAttribute('href')).toBe('/print/invoice/inv-wd-044');
      expect(q('edit-invoice')).toBeNull();
    });

    it('every sent invoice can be downloaded: overdue, paid, cancelled and cancellation invoices too', async () => {
      for (const id of ['inv-wd-039', 'inv-wd-043', 'inv-wd-040', 'inv-wd-042']) {
        await render(`/invoices/${id}`);
        expect(q('download-pdf')!.getAttribute('href'), id).toBe(`/print/invoice/${id}`);
      }
    });

    it('every button of the next step does something: the PDF, paying in cash, the menu and the demo payment', async () => {
      await render('/invoices/inv-wd-044');
      const area = q('next-step')!;
      expect(area.querySelectorAll('a')).toHaveLength(1);
      const buttons = Array.from(area.querySelectorAll<HTMLButtonElement>('button')).filter(
        (b) => !b.closest('app-term'),
      );
      expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual([
        'mark-paid',
        'more-actions',
        'demo-payment',
      ]);
      expect(buttons.every((b) => !b.disabled)).toBe(true);
    });

    it('puts the main button first and the smaller ones after it', async () => {
      const first = async (url: string) => {
        await render(url);
        return q('next-step')!.querySelector('a[data-testid], button[data-testid]')!.getAttribute('data-testid');
      };
      expect(await first('/invoices/inv-wd-draft')).toBe('preview-send');
      expect(await first('/invoices/inv-wd-044')).toBe('download-pdf');
      expect(await first('/invoices/inv-wd-039')).toBe('send-reminder');
      expect(await first('/invoices/inv-wd-043')).toBe('duplicate-invoice');
      expect(await first('/invoices/inv-wd-040')).toBe('correct-copy');
      expect(await first('/invoices/inv-wd-042')).toBe('download-pdf');
    });

    it('a draft that can be sent offers Preview and send first and Edit after it', async () => {
      await render('/invoices/inv-wd-draft');
      expect(text(q('preview-send'))).toBe('Preview and send');
      expect(q('preview-send')!.tagName).toBe('BUTTON');
      expect(text(q('edit-invoice'))).toBe('Edit');
      expect(q('edit-invoice')!.getAttribute('href')).toBe('/invoices/inv-wd-draft/edit');
      expect(q('not-ready')).toBeNull();
      expect(q('invoice-actions')).toBeNull(); // nothing to pay or cancel yet
    });

    it('an overdue invoice offers the reminder first, and the PDF after it', async () => {
      await render('/invoices/inv-wd-039');
      const order = Array.from(q('next-step')!.querySelectorAll('a[data-testid], button[data-testid]')).map((n) =>
        n.getAttribute('data-testid'),
      );
      expect(order.slice(0, 2)).toEqual(['send-reminder', 'download-pdf']);
    });

    it('a paid invoice offers Duplicate, which makes a copy and leads to its edit page', async () => {
      await render('/invoices/inv-wd-043');
      expect(text(q('duplicate-invoice'))).toBe('Duplicate');
      expect(text(q('download-pdf'))).toBe('Download PDF'); // as the smaller one
      const before = demo.business().invoices.length;
      q('duplicate-invoice')!.click();
      await settle();
      expect(demo.business().invoices).toHaveLength(before + 1);
      const copy = demo.business().invoices.at(-1)!;
      expect(copy).toMatchObject({ number: null, customer: { name: 'Atelier Sommer GmbH' } });
      expect(copy.history[0]).toMatchObject({ key: 'invoiceDuplicated', params: { number: 'RE-2026-043' } });
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe(`/invoices/${copy.id}/edit`));
    });

    it('names the format of the file with its German terms', async () => {
      await render('/invoices/inv-wd-044');
      expect(text(q('invoice-format'))).toBe(
        'Format E-invoice (E-Rechnung) · PDF with data inside (ZUGFeRD)',
      );
      await render('/invoices/inv-wd-draft');
      expect(text(q('invoice-format'))).toBe(
        'Format E-invoice (E-Rechnung) · Data file for public offices (XRechnung)',
      );
    });

    it('a plain PDF has no format line', async () => {
      demo.setBusiness('sara-yoga');
      await render('/invoices/inv-sy-016');
      expect(q('invoice-format')).toBeNull();
      expect(q('download-pdf')).not.toBeNull();
    });

    it('in German the terms stand alone', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render('/invoices/inv-wd-044');
      expect(text(q('invoice-format'))).toBe('Format E-Rechnung · ZUGFeRD');
      expect(text(q('invoice-meta'))).toContain('Rechnung RE-2026-044');
    });
  });

  describe('mistakes and money, from the page', () => {
    const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
    const inDialog = (testId: string) =>
      dialog()?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;

    async function openMenu(): Promise<void> {
      q('more-actions')!.click();
      await vi.waitFor(async () => {
        await settle();
        expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
      });
    }

    async function expectDialog(open: boolean): Promise<void> {
      await vi.waitFor(async () => {
        await settle();
        expect(dialog() !== null).toBe(open);
      });
    }

    it('cancel makes a cancellation and offers a corrected copy', async () => {
      await render('/invoices/inv-wd-044');
      const owedBefore = owedSummary(demo.business(), demo.setup()).owedCents;
      await openMenu();
      body('menu-cancel')!.click();
      await expectDialog(true);
      expect(text(inDialog('cancel-body'))).toBe(
        'This creates a cancellation invoice. The original stays on record.',
      );
      inDialog('cancel-confirm')!.click();
      await expectDialog(false);

      // The original is cancelled, and the cancellation invoice is next to it.
      expect(text(q('invoice-status'))).toBe('Cancelled');
      const cancellation = demo.business().invoices.find((i) => i.cancels === 'inv-wd-044')!;
      expect(cancellation.number).toBe('RE-2026-045');
      expect(text(q('cancelled-note'))).toBe(
        'Cancelled with cancellation invoice RE-2026-045. The original stays on record.',
      );
      const link = q('cancelled-note')!.querySelector('a')!;
      expect(link.getAttribute('href')).toBe(`/invoices/${cancellation.id}`);
      expect(historyLines()[0]).toBe('You cancelled it with cancellation invoice RE-2026-045');
      expect(owedSummary(demo.business(), demo.setup()).owedCents).toBe(owedBefore - 238000);
      expect(
        demo
          .business()
          .documents.some((d) => d.invoiceNo === 'RE-2026-045' && d.invoice?.role === 'cancellation'),
      ).toBe(true);

      // Nothing more to do with it but a corrected copy, and the PDF.
      expect(q('mark-paid')).toBeNull();
      expect(q('more-actions')).toBeNull();
      expect(q('send-reminder')).toBeNull();
      expect(text(q('correct-copy'))).toBe('Make a corrected copy');
      expect(text(q('download-pdf'))).toBe('Download PDF');

      const before = demo.business().invoices.length;
      q('correct-copy')!.click();
      await settle();
      expect(demo.business().invoices).toHaveLength(before + 1);
      const copy = demo.business().invoices.at(-1)!;
      expect(copy).toMatchObject({ number: null, sentOn: null, customer: { name: 'Studio Kern' } });
      expect(copy.lines).toEqual(demo.business().invoices.find((i) => i.id === 'inv-wd-044')!.lines);
      expect(copy.history[0]).toMatchObject({
        key: 'invoiceDuplicated',
        params: { number: 'RE-2026-044' },
      });
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toBe(`/invoices/${copy.id}/edit`),
      );
    });

    it('a cancellation invoice has no copy to make and no actions', async () => {
      await render('/invoices/inv-wd-042');
      expect(q('correct-copy')).toBeNull();
      expect(q('invoice-actions')).toBeNull();
      expect(q('cancelled-note')).toBeNull();
      expect(text(q('download-pdf'))).toBe('Download PDF');
    });

    it("paid invoices can't be cancelled", async () => {
      await render('/invoices/inv-wd-043');
      await openMenu();
      expect(body('menu-cancel')).toBeNull();
      expect(text(body('menu-cancel-paid'))).toBe(
        'Cancelling a paid invoice needs a credit note — coming later',
      );
      expect(TestBed.inject(InvoiceService).cancel('inv-wd-043')).toBeNull();
      expect(text(q('invoice-status'))).toBe('Paid 9 Oct');
    });

    it('mark as paid in cash', async () => {
      await render('/invoices/inv-wd-044');
      q('mark-paid')!.click();
      await expectDialog(true);
      (inDialog('pay-date') as HTMLInputElement).value = '2026-10-21';
      inDialog('pay-date')!.dispatchEvent(new Event('input'));
      await settle();
      inDialog('pay-confirm')!.click();
      await expectDialog(false);

      expect(text(q('invoice-status'))).toBe('Paid 21 Oct');
      expect(q('mark-paid')).toBeNull();
      expect(historyLines().slice(0, 2)).toEqual(['Paid in full', 'You marked it as paid in cash']);
      // The paid line leads to the payment that was added.
      const payment = demo.business().transactions[0];
      expect(q('history-link')!.getAttribute('href')).toBe(`/payments/${payment.id}`);
      expect(payment.accountId).toBe(demo.business().accounts.find((a) => a.kind === 'cash')!.id);
      // A paid invoice's next step is to write the next one like it.
      expect(text(q('duplicate-invoice'))).toBe('Duplicate');
    });

    it('demo payment turns Studio Kern paid; hidden without a bank', async () => {
      await render('/invoices/inv-wd-044');
      expect(text(q('demo-payment'))).toBe("Simulate the customer's payment");
      q('demo-payment')!.click();
      await settle();
      expect(text(q('invoice-status'))).toBe('Paid 22 Oct');
      expect(q('demo-payment')).toBeNull();
      expect(historyLines()[0]).toBe('Paid in full');
      expect(q('history-link')!.getAttribute('href')).toBe(
        `/payments/${demo.business().transactions[0].id}`,
      );
      expect(demo.business().transactions[0].accountId).toBe('wd-qonto');

      // Sara's bank sign-in ended on 20 Oct: no payment can arrive, so the demo does not offer one.
      demo.setBusiness('sara-yoga');
      await render('/invoices/inv-sy-021');
      expect(q('demo-payment')).toBeNull();
      expect(q('mark-paid')).not.toBeNull();
    });

    it('the demo payment after a part payment pays the rest, and the history leads to each payment', async () => {
      demo.setBusiness('sara-yoga');
      demo.renewConnection('sy-qonto');
      await render('/invoices/inv-sy-021');
      q('demo-payment')!.click();
      await settle();
      expect(text(q('invoice-status'))).toBe(`Paid ${formatDate(DEMO_TODAY, 'en')}`);
      const newest = demo.business().transactions[0];
      expect(qa('history-link').map((link) => link.getAttribute('href'))).toEqual([
        `/payments/${newest.id}`,
        '/payments/sy-t15',
      ]);
    });
  });

  describe('an invoice that is not there', () => {
    it('unknown invoice says not found', async () => {
      await render('/invoices/nope');
      expect(text(q('invoice-not-found'))).toContain('Invoice not found');
      expect(q('not-found-back')!.getAttribute('href')).toBe('/invoices');
      expect(text(q('not-found-back'))).toBe('Back to invoices');
      expect(q('invoice-paper')).toBeNull();
      expect(q('invoice-customer')).toBeNull();
    });

    it('an invoice of another business is not found either', async () => {
      demo.setBusiness('sara-yoga');
      await render('/invoices/inv-wd-044');
      expect(q('invoice-not-found')).not.toBeNull();
    });

    it('an invoice that the setup state hides is not found, as the list does not show it', async () => {
      demo.setSetup('new');
      await render('/invoices/inv-wd-044');
      expect(q('invoice-not-found')).not.toBeNull();
      // A draft always shows.
      await render('/invoices/inv-wd-draft');
      expect(q('invoice-paper')).not.toBeNull();
    });

    it('goes from one invoice to another without leaving the page', async () => {
      await render('/invoices/inv-wd-044');
      await render('/invoices/inv-wd-039');
      expect(text(q('invoice-customer'))).toBe('Bäckerei Lange');
      await render('/invoices/nope');
      expect(q('invoice-not-found')).not.toBeNull();
    });
  });
});

describe('the invoice routes', () => {
  let print: MockInstance<() => void>;

  beforeEach(() => {
    localStorage.clear();
    print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
  });

  afterEach(() => {
    print.mockRestore();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('/invoices/:id is a page in the shell, reached from a row of the list', async () => {
    const harness = await RouterTestingHarness.create('/invoices');
    const el = harness.routeNativeElement as HTMLElement;
    const link = Array.from(
      el.querySelectorAll<HTMLAnchorElement>('[data-testid="invoice-link"]'),
    ).find((a) => a.textContent?.includes('Studio Kern'))!;
    link.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/invoices/inv-wd-044');
    expect(el.querySelector('[data-testid="invoice-page"]')).not.toBeNull();
    expect(el.querySelector('app-sidebar')).not.toBeNull();
    expect(print).not.toHaveBeenCalled();
  });

  it('/print/invoice/:id is outside the shell and prints', async () => {
    const harness = await RouterTestingHarness.create('/print/invoice/inv-wd-044');
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="invoice-paper"]')).not.toBeNull();
    expect(el.querySelector('app-sidebar')).toBeNull();
    expect(print).toHaveBeenCalledTimes(1);
  });
});
