import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { LanguageService } from '../../core/i18n/language.service';
import { DemoStateService } from '../../state/demo-state.service';
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

  it('shows the two most urgent notices with an action link each, and leaves the third to "+1 more"', () => {
    const { el } = render();
    expect(q(el, 'notice-wd-n1')?.textContent).toContain('New terms from our bank-connection provider');
    expect(q(el, `notice-${BANK_EXPIRY}`)?.textContent).toContain('Your Qonto connection expires in 5 days');
    expect(q(el, 'notice-wd-n3')).toBeNull();
    expect(q(el, 'notice-action-wd-n1')?.getAttribute('href')).toBe('/soon/terms');
  });

  it('the bank notice opens Settings', () => {
    const { el } = render();
    expect(q(el, `notice-action-${BANK_EXPIRY}`)?.textContent?.trim()).toBe('Renew');
    expect(q(el, `notice-action-${BANK_EXPIRY}`)?.getAttribute('href')).toBe('/settings');
  });

  it('the "connection has ended" notice asks to sign in again and opens Settings', () => {
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    const { el } = render();
    expect(q(el, `notice-${BANK_ENDED}`)?.textContent).toContain('Your Qonto connection has ended');
    expect(q(el, `notice-action-${BANK_ENDED}`)?.textContent?.trim()).toBe('Sign in again');
    expect(q(el, `notice-action-${BANK_ENDED}`)?.getAttribute('href')).toBe('/settings');
  });

  it('Fix opens Documents', () => {
    // Fixing needs the unreadable notice on show: it moves up once the bank notice is dismissed.
    TestBed.inject(NoticeService).dismiss(BANK_EXPIRY);
    const { el } = render();
    expect(q(el, 'notice-action-wd-n3')?.textContent?.trim()).toBe('Fix');
    expect(q(el, 'notice-action-wd-n3')?.getAttribute('href')).toBe('/documents');
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
    expect(q(el, 'notice-wd-n3')).not.toBeNull();
    expect(q(el, 'notices-more')).toBeNull();
  });

  it('"+N more" opens the bell panel', () => {
    const { fixture, el } = render();
    const more = q(el, 'notices-more')!;
    expect(more.textContent?.trim()).toBe('+1 more');
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
