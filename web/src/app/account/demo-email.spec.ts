import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
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
      (act)="acted = acted + 1"
    />
  `,
})
class Host {
  readonly to = signal<string | null>('sara@example.com');
  acted = 0;
}

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
});
