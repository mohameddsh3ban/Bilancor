import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance } from 'vitest';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DemoStateService } from '../state/demo-state.service';
import { InvoicePrintPage } from './invoice-print.page';

describe('InvoicePrintPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;
  let print: MockInstance<() => void>;

  beforeEach(() => {
    localStorage.clear();
    harness = undefined;
    print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([{ path: 'print/invoice/:id', component: InvoicePrintPage }]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    print.mockRestore();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(url: string): Promise<void> {
    // A test may open several pages; the harness can be created only once, so it navigates after that.
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
    el = harness!.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  it('print view prints once', async () => {
    await render('/print/invoice/inv-wd-044');
    expect(print).toHaveBeenCalledTimes(1);

    // Later changes to the page never open the dialog again.
    const invoice = demo.business().invoices.find((i) => i.id === 'inv-wd-044')!;
    demo.saveInvoice({ ...invoice, paymentTermDays: 30 });
    await settle();
    await settle();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('shows the invoice as the paper alone, and a Back link that is not printed', async () => {
    await render('/print/invoice/inv-wd-044');
    const paper = q('invoice-paper')!;
    expect(paper).not.toBeNull();
    expect(text(q('paper-customer'))).toContain('Studio Kern');
    expect(text(q('paper-title'))).toBe('Rechnung');

    const back = q('print-back')!;
    expect(back.getAttribute('href')).toBe('/invoices/inv-wd-044');
    expect(back.className).toContain('print:hidden');
    expect(text(back)).toBe('Back');
    // Nothing else of the app is on the page.
    expect(el.querySelector('app-sidebar')).toBeNull();
    expect(el.querySelector('app-invoice-status-chip')).toBeNull();
  });

  it('prints a cancellation invoice with its own title', async () => {
    await render('/print/invoice/inv-wd-042');
    expect(text(q('paper-title'))).toBe('Stornorechnung');
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('prints the paper in the language of the invoice, also when the app is in Arabic', async () => {
    TestBed.inject(LanguageService).setLang('ar');
    await render('/print/invoice/inv-wd-044');
    const paper = q('invoice-paper')!;
    expect(paper.getAttribute('dir')).toBe('ltr');
    expect(paper.getAttribute('lang')).toBe('de');
    expect(text(q('print-back'))).toBe('رجوع');
  });

  it('says there is nothing to print for an unknown invoice, and does not print', async () => {
    await render('/print/invoice/nope');
    expect(text(q('print-nothing'))).toBe('Nothing to print here.');
    expect(q('invoice-paper')).toBeNull();
    expect(q('print-back')!.getAttribute('href')).toBe('/invoices');
    expect(print).not.toHaveBeenCalled();
  });

  it('says there is nothing to print for an invoice that the setup state hides', async () => {
    demo.setSetup('new');
    await render('/print/invoice/inv-wd-044');
    expect(q('print-nothing')).not.toBeNull();
    expect(print).not.toHaveBeenCalled();
  });
});
