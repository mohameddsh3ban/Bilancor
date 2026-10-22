import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { CopyButton } from './copy-button';

const ADDRESS = 'weber-design@inbox.example';
const HINT = "Couldn't copy — select the address";

describe('CopyButton', () => {
  let fixture: ComponentFixture<CopyButton>;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    fixture = TestBed.createComponent(CopyButton);
    fixture.componentRef.setInput('text', ADDRESS);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const button = () => el.querySelector('button')!;
  const status = () => el.querySelector('[role="status"]')!;
  const text = (node: Element) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function clipboardWith(writeText: (value: string) => Promise<void>): void {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  }

  async function press(): Promise<void> {
    button().click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }

  async function wait(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  it('Copy shows Copied only once the clipboard has taken the address', async () => {
    let resolve!: () => void;
    const writeText = vi.fn().mockReturnValue(new Promise<void>((done) => (resolve = done)));
    clipboardWith(writeText);

    await press();
    expect(writeText).toHaveBeenCalledWith(ADDRESS);
    expect(text(button())).toBe('Copy');
    expect(text(status())).toBe('');

    resolve();
    await wait(0);
    expect(text(button())).toBe('Copied');
    expect(text(status())).toBe('Copied');
  });

  it('goes back to Copy two seconds after it said Copied', async () => {
    clipboardWith(vi.fn().mockResolvedValue(undefined));
    await press();
    await wait(1999);
    expect(text(button())).toBe('Copied');
    await wait(1);
    expect(text(button())).toBe('Copy');
    expect(text(status())).toBe('');
  });

  it('where there is no clipboard it says so and how to go on, and never says Copied', async () => {
    expect(navigator.clipboard).toBeUndefined();
    await press();
    expect(text(button())).toBe('Copy');
    expect(text(status())).toBe(HINT);
    expect(status().classList).not.toContain('sr-only');
  });

  it('a clipboard that refuses gets the same hint', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    clipboardWith(writeText);
    await press();
    expect(writeText).toHaveBeenCalledWith(ADDRESS);
    expect(text(button())).toBe('Copy');
    expect(text(status())).toBe(HINT);
  });

  it('a clipboard that throws at once gets the same hint', async () => {
    clipboardWith(() => {
      throw new Error('blocked');
    });
    await press();
    expect(text(status())).toBe(HINT);
  });

  it('the hint stays long enough to read, then goes', async () => {
    await press();
    await wait(3999);
    expect(text(status())).toBe(HINT);
    await wait(1);
    expect(text(status())).toBe('');
  });

  it('a second try after a failure can work', async () => {
    await press();
    expect(text(status())).toBe(HINT);
    clipboardWith(vi.fn().mockResolvedValue(undefined));
    await press();
    expect(text(button())).toBe('Copied');
    expect(text(status())).toBe('Copied');
  });

  it('announces through its own status element and not through the button', async () => {
    expect(status()).not.toBeNull();
    expect(text(status())).toBe('');
    expect(button().hasAttribute('aria-live')).toBe(false);
    clipboardWith(vi.fn().mockResolvedValue(undefined));
    await press();
    expect(text(status())).toBe('Copied');
    expect(status().classList).toContain('sr-only');
    expect(status().contains(button())).toBe(false);
  });

  it('a second press starts the two seconds over', async () => {
    clipboardWith(vi.fn().mockResolvedValue(undefined));
    await press();
    await wait(1500);
    await press();
    await wait(1500);
    expect(text(button())).toBe('Copied');
    await wait(500);
    expect(text(button())).toBe('Copy');
  });

  it('leaves nothing running when it goes away, even before the clipboard has answered', async () => {
    let resolve!: () => void;
    clipboardWith(vi.fn().mockReturnValue(new Promise<void>((done) => (resolve = done))));
    button().click();
    fixture.destroy();
    resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('follows the language', async () => {
    TestBed.inject(LanguageService).setLang('de');
    clipboardWith(vi.fn().mockResolvedValue(undefined));
    fixture.detectChanges();
    expect(text(button())).toBe('Kopieren');
    await press();
    expect(text(button())).toBe('Kopiert');
  });
});
