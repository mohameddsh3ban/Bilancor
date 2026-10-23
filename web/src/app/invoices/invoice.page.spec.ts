import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance } from 'vitest';
import { routes } from '../app.routes';
import { formatDate } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DemoStateService } from '../state/demo-state.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { InvoicePage } from './invoice.page';

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
        provideRouter([{ path: 'invoices/:id', component: InvoicePage }]),
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

    it('has no button that does nothing: every button here is a link', async () => {
      await render('/invoices/inv-wd-044');
      const area = q('next-step')!;
      expect(area.querySelectorAll('a')).toHaveLength(1);
      expect(
        Array.from(area.querySelectorAll('button')).filter((b) => !b.closest('app-term')),
      ).toHaveLength(0);
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
