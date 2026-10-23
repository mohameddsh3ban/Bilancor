import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { BUSINESSES } from '../data/sample-data';
import { currentVatReturn, type VatReturnView } from '../domain/vat-return';
import { DemoStateService } from '../state/demo-state.service';
import { SEND_MS, TaxService } from '../state/tax.service';
import { SendDialog } from './send-dialog';
import { VatReturnTab } from './vat-return-tab';

/** Café Linde's open return as the sample data gives it: Q3 2026, over its date, with nothing waiting for the person. */
const cafeView = (): VatReturnView => {
  const current = currentVatReturn(BUSINESSES.find((b) => b.id === 'cafe-linde')!);
  if (current?.kind !== 'return') throw new Error('no VAT return with a date');
  return current.view;
};

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
/** A sentence as it reads: the term button inside it ends with a space that a browser drops at the end of its line. */
const sentence = (node: Element | null | undefined) => text(node).replace(/\s+([,.])/g, '$1');
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const q = <T extends HTMLElement = HTMLElement>(testId: string) =>
  dialog()?.querySelector<T>(`[data-testid="${testId}"]`) ?? null;

describe('send dialog, opened from the VAT tab', () => {
  let demo: DemoStateService;
  let tax: TaxService;
  let fixture: ComponentFixture<VatReturnTab>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
    tax = TestBed.inject(TaxService);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const tab = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const sendButton = () => tab('vat-send-button') as HTMLButtonElement;
  const button = (testId: string) => q<HTMLButtonElement>(testId)!;

  async function render(businessId = 'cafe-linde'): Promise<void> {
    demo.setBusiness(businessId);
    fixture = TestBed.createComponent(VatReturnTab);
    await settle();
  }

  async function openDialog(): Promise<void> {
    sendButton().click();
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).not.toBeNull();
    });
  }

  async function expectClosed(): Promise<void> {
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).toBeNull();
    });
  }

  /** Taps Send in the open dialog and takes the clock over from there, so the wait to the tax office is the test's to run. */
  async function tapSend(): Promise<void> {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    button('send-confirm').click();
    await settle();
  }

  async function waitForTaxOffice(ms = SEND_MS): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await settle();
  }

  it('send flow: check → Sending… → Sent with ticket, and Sent earlier lists Q3', async () => {
    const before = cafeView();
    await render();
    expect(dialog()).toBeNull();
    await openDialog();

    // The check step: what is about to go out.
    expect(text(q('send-title'))).toBe('Send to the tax office');
    expect(text(q('send-period'))).toBe('Q3 2026');
    expect(text(q('send-charged'))).toContain('VAT you charged (Umsatzsteuer)');
    expect(text(q('send-charged-amount'))).toBe(formatMoney(before.chargedCents, 'en'));
    expect(text(q('send-paid'))).toContain('VAT you paid (Vorsteuer)');
    expect(text(q('send-paid-amount'))).toBe(formatMoney(before.paidCents, 'en'));
    expect(text(q('send-result-label'))).toBe('To pay');
    expect(text(q('send-result-amount'))).toBe(formatMoney(78564, 'en'));
    expect(sentence(q('send-via'))).toBe(
      "Your return will be sent through Online tax filing (ELSTER), the tax office's official channel.",
    );
    expect(text(button('send-confirm'))).toBe('Send');
    expect(text(button('send-cancel'))).toBe('Cancel');
    expect(demo.business().vatReturns).toHaveLength(1);

    // Sending…
    await tapSend();
    expect(text(q('send-title'))).toBe('Sending…');
    expect(q('send-confirm')).toBeNull();
    expect(q('send-cancel')).toBeNull();
    expect(q('send-ticket')).toBeNull();
    expect(demo.business().vatReturns).toHaveLength(1);
    // The card behind the dialog says the same.
    expect(sendButton().disabled).toBe(true);
    expect(text(sendButton())).toBe('Sending…');

    await waitForTaxOffice(SEND_MS - 1);
    expect(text(q('send-title'))).toBe('Sending…');

    // Sent ✓, with the ticket.
    await waitForTaxOffice(1);
    const recorded = demo.business().vatReturns.at(-1)!;
    expect(recorded.periodStart).toBe('2026-07-01');
    expect(text(q('send-title'))).toBe('Sent ✓');
    expect(text(q('send-done'))).toBe('Your VAT return for Q3 2026 was sent to the tax office.');
    expect(text(q('send-ticket'))).toBe(recorded.ticket);
    expect(recorded.ticket).toMatch(/^ET-2026-1022-\d{5}$/);
    expect(q('send-ticket')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    const print = q<HTMLAnchorElement>('send-print')!;
    expect(text(print)).toBe('Print receipt');
    expect(print.getAttribute('href')).toBe('/print/vat-return/2026-07-01');
    expect(text(button('send-close'))).toBe('Close');
    expect(q('send-confirm')).toBeNull();

    // The page behind: Q3 is in Sent earlier, and Q4 is the open return.
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="vat-sent-row"]'),
    );
    expect(rows.map((r) => text(r.querySelector('[data-testid="vat-sent-period"]')))).toEqual([
      'Q3 2026',
      'Q2 2026',
    ]);
    expect(text(rows[0].querySelector('[data-testid="vat-sent-on"]'))).toBe('sent 22 Oct');
    expect(text(rows[0].querySelector('[data-testid="vat-sent-amount"]'))).toBe(
      formatMoney(78564, 'en'),
    );
    expect(text(tab('vat-deadline'))).toContain('Q4 2026 · in progress');
    expect(sendButton().disabled).toBe(true);
    expect(text(sendButton())).toBe('Send to the tax office');

    vi.useRealTimers();
    button('send-close').click();
    await expectClosed();
  });

  it('cancel sends nothing', async () => {
    await render();
    await openDialog();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    button('send-cancel').click();
    vi.useRealTimers();
    await expectClosed();

    expect(tax.sending()).toBe(false);
    expect(demo.business().vatReturns).toHaveLength(1);
    expect(text(tab('vat-deadline'))).toContain('Q3 2026');
    expect(text(sendButton())).toBe('Send to the tax office');
    expect(sendButton().disabled).toBe(false);
  });

  it('the cross, Escape and a tap outside close it as cancel', async () => {
    await render();
    for (const close of [
      () => dialog()!.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!.click(),
      () => dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
      () => document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click(),
    ]) {
      await openDialog();
      close();
      await expectClosed();
      expect(tax.sending()).toBe(false);
      expect(demo.business().vatReturns).toHaveLength(1);
      // The tap that opens it again works: the page and the dialog agree it is closed.
      expect(sendButton().disabled).toBe(false);
    }
  });

  it('stays open when the business changes in some other way than being switched', async () => {
    await render();
    await openDialog();
    // Any edit makes a new business object, though it is the same business: that must not close the dialog.
    demo.updateTransaction('cl-t12', (tx) => ({ ...tx }));
    await settle();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(text(q('send-title'))).toBe('Send to the tax office');
  });

  it('the cross is labelled Close', async () => {
    await render();
    await openDialog();
    expect(text(dialog()!.querySelector('[data-slot="dialog-close"]'))).toBe('Close');
  });

  it('is a labelled modal dialog: the title names it', async () => {
    await render();
    await openDialog();
    const labelledBy = dialog()!.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toBe(q('send-title'));
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
  });

  it('keeps the cursor in the dialog on its title as the steps change, so it is never lost with a button', async () => {
    await render();
    await openDialog();
    await tapSend();
    await settle();
    expect(document.activeElement).toBe(q('send-title'));
    (document.activeElement as HTMLElement).blur();
    await waitForTaxOffice();
    await settle();
    expect(text(q('send-title'))).toBe('Sent ✓');
    expect(document.activeElement).toBe(q('send-title'));
  });

  it('explains ELSTER on tap, in the dialog, without closing it', async () => {
    await render();
    await openDialog();
    q('send-via')!.querySelector<HTMLButtonElement>('app-term button')!.click();
    await settle();
    expect(
      Array.from(document.body.querySelectorAll('hlm-popover-content')).some((c) =>
        text(c).includes("ELSTER is the tax office's official online channel"),
      ),
    ).toBe(true);
    expect(dialog()).not.toBeNull();
  });

  it('shows the amounts left to right', async () => {
    await render();
    await openDialog();
    for (const id of ['send-charged-amount', 'send-paid-amount', 'send-result-amount']) {
      expect(q(id)!.closest('bdi[dir="ltr"]'), id).not.toBeNull();
    }
  });

  it('is as wide as the screen less a margin on a phone, and 28rem at most', async () => {
    await render();
    await openDialog();
    const card = Array.from(q('send-dialog')!.classList);
    expect(card).toEqual(
      expect.arrayContaining(['w-[calc(100vw-2rem)]', 'max-w-md', 'overflow-y-auto']),
    );
    expect(card).not.toContain('w-full');
  });

  describe('when nothing goes out', () => {
    it('Reset demo during the wait puts the dialog back at the check step and sends nothing', async () => {
      await render();
      await openDialog();
      await tapSend();
      expect(text(q('send-title'))).toBe('Sending…');

      demo.resetData();
      await waitForTaxOffice();

      expect(text(q('send-title'))).toBe('Send to the tax office');
      expect(q('send-ticket')).toBeNull();
      expect(button('send-confirm').disabled).toBe(false);
      expect(demo.business().vatReturns).toHaveLength(1);
      expect(sendButton().disabled).toBe(false);
    });

    it('another business opening during the wait closes the dialog, and its Send does not say Sending…', async () => {
      await render();
      await openDialog();
      await tapSend();
      expect(text(sendButton())).toBe('Sending…');

      demo.setBusiness('weber-design');
      await settle();
      // Weber's October is still running: its button is the plain one, waiting for 1 Nov.
      expect(text(sendButton())).toBe('Send to the tax office');
      expect(text(tab('vat-send-note'))).toBe('Ready to send from 1 Nov');
      expect(tax.sending()).toBe(true);

      vi.useRealTimers();
      await expectClosed();
      expect(demo.businesses.find((b) => b.id === 'weber-design')!.vatReturns).toHaveLength(2);
    });

    it('closing the dialog while it sends does not stop it: the return is still recorded', async () => {
      await render();
      await openDialog();
      await tapSend();
      dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      // The card behind says it is on its way, and cannot be tapped again.
      expect(text(sendButton())).toBe('Sending…');
      expect(sendButton().disabled).toBe(true);

      await waitForTaxOffice();
      expect(demo.business().vatReturns).toHaveLength(2);
      expect(text(sendButton())).toBe('Send to the tax office');
      expect(text(tab('vat-deadline'))).toContain('Q4 2026');
    });

    it('leaving the page while it sends does not stop it either, and breaks nothing when the answer comes', async () => {
      await render();
      await openDialog();
      await tapSend();
      fixture.destroy();
      await vi.advanceTimersByTimeAsync(SEND_MS);
      expect(demo.business().vatReturns).toHaveLength(2);
      expect(tax.sending()).toBe(false);
    });

    it('Weber October cannot be sent yet: its button opens nothing', async () => {
      await render('weber-design');
      expect(sendButton().disabled).toBe(true);
      sendButton().click();
      await settle();
      expect(dialog()).toBeNull();
    });
  });

  it('says the same in German', async () => {
    TestBed.inject(LanguageService).setLang('de');
    await render();
    await openDialog();
    expect(text(q('send-title'))).toBe('Ans Finanzamt senden');
    expect(text(q('send-period'))).toBe('3. Quartal 2026');
    expect(text(q('send-result-label'))).toBe('Zu zahlen');
    expect(sentence(q('send-via'))).toBe(
      'Deine Erklärung wird über ELSTER gesendet, den offiziellen Weg zum Finanzamt.',
    );
    expect(text(button('send-confirm'))).toBe('Senden');
    expect(text(button('send-cancel'))).toBe('Abbrechen');
    await tapSend();
    expect(text(q('send-title'))).toBe('Wird gesendet…');
    await waitForTaxOffice();
    expect(text(q('send-title'))).toBe('Gesendet ✓');
    expect(text(q('send-print'))).toBe('Protokoll drucken');
    expect(text(q('send-close'))).toBe('Schließen');
  });

  it('says the same in Arabic, mirrored, with the amounts and the ticket left to right', async () => {
    TestBed.inject(LanguageService).setLang('ar');
    await render();
    await openDialog();
    expect(dialog()!.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
    expect(text(q('send-title'))).toBe('إرسال إلى مصلحة الضرائب');
    expect(q('send-result-amount')!.closest('bdi[dir="ltr"]')?.textContent?.trim()).toBe(
      formatMoney(78564, 'ar'),
    );
    await tapSend();
    expect(text(q('send-title'))).toBe('جارٍ الإرسال…');
    await waitForTaxOffice();
    expect(text(q('send-title'))).toBe('أُرسل ✓');
    expect(q('send-ticket')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    expect(text(q('send-print'))).toBe('طباعة الإيصال');
  });
});

describe('send dialog on its own', () => {
  let demo: DemoStateService;
  let tax: TaxService;
  let fixture: ComponentFixture<SendDialog>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
    tax = TestBed.inject(TaxService);
    demo.setBusiness('cafe-linde');
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(open: boolean): Promise<void> {
    fixture = TestBed.createComponent(SendDialog);
    fixture.componentRef.setInput('view', cafeView());
    fixture.componentRef.setInput('open', open);
    await settle();
  }

  const setOpen = async (open: boolean) => {
    fixture.componentRef.setInput('open', open);
    await vi.waitFor(async () => {
      await settle();
      expect(dialog() !== null).toBe(open);
    });
  };

  it('opens at the check step each time, whatever the last time ended with', async () => {
    await render(true);
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).not.toBeNull();
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    q<HTMLButtonElement>('send-confirm')!.click();
    await settle();
    await vi.advanceTimersByTimeAsync(SEND_MS);
    await settle();
    expect(text(q('send-title'))).toBe('Sent ✓');
    vi.useRealTimers();

    await setOpen(false);
    await setOpen(true);
    expect(text(q('send-title'))).toBe('Send to the tax office');
    expect(q('send-ticket')).toBeNull();
    expect(q('send-confirm')).not.toBeNull();
  });

  it('keeps what it said while it fades out, instead of falling back to the check step', async () => {
    await render(true);
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).not.toBeNull();
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    q<HTMLButtonElement>('send-confirm')!.click();
    await settle();
    await vi.advanceTimersByTimeAsync(SEND_MS);
    await settle();
    vi.useRealTimers();

    q<HTMLButtonElement>('send-close')!.click();
    // Drawn once before the dialog is taken away.
    fixture.detectChanges();
    expect(dialog()).not.toBeNull();
    expect(text(q('send-title'))).toBe('Sent ✓');
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).toBeNull();
    });
  });

  it('a refund reads To get back, with the amount as a positive number', async () => {
    fixture = TestBed.createComponent(SendDialog);
    fixture.componentRef.setInput('view', {
      ...cafeView(),
      chargedCents: 0,
      paidCents: 6623,
      resultCents: -6623,
    });
    fixture.componentRef.setInput('open', true);
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).not.toBeNull();
    });
    expect(text(q('send-result-label'))).toBe('To get back');
    expect(text(q('send-result-amount'))).toBe(formatMoney(6623, 'en'));
  });

  it("cannot be sent while another business's return is on its way", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const other = tax.send();
    demo.setBusiness('weber-design');
    await render(true);
    await settle();
    await settle();

    // It is not Weber's return that is on its way, so the dialog does not say Sending…; it just cannot be sent now.
    expect(text(q('send-title'))).toBe('Send to the tax office');
    expect(q<HTMLButtonElement>('send-confirm')!.disabled).toBe(true);

    await vi.advanceTimersByTimeAsync(SEND_MS);
    await other;
    await settle();
    expect(q<HTMLButtonElement>('send-confirm')!.disabled).toBe(false);
  });

  it('a return that cannot be sent has a Send that is off', async () => {
    fixture = TestBed.createComponent(SendDialog);
    fixture.componentRef.setInput('view', { ...cafeView(), needsYouCount: 2 });
    fixture.componentRef.setInput('open', true);
    await vi.waitFor(async () => {
      await settle();
      expect(dialog()).not.toBeNull();
    });
    expect(q<HTMLButtonElement>('send-confirm')!.disabled).toBe(true);
  });
});
