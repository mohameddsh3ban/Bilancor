import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { BankApproval } from './bank-approval';

@Component({
  imports: [BankApproval],
  template: `
    <app-bank-approval
      [bankName]="bank"
      [note]="note"
      (approved)="approved = approved + 1"
      (cancelled)="cancelled = cancelled + 1"
    />
  `,
})
class Host {
  bank = 'Qonto';
  note: string | null = null;
  approved = 0;
  cancelled = 0;
}

describe('BankApproval', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  function render(setup: (host: Host) => void = () => undefined) {
    const fixture = TestBed.createComponent(Host);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return { fixture, el, q, text, host: fixture.componentInstance };
  }

  it('says DEMO · no real bank, no password, before anything else', () => {
    const { el, q, text } = render();
    expect(text(q('demo-label'))).toBe('DEMO · no real bank, no password');
    const everything = Array.from(el.querySelectorAll('*'));
    expect(everything.indexOf(q('demo-label')!)).toBeLessThan(everything.indexOf(q('approve')!));
    expect(el.textContent).toContain('DEMO');
  });

  it("shows the bank's tile and name and what the app wants to read", () => {
    const { q, text } = render();
    expect(text(q('bank-tile'))).toBe('QO');
    expect(text(q('approval-bank'))).toBe('Qonto');
    expect(text(q('approval-sentence'))).toBe('Bookkeeping app wants to read your payments and balance.');
  });

  it('has no input field of any kind: nothing to type, no password', () => {
    const { el } = render();
    expect(el.querySelectorAll('input, textarea, select, [contenteditable], [type="password"]')).toHaveLength(0);
  });

  it('has two buttons, Approve and Cancel, and tells the parent which one was tapped', () => {
    const { fixture, el, q, text, host } = render();
    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons.map((b) => text(b))).toEqual(['Approve', 'Cancel']);
    expect(buttons.every((b) => b.type === 'button')).toBe(true);
    q('approve')!.click();
    fixture.detectChanges();
    expect([host.approved, host.cancelled]).toEqual([1, 0]);
    q('cancel')!.click();
    fixture.detectChanges();
    expect([host.approved, host.cancelled]).toEqual([1, 1]);
  });

  it('shows the note the parent passes, and nothing when there is none', () => {
    const none = render();
    expect(none.q('approval-note')).toBeNull();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    const note = render((host) => (host.note = "Demo: this business banks with Qonto, so Qonto's accounts are shown."));
    expect(note.text(note.q('approval-note'))).toBe("Demo: this business banks with Qonto, so Qonto's accounts are shown.");
  });

  it('shows the bank that is given, with its own initials', () => {
    const { q, text } = render((host) => (host.bank = 'Deutsche Bank'));
    expect(text(q('bank-tile'))).toBe('DB');
    expect(text(q('approval-bank'))).toBe('Deutsche Bank');
  });

  it('is marked DEMO in German and Arabic too', () => {
    const { fixture, q, text } = render();
    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    expect(text(q('demo-label'))).toBe('DEMO · keine echte Bank, kein Passwort');
    expect(text(q('approve'))).toBe('Zustimmen');
    TestBed.inject(LanguageService).setLang('ar');
    fixture.detectChanges();
    expect(text(q('demo-label'))).toContain('DEMO');
    expect(text(q('approve'))).toBe('موافقة');
  });
});
