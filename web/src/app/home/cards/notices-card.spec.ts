import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { LanguageService } from '../../core/i18n/language.service';
import { DemoStateService } from '../../state/demo-state.service';
import { withConnection } from '../../state/demo-state.testing';
import { SEND_MS, InvoiceService } from '../../state/invoice.service';
import { NoticeService } from '../../state/notice.service';
import { NoticesCard } from './notices-card';

// Weber Design's open notices, most urgent first: the terms (wd-n1), its calculated bank notice, the unreadable receipts (wd-n3).
const BANK_EXPIRY = 'bank-expiry-wd-qonto';
// Sara Weber Yoga's: its calculated "ended" notice and the revenue limit (sy-n1).
const BANK_ENDED = 'bank-ended-sy-qonto';

describe('NoticesCard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
  });

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

  function render() {
    const fixture = TestBed.createComponent(NoticesCard);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const q = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  it('shows the two most urgent notices with an action link each, and leaves the others to "+2 more"', () => {
    const { el } = render();
    expect(q(el, 'notice-wd-n1')?.textContent).toContain('New terms from our bank-connection provider');
    expect(q(el, `notice-${BANK_EXPIRY}`)?.textContent).toContain('Your Qonto connection expires in 5 days');
    expect(q(el, 'notice-wd-n3')).toBeNull();
    expect(q(el, 'notice-action-wd-n1')?.getAttribute('href')).toBe('/soon/terms');
  });

  /** Weber Design's Qonto consent ends on the given day, as the bank would report it. */
  function consentEnds(date: string): void {
    withConnection(TestBed.inject(DemoStateService), 'wd-qonto', { consentUntil: date });
  }
  const bankText = (el: HTMLElement) => q(el, `notice-${BANK_EXPIRY}`)?.querySelector('p')?.textContent?.trim();

  it('counts the days with the right word: 14 days, 2 days, 1 day, today', () => {
    const words: Record<string, string> = {
      '2026-11-05': 'Your Qonto connection expires in 14 days',
      '2026-10-24': 'Your Qonto connection expires in 2 days',
      '2026-10-23': 'Your Qonto connection expires in 1 day',
      '2026-10-22': 'Your Qonto connection expires today',
    };
    for (const [date, sentence] of Object.entries(words)) {
      consentEnds(date);
      expect(bankText(render().el), date).toBe(sentence);
    }
  });

  it('counts the days with the right word in German and Arabic too', () => {
    const language = TestBed.inject(LanguageService);
    consentEnds('2026-10-23');
    language.setLang('de');
    expect(bankText(render().el)).toBe('Deine Verbindung zu Qonto läuft in 1 Tag ab');
    consentEnds('2026-10-22');
    expect(bankText(render().el)).toBe('Deine Verbindung zu Qonto läuft heute ab');
    consentEnds('2026-10-23');
    language.setLang('ar');
    expect(bankText(render().el)).toBe('ينتهي ربط Qonto خلال يوم واحد');
    consentEnds('2026-10-22');
    expect(bankText(render().el)).toBe('ينتهي ربط Qonto اليوم');
  });

  it('the bank notice opens the Bank accounts card of Settings', () => {
    const { el } = render();
    expect(q(el, `notice-action-${BANK_EXPIRY}`)?.textContent?.trim()).toBe('Renew');
    expect(q(el, `notice-action-${BANK_EXPIRY}`)?.getAttribute('href')).toBe('/settings#bank-accounts');
  });

  it('the "connection has ended" notice asks to sign in again and opens the Bank accounts card of Settings', () => {
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    const { el } = render();
    expect(q(el, `notice-${BANK_ENDED}`)?.textContent).toContain('Your Qonto connection has ended');
    expect(q(el, `notice-action-${BANK_ENDED}`)?.textContent?.trim()).toBe('Sign in again');
    expect(q(el, `notice-action-${BANK_ENDED}`)?.getAttribute('href')).toBe('/settings#bank-accounts');
  });

  it('Details on the revenue-limit notice opens Taxes, where the limit tracker is', () => {
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    const { el } = render();
    expect(q(el, 'notice-action-sy-n1')?.textContent?.trim()).toBe('Details');
    expect(q(el, 'notice-action-sy-n1')?.getAttribute('href')).toBe('/taxes');
  });

  it('Fix opens Documents', () => {
    // Fixing needs the unreadable notice on show: it moves up once the bank notice and the late invoice's are dismissed.
    TestBed.inject(NoticeService).dismiss(BANK_EXPIRY);
    TestBed.inject(NoticeService).dismiss('invoice-overdue-inv-wd-039');
    const { el } = render();
    expect(q(el, 'notice-action-wd-n3')?.textContent?.trim()).toBe('Fix');
    expect(q(el, 'notice-action-wd-n3')?.getAttribute('href')).toBe('/documents');
  });

  describe('an overdue invoice', () => {
    const LATE = 'invoice-overdue-inv-wd-039';
    const EMAIL = { to: 'info@baeckerei-lange.example', subject: 'Zahlungserinnerung', body: 'Hallo' };

    afterEach(() => vi.useRealTimers());

    /** The notice is the third one of Weber Design: it comes up once the bank notice is out of the way. */
    function renderLate() {
      TestBed.inject(NoticeService).dismiss(BANK_EXPIRY);
      return render();
    }

    it('Bäckerei Lange notice links to the reminder; it disappears after reminding', async () => {
      const { fixture, el } = renderLate();
      expect(q(el, `notice-${LATE}`)?.querySelector('p')?.textContent?.trim()).toBe(
        'Bäckerei Lange is 22 days late with RE-2026-039',
      );
      expect(q(el, `notice-action-${LATE}`)?.textContent?.trim()).toBe('Send reminder');
      expect(q(el, `notice-action-${LATE}`)?.getAttribute('href')).toBe('/invoices/inv-wd-039?remind=1');
      expect(q(el, `notice-dismiss-${LATE}`)).not.toBeNull();

      vi.useFakeTimers();
      const sent = TestBed.inject(InvoiceService).remind('inv-wd-039', 1, EMAIL);
      await vi.advanceTimersByTimeAsync(SEND_MS);
      expect(await sent).toBe(true);
      fixture.detectChanges();

      expect(q(el, `notice-${LATE}`)).toBeNull();
      expect(q(el, 'notice-wd-n3')).not.toBeNull(); // the next notice comes up
    });

    it('disappears once the invoice is paid', () => {
      const { fixture, el } = renderLate();
      expect(q(el, `notice-${LATE}`)).not.toBeNull();

      TestBed.inject(InvoiceService).simulatePayment('inv-wd-039');
      fixture.detectChanges();

      expect(q(el, `notice-${LATE}`)).toBeNull();
    });

    it('speaks German and Arabic', () => {
      const language = TestBed.inject(LanguageService);
      language.setLang('de');
      expect(q(renderLate().el, `notice-${LATE}`)?.querySelector('p')?.textContent?.trim()).toBe(
        'Bäckerei Lange ist mit RE-2026-039 seit 22 Tagen im Rückstand',
      );
      expect(q(render().el, `notice-action-${LATE}`)?.textContent?.trim()).toBe('Zahlungserinnerung senden');
      language.setLang('ar');
      const text = q(render().el, `notice-${LATE}`)?.querySelector('p')?.textContent ?? '';
      expect(text).toContain('⁨Bäckerei Lange⁩');
      expect(text).toContain('⁨RE-2026-039⁩');
      expect(q(render().el, `notice-action-${LATE}`)?.textContent?.trim()).toBe('إرسال تذكير');
    });
  });

  it('blocking notice has no dismiss', () => {
    const { el } = render();
    expect(q(el, 'notice-dismiss-wd-n1')).toBeNull();
    expect(q(el, `notice-dismiss-${BANK_EXPIRY}`)).not.toBeNull();
  });

  it('dismiss removes the notice, keeps the blocking one and brings the next one up', () => {
    const { fixture, el } = render();
    q(el, `notice-dismiss-${BANK_EXPIRY}`)!.click();
    fixture.detectChanges();
    expect(q(el, `notice-${BANK_EXPIRY}`)).toBeNull();
    expect(q(el, 'notice-wd-n1')).not.toBeNull();
    // The late invoice (urgency 2) comes up in its place; the unreadable receipts (3) are still behind it.
    expect(q(el, 'notice-invoice-overdue-inv-wd-039')).not.toBeNull();
    expect(q(el, 'notice-wd-n3')).toBeNull();
    expect(q(el, 'notices-more')?.textContent?.trim()).toBe('+1 more');
  });

  it('"+N more" opens the bell panel', () => {
    const { fixture, el } = render();
    const more = q(el, 'notices-more')!;
    expect(more.textContent?.trim()).toBe('+2 more');
    expect(TestBed.inject(NoticeService).bellOpen()).toBe(false);
    more.click();
    fixture.detectChanges();
    expect(TestBed.inject(NoticeService).bellOpen()).toBe(true);
  });

  it('has no more link when everything fits', () => {
    // Sara Weber Yoga has two open notices, which is all the card shows.
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    const { el } = render();
    expect(q(el, `notice-${BANK_ENDED}`)).not.toBeNull();
    expect(q(el, 'notice-sy-n1')).not.toBeNull();
    expect(q(el, 'notices-more')).toBeNull();
  });
});
