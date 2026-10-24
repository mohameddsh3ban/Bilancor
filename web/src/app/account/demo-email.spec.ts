import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import type { Lang } from '../data/models';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DemoEmail } from './demo-email';

@Component({
  imports: [DemoEmail],
  template: `
    <app-demo-email
      subject="Reset your password"
      body="Choose a new password."
      action="Choose a new password"
      [to]="to()"
      [mailLang]="mailLang()"
      (act)="acted = acted + 1"
    />
  `,
})
class Host {
  readonly to = signal<string | null>('sara@example.com');
  readonly mailLang = signal<Lang | null>(null);
  acted = 0;
}

@Component({
  imports: [DemoEmail],
  template: `
    <app-demo-email subject="Invitation" body="You are invited." action="Accept" mailLang="en">
      <p data-testid="extra-line" lang="de">Du bist eingeladen.</p>
    </app-demo-email>
  `,
})
class HostWithLines {}

describe('DemoEmail', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('is a dashed warning box that says the email is shown here instead of sent', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="demo-email"]',
    )!;
    expect(box.classList.contains('border-dashed')).toBe(true);
    expect(box.classList.contains('border-warning')).toBe(true);
    expect(text(box.querySelector('[data-testid="demo-email-label"]'))).toBe(
      'Demo: shown here instead of sent',
    );
    expect(text(box.querySelector('[data-testid="demo-email-subject"]'))).toBe(
      'Reset your password',
    );
    expect(text(box.querySelector('[data-testid="demo-email-body"]'))).toBe(
      'Choose a new password.',
    );
  });

  it('shows who it is to, left to right, and leaves the line out without one', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('[data-testid="demo-email-to"]'))).toBe('To: sara@example.com');
    expect(el.querySelector('[data-testid="demo-email-to"] bdi[dir="ltr"]')!.textContent).toBe(
      'sara@example.com',
    );
    fixture.componentInstance.to.set(null);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="demo-email-to"]')).toBeNull();
  });

  it('marks the text of the email with its own language and direction when it has one', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const textBox = () => el.querySelector<HTMLElement>('[data-testid="demo-email-text"]')!;
    expect(textBox().hasAttribute('lang')).toBe(false);
    expect(textBox().hasAttribute('dir')).toBe(false);
    fixture.componentInstance.mailLang.set('ar');
    fixture.detectChanges();
    expect(textBox().getAttribute('lang')).toBe('ar');
    expect(textBox().getAttribute('dir')).toBe('rtl');
    // The box's own label stays the page's: only the email's subject, text and button are marked.
    expect(textBox().contains(el.querySelector('[data-testid="demo-email-label"]'))).toBe(false);
    expect(textBox().contains(el.querySelector('[data-testid="demo-email-action"]'))).toBe(true);
    fixture.componentInstance.mailLang.set('de');
    fixture.detectChanges();
    expect(textBox().getAttribute('lang')).toBe('de');
    expect(textBox().getAttribute('dir')).toBe('ltr');
  });

  it('its button says what the email asks and tells the page when it is pressed', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="demo-email-action"]',
    )!;
    expect(text(button)).toBe('Choose a new password');
    button.click();
    expect(fixture.componentInstance.acted).toBe(1);
  });

  it('shows what the page puts inside it between the text and the button, inside the email', () => {
    const fixture = TestBed.createComponent(HostWithLines);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const box = el.querySelector<HTMLElement>('[data-testid="demo-email-text"]')!;
    const extra = el.querySelector<HTMLElement>('[data-testid="extra-line"]')!;
    expect(box.contains(extra)).toBe(true);
    expect(text(extra)).toBe('Du bist eingeladen.');
    const body = el.querySelector('[data-testid="demo-email-body"]')!;
    const action = el.querySelector('[data-testid="demo-email-action"]')!;
    expect(body.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(extra.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
