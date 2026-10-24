import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Doc, Transaction } from '../data/models';
import { UNDO_MS } from '../state/review.service';
import { DemoStateService } from '../state/demo-state.service';
import { PaymentDetailPage } from './payment-detail.page';
import { PaymentsPage } from './payments.page';
import { SelfIssuedPage } from './self-issued.page';

describe('SelfIssuedPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness;
  let router: Router;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: 'payments/:id/self-issued', component: SelfIssuedPage },
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(url: string): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    await settle();
  }

  /** Lets the page and the router finish; under fake timers (which stop the page from drawing by itself) a little time passes instead. */
  async function settle(): Promise<void> {
    harness.detectChanges();
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(10);
    else await harness.fixture.whenStable();
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** Text without the isolates that keep a number's direction inside a sentence. */
  const plain = (node: Element | null | undefined) =>
    text(node)
      .replaceAll(String.fromCodePoint(0x2068), '')
      .replaceAll(String.fromCodePoint(0x2069), '');
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const box = (testId: string) => q(testId)!.querySelector<HTMLInputElement>('input')!;
  const payment = (id: string): Transaction =>
    demo.business().transactions.find((tx) => tx.id === id)!;
  const receipts = (): Doc[] => demo.documents().filter((doc) => doc.selfIssued !== null);

  async function fillAndCreate(reason = 'reason-machine'): Promise<void> {
    box(reason).click();
    await settle();
    box('form-confirm').click();
    await settle();
    q('form-create')!.click();
    await settle();
  }

  it('opens the form for the APCOA payment, with a way back to it', async () => {
    await render('/payments/wd-t20/self-issued');
    expect(router.url).toBe('/payments/wd-t20/self-issued');
    expect(text(q('form-title'))).toBe('Self-issued receipt (Eigenbeleg)');
    expect(text(q('form-payee'))).toBe('APCOA Parking');
    const back = q('back-link')!;
    expect(back.getAttribute('href')).toBe('/payments/wd-t20');
    expect(text(back)).toBe('Back to the payment');
  });

  it('create links the receipt and shows Undo for 5 seconds', async () => {
    await render('/payments/wd-t20/self-issued');
    vi.useFakeTimers();

    await fillAndCreate();

    // The receipt is written and linked, and the person is back on the payment, which says so and offers Undo.
    expect(receipts()).toHaveLength(1);
    expect(payment('wd-t20')).toMatchObject({
      receipt: 'attached',
      receiptFile: 'EB-2026-001.pdf',
      booking: { vatRate: 0 },
    });
    expect(router.url).toBe('/payments/wd-t20');
    expect(q('payment-detail')).not.toBeNull();
    expect(plain(q('self-issued-undo-text'))).toBe('Self-issued receipt EB-2026-001 written');
    expect(text(q('undo-self-issued'))).toBe('Undo');

    // A moment short of 5 seconds it is still there (settling lets a few milliseconds pass), and 5 seconds after the receipt it is gone.
    await vi.advanceTimersByTimeAsync(UNDO_MS - 500);
    await settle();
    expect(q('undo-self-issued')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    await settle();
    expect(q('undo-self-issued')).toBeNull();
    expect(receipts()).toHaveLength(1);
  });

  it('Undo on the payment takes the receipt and the 0 % back', async () => {
    const before = structuredClone(payment('wd-t20'));
    await render('/payments/wd-t20/self-issued');
    vi.useFakeTimers();
    await fillAndCreate();

    q('undo-self-issued')!.click();
    await settle();

    expect(receipts()).toHaveLength(0);
    expect(payment('wd-t20')).toEqual(before);
    expect(q('undo-self-issued')).toBeNull();
    expect(router.url).toBe('/payments/wd-t20');
    // The payment offers the self-issued receipt again.
    expect(q('self-receipt')).not.toBeNull();
  });

  it('goes back to the payment with the Back link and with Cancel, and writes nothing', async () => {
    await render('/payments/wd-t20/self-issued');
    const before = demo.business();
    q('form-cancel')!.click();
    await settle();
    expect(router.url).toBe('/payments/wd-t20');
    expect(demo.business()).toBe(before);
    expect(q('undo-self-issued')).toBeNull();
  });

  it('a form that is not complete writes nothing and stays', async () => {
    await render('/payments/wd-t20/self-issued');
    q('form-create')!.click();
    await settle();
    expect(router.url).toBe('/payments/wd-t20/self-issued');
    expect(receipts()).toHaveLength(0);
    expect(q('form-error-reason')).not.toBeNull();
  });

  describe('a payment that can not have a self-issued receipt', () => {
    it('an unknown payment goes to Payments', async () => {
      await render('/payments/nope/self-issued');
      expect(router.url).toBe('/payments');
    });

    it.each([
      ['a payment in a closed month', 'wd-t10'],
      ['money coming in', 'wd-t1'],
      ['a payment that has its receipt', 'wd-t2'],
      ['a private payment', 'wd-t15'],
    ])('%s goes back to the payment', async (_what, id) => {
      await render(`/payments/${id}/self-issued`);
      expect(router.url).toBe(`/payments/${id}`);
      expect(receipts()).toHaveLength(0);
    });

    it('goes to Payments while no bank is connected', async () => {
      demo.setSetup('new');
      await render('/payments/wd-t20/self-issued');
      expect(router.url).toBe('/payments');
    });
  });
});
