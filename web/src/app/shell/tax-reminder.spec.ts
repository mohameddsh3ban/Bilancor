import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { SafeStorage } from '../core/storage/safe-storage';
import { DemoStateService } from '../state/demo-state.service';
import { TaxReminderService, type TaxReminderItem } from '../state/tax-reminder.service';
import { TaxReminder } from './tax-reminder';

/** Stands in for the Taxes page, which the app gets later. */
@Component({ template: '' })
class TaxesStub {}

const cafeKey = 'mockup.taxReminder.p1.cafe-linde.2026-10-10';
const weberKey = 'mockup.taxReminder.p1.weber-design.2026-11-10';

describe('TaxReminder', () => {
  let fixture: ComponentFixture<TaxReminder>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter([{ path: 'taxes', component: TaxesStub }])],
    });
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(TaxReminder);
    await settle();
  }

  const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
  const q = <T extends HTMLElement = HTMLElement>(selector: string) => dialog()?.querySelector<T>(selector) ?? null;
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const button = (label: string) =>
    Array.from(dialog()?.querySelectorAll<HTMLButtonElement>('button') ?? []).find((b) => text(b).includes(label));

  /** Waits until the pop-up is gone: it closes after its exit animation. */
  async function expectClosed(): Promise<void> {
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).toBeNull();
    });
  }

  it('says which businesses and returns are coming up, the overdue one first', async () => {
    await render();
    expect(dialog()).not.toBeNull();
    expect(text(q('h2'))).toBe('2 tax returns are coming up');
    const blocks = Array.from(dialog()!.querySelectorAll<HTMLElement>('[data-testid^="tax-reminder-item-"]'));
    expect(blocks.map((b) => b.getAttribute('data-testid'))).toEqual([
      'tax-reminder-item-cafe-linde',
      'tax-reminder-item-weber-design',
    ]);
    expect(text(blocks[0])).toContain('Café Linde GbR');
    expect(text(blocks[0])).toContain('VAT return (UStVA) for Q3 2026');
    expect(text(blocks[0])).toContain('Overdue since 10 Oct');
    expect(text(blocks[1])).toContain('Weber Design');
    expect(text(blocks[1])).toContain('VAT return (UStVA) for October 2026');
    expect(text(blocks[1])).toContain('Due 10 Nov · in 19 days');
    for (const block of blocks) expect(text(block.querySelector('[data-testid="tax-reminder-open"]'))).toBe('Open taxes');
  });

  it('shows the overdue deadline in red and the coming one in the quiet colour', async () => {
    await render();
    const overdue = q('[data-testid="tax-reminder-item-cafe-linde"] [data-testid="tax-reminder-due"]')!;
    const coming = q('[data-testid="tax-reminder-item-weber-design"] [data-testid="tax-reminder-due"]')!;
    expect(overdue.className).toContain('text-negative');
    expect(coming.className).not.toContain('text-negative');
  });

  it('says "a tax return" for one business', async () => {
    localStorage.setItem(cafeKey, '1');
    await render();
    expect(text(q('h2'))).toBe('A tax return is coming up');
    expect(dialog()!.querySelectorAll('[data-testid^="tax-reminder-item-"]')).toHaveLength(1);
    expect(text(dialog())).toContain('Weber Design');
    expect(text(dialog())).not.toContain('Café Linde');
  });

  it('has Got it as the main button and Not now next to it', async () => {
    await render();
    const gotIt = button("Got it, don't remind me again")!;
    const notNow = button('Not now')!;
    expect(gotIt).toBeTruthy();
    expect(notNow).toBeTruthy();
    // Got it is the filled (primary) button, Not now the outlined one.
    expect(gotIt.className).toContain('bg-primary');
    expect(notNow.className).not.toContain('bg-primary');
  });

  it('is a labelled modal dialog: the title names it', async () => {
    await render();
    const labelledBy = dialog()!.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toBe(q('h2'));
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
  });

  it('moves the focus into the dialog, and gives it back when it closes', async () => {
    TestBed.inject(TaxReminderService).notNow();
    await render();
    expect(dialog()).toBeNull();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    try {
      TestBed.inject(DemoStateService).resetData();
      await vi.waitFor(async () => {
        await settle();
        expect(dialog()).not.toBeNull();
        expect(dialog()!.contains(document.activeElement)).toBe(true);
      });
      button('Not now')!.click();
      await expectClosed();
      await vi.waitFor(() => expect(document.activeElement).toBe(opener));
    } finally {
      opener.remove();
    }
  });

  it('Not now closes it and acknowledges nothing', async () => {
    await render();
    button('Not now')!.click();
    await expectClosed();
    expect(TestBed.inject(TaxReminderService).open()).toBe(false);
    expect(TestBed.inject(SafeStorage).get(cafeKey)).toBeNull();
    expect(TestBed.inject(SafeStorage).get(weberKey)).toBeNull();
  });

  it('keeps its words while it fades out after Got it, instead of announcing no tax returns', async () => {
    await render();
    button("Got it, don't remind me again")!.click();
    // Drawn once, before the dialog is taken away.
    fixture.detectChanges();
    expect(dialog()).not.toBeNull();
    expect(text(q('h2'))).toBe('2 tax returns are coming up');
    expect(dialog()!.querySelectorAll('[data-testid^="tax-reminder-item-"]')).toHaveLength(2);
    await expectClosed();
  });

  it('Got it closes it and acknowledges every business listed', async () => {
    await render();
    button("Got it, don't remind me again")!.click();
    await expectClosed();
    expect(TestBed.inject(TaxReminderService).open()).toBe(false);
    expect(TestBed.inject(SafeStorage).get(cafeKey)).not.toBeNull();
    expect(TestBed.inject(SafeStorage).get(weberKey)).not.toBeNull();
  });

  it('the cross in the corner is Not now', async () => {
    await render();
    const cross = q<HTMLButtonElement>('[data-slot="dialog-close"]')!;
    expect(text(cross)).toBe('Close');
    cross.click();
    await expectClosed();
    expect(TestBed.inject(TaxReminderService).open()).toBe(false);
    expect(TestBed.inject(SafeStorage).get(weberKey)).toBeNull();
  });

  it('escape closes as not now', async () => {
    await render();
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expectClosed();
    expect(TestBed.inject(TaxReminderService).open()).toBe(false);
    expect(TestBed.inject(SafeStorage).get(weberKey)).toBeNull();
    expect(TestBed.inject(SafeStorage).get(cafeKey)).toBeNull();
  });

  it('a tap outside closes as not now', async () => {
    await render();
    document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    await expectClosed();
    expect(TestBed.inject(TaxReminderService).open()).toBe(false);
    expect(TestBed.inject(SafeStorage).get(weberKey)).toBeNull();
  });

  it('explains the German term on tap without closing the pop-up, even when the explanation is tapped', async () => {
    await render();
    q<HTMLButtonElement>('app-term button')!.click();
    await settle();
    const explanation = Array.from(document.body.querySelectorAll<HTMLElement>('hlm-popover-content')).find((c) =>
      text(c).includes('The regular report to the tax office'),
    );
    expect(explanation).toBeTruthy();
    explanation!.click();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(TestBed.inject(TaxReminderService).open()).toBe(true);
  });

  it('Open taxes switches to that business and opens /taxes, as not now', async () => {
    await render();
    const demo = TestBed.inject(DemoStateService);
    expect(demo.business().id).toBe('weber-design');
    q<HTMLButtonElement>('[data-testid="tax-reminder-item-cafe-linde"] [data-testid="tax-reminder-open"]')!.click();
    expect(demo.business().id).toBe('cafe-linde');
    await expectClosed();
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/taxes'));
    expect(TestBed.inject(SafeStorage).get(cafeKey)).toBeNull();
  });

  it('does not show when nothing is due', async () => {
    localStorage.setItem(cafeKey, '1');
    localStorage.setItem(weberKey, '1');
    await render();
    expect(dialog()).toBeNull();
    expect(document.body.querySelector('.cdk-overlay-backdrop')).toBeNull();
  });

  it('comes back after Reset demo', async () => {
    await render();
    button("Got it, don't remind me again")!.click();
    await expectClosed();
    TestBed.inject(DemoStateService).resetData();
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).not.toBeNull();
    });
    expect(text(q('h2'))).toBe('2 tax returns are coming up');
  });

  it('Arabic dialog is rtl with ltr dates', async () => {
    TestBed.inject(LanguageService).setLang('ar');
    await render();
    expect(dialog()!.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
    expect(text(q('h2'))).toBe('إقرارات ضريبية قادمة: 2');
    const dates = Array.from(dialog()!.querySelectorAll<HTMLElement>('[data-testid="tax-reminder-due"] bdi[dir="ltr"]')).map(
      (d) => text(d),
    );
    expect(dates).toEqual(['10 أكتوبر', '10 نوفمبر']);
    expect(text(q('[data-testid="tax-reminder-item-weber-design"]'))).toContain('خلال 19 أيام');
    expect(text(q('[data-testid="tax-reminder-item-cafe-linde"]'))).toContain('الربع الثالث 2026');
    expect(text(q('[data-testid="tax-reminder-item-weber-design"]'))).toContain('Weber Design');
  });

  it('German dialog reads in German, with the term as it is', async () => {
    TestBed.inject(LanguageService).setLang('de');
    await render();
    expect(text(q('h2'))).toBe('2 Steuererklärungen stehen an');
    expect(dialog()!.closest('[dir]')?.getAttribute('dir')).toBe('ltr');
    expect(text(q('[data-testid="tax-reminder-item-cafe-linde"]'))).toContain('UStVA für 3. Quartal 2026');
    expect(text(q('[data-testid="tax-reminder-item-cafe-linde"]'))).toContain('Überfällig seit 10. Okt');
    expect(text(q('[data-testid="tax-reminder-item-weber-design"]'))).toContain('Fällig am 10. Nov. · in 19 Tagen');
    expect(button('Verstanden, nicht mehr erinnern')).toBeTruthy();
    expect(button('Jetzt nicht')).toBeTruthy();
  });

  it('is as wide as the screen less a margin on a phone, and 28rem at most (class check)', async () => {
    await render();
    const card = Array.from(q('[data-testid="tax-reminder"]')!.classList);
    expect(card).toEqual(expect.arrayContaining(['w-[calc(100vw-2rem)]', 'max-w-md']));
    expect(card).not.toContain('w-full');
  });

  it('scrolls the businesses, not the buttons, when the screen is short', async () => {
    await render();
    const list = q('[data-testid="tax-reminder-list"]')!;
    expect(list.className).toContain('overflow-y-auto');
    expect(list.className).toMatch(/max-h-/);
  });
});

describe('TaxReminder wording of the days left', () => {
  const view = (daysLeft: number) =>
    ({
      period: { start: '2026-10-01', end: '2026-10-31', kind: 'monthly' },
      dueDate: '2026-10-22',
      daysLeft,
    }) as TaxReminderItem['view'];

  async function renderWith(daysLeft: number): Promise<string> {
    const items = signal<TaxReminderItem[]>([{ businessId: 'weber-design', name: 'Weber Design', view: view(daysLeft) }]);
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([]),
        {
          provide: TaxReminderService,
          useValue: { due: items, open: signal(true), gotIt: () => undefined, notNow: () => undefined, openTaxes: () => undefined },
        },
      ],
    });
    const fixture = TestBed.createComponent(TaxReminder);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return (
      document.body.querySelector('[data-testid="tax-reminder-due"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    );
  }

  beforeEach(() => localStorage.clear());

  afterEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('says "in 1 day", never "in 1 days"', async () => {
    expect(await renderWith(1)).toBe('Due 22 Oct · in 1 day');
  });

  it('says "today" on the day itself, never "in 0 days"', async () => {
    expect(await renderWith(0)).toBe('Due 22 Oct · today');
  });

  it('says "in 21 days" at the edge', async () => {
    expect(await renderWith(21)).toBe('Due 22 Oct · in 21 days');
  });

  it('says "Overdue since" for a date that has passed, without a count of days', async () => {
    expect(await renderWith(-1)).toBe('Overdue since 22 Oct');
  });
});
