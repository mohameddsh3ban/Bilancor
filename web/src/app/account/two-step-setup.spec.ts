import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { demoBackupCodes } from '../state/account.service';
import { TwoStepSetup } from './two-step-setup';

describe('TwoStepSetup', () => {
  let fixture: ComponentFixture<TwoStepSetup>;
  let el: HTMLElement;
  let done: number;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    fixture = TestBed.createComponent(TwoStepSetup);
    fixture.componentRef.setInput('codes', demoBackupCodes(0));
    done = 0;
    fixture.componentInstance.done.subscribe(() => done++);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const code = () => q('two-step-code') as HTMLInputElement;

  function type(value: string): void {
    code().value = value;
    code().dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function press(testId: string): void {
    q(testId)!.click();
    fixture.detectChanges();
  }

  it('shows a decorative QR picture, the typed key, the code field and the demo box', () => {
    expect(q('two-step-qr')!.getAttribute('aria-hidden')).toBe('true');
    expect(text(q('two-step-key'))).toBe('DEMO 4F7K 2Q9X 8MZP');
    expect(q('two-step-key')!.tagName).toBe('BDI');
    expect(q('two-step-key')!.getAttribute('dir')).toBe('ltr');
    expect(text(el)).toContain('Scan with an authenticator app, then type its 6-digit code.');
    expect(code().getAttribute('inputmode')).toBe('numeric');
    expect(text(q('two-step-demo'))).toBe('Demo: any 6 digits work.');
  });

  it('lists the 8 backup codes it was given, each in a left-to-right block', () => {
    const items = Array.from(el.querySelectorAll('[data-testid="two-step-backup"] li'));
    expect(items.map((li) => text(li))).toEqual(demoBackupCodes(0));
    expect(items).toHaveLength(8);
    for (const li of items) expect(li.querySelector('bdi')?.getAttribute('dir')).toBe('ltr');
  });

  it("I've saved them needs 6 digits and says so when the code is shorter", () => {
    type('12345');
    press('two-step-done');
    expect(done).toBe(0);
    expect(text(q('two-step-error'))).toBe('The code has 6 digits.');
    expect(code().getAttribute('aria-invalid')).toBe('true');

    // Typing again takes the message away.
    type('123456');
    expect(q('two-step-error')).toBeNull();
  });

  it('any 6 digits finish it, once, and the field and the button are then done with', () => {
    type('000 000');
    press('two-step-done');
    expect(done).toBe(1);
    expect(q('two-step-done')).toBeNull();
    expect(text(q('two-step-saved'))).toBe('Two-step login is set up.');
    expect(code().readOnly).toBe(true);
  });

  it('Enter in the code field does what the button does, and does not submit a form around it', () => {
    type('654321');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    code().dispatchEvent(event);
    fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    expect(done).toBe(1);
  });

  it('speaks the language of the app', () => {
    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    expect(text(q('two-step-demo'))).toBe('Demo: Jeder 6-stellige Code funktioniert.');
    expect(text(q('two-step-done'))).toBe('Ich habe sie gespeichert');
  });
});
