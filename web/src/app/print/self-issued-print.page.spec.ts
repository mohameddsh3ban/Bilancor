import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance } from 'vitest';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DemoStateService } from '../state/demo-state.service';
import { ReceiptService } from '../state/receipt.service';
import { SelfIssuedPrintPage } from './self-issued-print.page';

describe('SelfIssuedPrintPage', () => {
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
        provideRouter([{ path: 'print/self-issued/:docId', component: SelfIssuedPrintPage }]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    vi.useRealTimers();
    print.mockRestore();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** Writes the receipt for the APCOA Parking payment and returns the id of its document. */
  function write(): string {
    return TestBed.inject(ReceiptService).createSelfIssued(
      'wd-t20',
      { purpose: 'Parkgebühr', reason: 'lost', reasonText: null, address: null },
      'payment',
    )!;
  }

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

  it('print prints once', async () => {
    const id = write();
    await render(`/print/self-issued/${id}`);
    expect(print).toHaveBeenCalledTimes(1);

    // Later changes to the page never open the dialog again.
    demo.updateTransaction('wd-t20', (tx) => ({ ...tx, confirmed: true }));
    await settle();
    await settle();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('shows the receipt as the paper alone, and a Back link to the document that is not printed', async () => {
    const id = write();
    await render(`/print/self-issued/${id}`);
    expect(text(q('paper-title'))).toBe('Eigenbeleg EB-2026-001');
    expect(text(q('paper-payee')!.querySelector('dd'))).toBe('APCOA Parking');

    const back = q('print-back')!;
    expect(back.getAttribute('href')).toBe(`/documents/${id}`);
    expect(back.className).toContain('print:hidden');
    expect(text(back)).toBe('Back');
    // Nothing else of the app is on the page.
    expect(el.querySelector('app-sidebar')).toBeNull();
    expect(el.querySelector('app-document-status-chip')).toBeNull();
  });

  it('prints the paper in German, also when the app is in Arabic', async () => {
    TestBed.inject(LanguageService).setLang('ar');
    const id = write();
    await render(`/print/self-issued/${id}`);
    const paper = q('self-issued-paper')!;
    expect(paper.getAttribute('dir')).toBe('ltr');
    expect(paper.getAttribute('lang')).toBe('de');
    expect(text(q('print-back'))).toBe('رجوع');
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('says there is nothing to print for an unknown document, and does not print', async () => {
    await render('/print/self-issued/nope');
    expect(text(q('print-nothing'))).toBe('Nothing to print here.');
    expect(q('self-issued-paper')).toBeNull();
    expect(q('print-back')!.getAttribute('href')).toBe('/documents');
    expect(print).not.toHaveBeenCalled();
  });

  it('says there is nothing to print for a document that is not a self-issued receipt', async () => {
    await render('/print/self-issued/wd-d4');
    expect(q('print-nothing')).not.toBeNull();
    expect(q('self-issued-paper')).toBeNull();
    expect(print).not.toHaveBeenCalled();
  });

  it('says there is nothing to print for the receipt of another business', async () => {
    const id = write();
    demo.setBusiness('sara-yoga');
    await render(`/print/self-issued/${id}`);
    expect(q('print-nothing')).not.toBeNull();
    expect(print).not.toHaveBeenCalled();
  });
});
