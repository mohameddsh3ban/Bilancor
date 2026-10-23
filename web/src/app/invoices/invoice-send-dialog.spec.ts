import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance } from 'vitest';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DEMO_TODAY } from '../data/demo-date';
import type { Invoice } from '../data/models';
import { invoiceStatus } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService, SEND_MS } from '../state/invoice.service';
import { InvoicePage } from './invoice.page';
import { InvoiceSendDialog } from './invoice-send-dialog';

@Component({ template: '' })
class EditStub {}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim() ?? '';
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const q = <T extends HTMLElement = HTMLElement>(testId: string) =>
  dialog()?.querySelector<T>(`[data-testid="${testId}"]`) ?? null;
const button = (testId: string) => q<HTMLButtonElement>(testId)!;

describe('the send step, opened from the invoice page', () => {
  let demo: DemoStateService;
  let invoices: InvoiceService;
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;
  let warn: MockInstance;
  let error: MockInstance;

  beforeEach(() => {
    localStorage.clear();
    harness = undefined;
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: 'invoices/:id', component: InvoicePage },
          { path: 'invoices/:id/edit', component: EditStub },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    invoices = TestBed.inject(InvoiceService);
  });

  afterEach(() => {
    vi.useRealTimers();
    // Nothing the send step does may leave a warning or an error in the log.
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
  }

  async function render(url: string): Promise<void> {
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const page = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const invoiceOf = (id: string): Invoice => demo.business().invoices.find((i) => i.id === id)!;
  const historyLines = () =>
    Array.from(el.querySelectorAll('[data-testid="history-text"]')).map((line) => text(line));

  async function expectOpen(): Promise<void> {
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

  /** Taps Send and takes the clock over from there, so the wait is the test's to run. */
  async function tapSend(): Promise<void> {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    button('send-confirm').click();
    await settle();
  }

  async function wait(ms = SEND_MS): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await settle();
  }

  async function closeDialog(): Promise<void> {
    vi.useRealTimers();
    button('send-close').click();
    await expectClosed();
  }

  describe('an invoice', () => {
    it('preview and send: Sending… then Sent ✓ RE-2026-045, the invoice is open', async () => {
      await render('/invoices/inv-wd-draft');
      expect(dialog()).toBeNull();
      expect(text(page('preview-send'))).toBe('Preview and send');
      expect(invoiceStatus(invoiceOf('inv-wd-draft'), demo.business())).toBe('draft');

      page('preview-send')!.click();
      await expectOpen();

      // The check step: what is about to go out.
      expect(text(q('send-title'))).toBe('Send invoice');
      expect(text(q('send-to'))).toBe('rechnungseingang@bezirksamt-pankow.example');
      expect(text(q('send-subject'))).toBe('Rechnung RE-2026-045');
      expect(q('send-kind')).toBeNull(); // the invoice needs no German term beside it
      expect(text(q('send-attachment'))).toContain('RE-2026-045.pdf');
      expect(text(q('send-attachment'))).toContain('RE-2026-045.xml');
      expect(text(q('send-attachment'))).toContain('(XRechnung)');
      const message = q<HTMLTextAreaElement>('send-message')!;
      expect(message.value).toContain('Guten Tag Bezirksamt Pankow');
      expect(message.value).toContain('RE-2026-045');
      expect(text(button('send-confirm'))).toBe('Send');
      expect(text(button('send-cancel'))).toBe('Cancel');
      expect(invoiceOf('inv-wd-draft').number).toBeNull(); // nothing is sent before the person presses Send

      // Sending…
      await tapSend();
      expect(invoices.sending()).toBe('inv-wd-draft');
      expect(text(q('send-title'))).toBe('Sending…');
      expect(q('send-confirm')).toBeNull();
      expect(q('send-cancel')).toBeNull();
      expect(q('send-message')).toBeNull();
      expect(text(q('send-sending'))).toContain('rechnungseingang@bezirksamt-pankow.example');
      // The page behind says the same, and cannot send it a second time.
      expect(text(page('preview-send'))).toBe('Sending…');
      expect((page('preview-send') as HTMLButtonElement).disabled).toBe(true);

      await wait(SEND_MS - 1);
      expect(text(q('send-title'))).toBe('Sending…');
      expect(invoiceOf('inv-wd-draft').number).toBeNull();

      // Sent ✓, with the number it was given.
      await wait(1);
      expect(text(q('send-title'))).toBe('Sent ✓');
      expect(text(q('send-done'))).toBe(
        'Your invoice was sent to rechnungseingang@bezirksamt-pankow.example.',
      );
      expect(text(q('send-number'))).toBe('RE-2026-045');
      expect(text(button('send-close'))).toBe('Close');
      expect(q('send-confirm')).toBeNull();
      expect(invoices.sending()).toBeNull();

      // The invoice is open now: it has its number, its sent document and a history line.
      expect(invoiceOf('inv-wd-draft')).toMatchObject({
        number: 'RE-2026-045',
        sentOn: DEMO_TODAY,
      });
      expect(invoiceStatus(invoiceOf('inv-wd-draft'), demo.business())).toBe('open');
      expect(text(page('invoice-status'))).toBe('Due 5 Nov');
      expect(text(page('invoice-meta'))).toContain('RE-2026-045');
      expect(historyLines()[0]).toBe(
        'You sent it by email to rechnungseingang@bezirksamt-pankow.example',
      );
      expect(demo.business().documents.some((d) => d.id === 'doc-inv-wd-draft')).toBe(true);
      // And the main button is the next step of an open invoice.
      expect(page('preview-send')).toBeNull();
      expect(page('download-pdf')).not.toBeNull();

      await closeDialog();
    });

    it('sends the message the person wrote, to the address shown', async () => {
      const send = vi.spyOn(invoices, 'send');
      await render('/invoices/inv-wd-draft');
      page('preview-send')!.click();
      await expectOpen();
      const message = q<HTMLTextAreaElement>('send-message')!;
      message.value = 'Guten Tag, anbei die Rechnung. Viele Grüße';
      message.dispatchEvent(new Event('input'));
      await settle();

      await tapSend();
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith('inv-wd-draft', {
        to: 'rechnungseingang@bezirksamt-pankow.example',
        subject: 'Rechnung RE-2026-045',
        body: 'Guten Tag, anbei die Rechnung. Viele Grüße',
      });
      await wait();
      await closeDialog();
    });

    it('?send=1 opens the send step, and the address is clean afterwards', async () => {
      await render('/invoices/inv-wd-draft?send=1');
      await expectOpen();
      expect(text(q('send-title'))).toBe('Send invoice');
      expect(text(q('send-subject'))).toBe('Rechnung RE-2026-045');
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/invoices/inv-wd-draft'));
      expect(invoiceOf('inv-wd-draft').number).toBeNull();

      button('send-cancel').click();
      await expectClosed();
      expect(invoiceOf('inv-wd-draft').number).toBeNull();
    });

    it('?send=1 opens nothing for an invoice that cannot be sent: a sent one, or a draft with something missing', async () => {
      await render('/invoices/inv-wd-044?send=1');
      await settle();
      expect(dialog()).toBeNull();
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/invoices/inv-wd-044'));

      const draft = invoiceOf('inv-wd-draft');
      demo.saveInvoice({ ...draft, customer: { ...draft.customer, email: '' } });
      await render('/invoices/inv-wd-draft?send=1');
      await settle();
      expect(dialog()).toBeNull();
    });

    it('a draft with something missing cannot be sent from the page: Edit is its next step', async () => {
      const draft = invoiceOf('inv-wd-draft');
      demo.saveInvoice({ ...draft, lines: [] });
      await render('/invoices/inv-wd-draft');
      expect(page('preview-send')).toBeNull();
      expect(text(page('edit-invoice'))).toBe('Edit');
      expect(text(page('not-ready'))).toBe('Not ready to send yet. Edit shows what is missing.');
    });

    it('a ZUGFeRD invoice names its e-invoice data, a plain PDF only the file', async () => {
      const draft = invoiceOf('inv-wd-draft');
      demo.saveInvoice({
        ...draft,
        customer: { ...draft.customer, kind: 'business', leitwegId: null, name: 'Müller GmbH' },
      });
      await render('/invoices/inv-wd-draft?send=1');
      await expectOpen();
      expect(text(q('send-attachment'))).toContain('RE-2026-045.pdf');
      expect(text(q('send-attachment'))).toContain('(ZUGFeRD)');
      expect(text(q('send-attachment'))).not.toContain('.xml');
      button('send-cancel').click();
      await expectClosed();

      demo.saveInvoice({
        ...invoiceOf('inv-wd-draft'),
        customer: { ...draft.customer, kind: 'private', leitwegId: null },
      });
      await render('/invoices/inv-wd-draft?send=1');
      await expectOpen();
      expect(text(q('send-attachment'))).toBe('RE-2026-045.pdf');
    });

    it('an English invoice has its email in English, whatever the language of the app', async () => {
      const draft = invoiceOf('inv-wd-draft');
      demo.saveInvoice({ ...draft, language: 'en' });
      await render('/invoices/inv-wd-draft?send=1');
      await expectOpen();
      expect(text(q('send-subject'))).toBe('Invoice RE-2026-045');
      expect(q<HTMLTextAreaElement>('send-message')!.value).toContain('Hello Bezirksamt Pankow');
      expect(q('send-subject')!.getAttribute('lang')).toBe('en');
    });
  });

  describe('a reminder', () => {
    it('?remind=1 on Bäckerei Lange sends the friendly reminder', async () => {
      await render('/invoices/inv-wd-039?remind=1');
      await expectOpen();

      expect(text(q('send-title'))).toBe('Send a friendly reminder');
      // The type is a German term, explained on tap.
      expect(text(q('send-kind'))).toBe('Friendly reminder (Zahlungserinnerung)');
      expect(q('send-kind')!.querySelector('app-term button')).not.toBeNull();
      expect(text(q('send-to'))).toBe('info@baeckerei-lange.example');
      expect(text(q('send-subject'))).toBe('Zahlungserinnerung zu Rechnung RE-2026-039');
      expect(text(q('send-attachment'))).toContain('RE-2026-039.pdf');
      expect(q<HTMLTextAreaElement>('send-message')!.value).toContain(
        'Vielleicht ist die Zahlung nur untergegangen',
      );
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/invoices/inv-wd-039'));

      await tapSend();
      expect(text(q('send-title'))).toBe('Sending…');
      expect(text(page('send-reminder'))).toBe('Sending…');
      expect(invoiceOf('inv-wd-039').reminders).toEqual([]);

      await wait();
      expect(text(q('send-title'))).toBe('Sent ✓');
      expect(text(q('send-done'))).toBe('The reminder was sent to info@baeckerei-lange.example.');
      expect(q('send-number')).toBeNull(); // a reminder gets no new number

      // One reminder is on the invoice; it stays overdue, with its due date.
      expect(invoiceOf('inv-wd-039').reminders).toEqual([{ level: 1, sentOn: DEMO_TODAY }]);
      expect(invoiceStatus(invoiceOf('inv-wd-039'), demo.business())).toBe('overdue');
      expect(historyLines()[0]).toBe('You sent reminder 1 of 2 by email');
      expect(text(page('invoice-status'))).toBe('Overdue 22 days');

      // Between the levels the next step says when the formal one is possible, and offers nothing to send.
      expect(page('send-reminder')).toBeNull();
      expect(text(page('invoice-reminded'))).toBe(
        'Reminded 22 Oct · formal reminder possible from 29 Oct',
      );
      await closeDialog();
      expect(page('send-reminder')).toBeNull();
    });

    it('café formal reminder: the Mahnung, a week after the friendly one', async () => {
      demo.setBusiness('cafe-linde');
      await render('/invoices/inv-cl-053?remind=1');
      await expectOpen();

      expect(text(q('send-title'))).toBe('Send formal reminder');
      expect(text(q('send-kind'))).toBe('Formal reminder (Mahnung)');
      expect(text(q('send-to'))).toBe('sekretariat@kanzlei-hoffmann.example');
      expect(text(q('send-subject'))).toBe('Mahnung zu Rechnung RE-2026-053');
      expect(q<HTMLTextAreaElement>('send-message')!.value).toContain('Verzugszinsen');

      await tapSend();
      await wait();
      expect(text(q('send-title'))).toBe('Sent ✓');
      expect(invoiceOf('inv-cl-053').reminders.map((r) => r.level)).toEqual([1, 2]);
      expect(historyLines()[0]).toBe('You sent reminder 2 of 2 by email');
      expect(invoiceStatus(invoiceOf('inv-cl-053'), demo.business())).toBe('overdue');

      // That was the last level: nothing more to send, and the day of the last one is said.
      expect(page('send-reminder')).toBeNull();
      expect(text(page('invoice-reminded'))).toBe('Reminded 22 Oct');
      await closeDialog();
    });

    it('the page offers the reminder as its main button, named by its level, and opens the step', async () => {
      await render('/invoices/inv-wd-039');
      expect(text(page('send-reminder'))).toBe('Send a friendly reminder');
      expect(dialog()).toBeNull();
      expect(page('invoice-reminded')).toBeNull();
      // Download is still there, as a smaller button after it.
      expect(text(page('download-pdf'))).toBe('Download PDF');
      page('send-reminder')!.click();
      await expectOpen();
      expect(text(q('send-title'))).toBe('Send a friendly reminder');
      button('send-cancel').click();
      await expectClosed();

      demo.setBusiness('cafe-linde');
      await render('/invoices/inv-cl-053');
      expect(text(page('send-reminder'))).toBe('Send formal reminder');
      expect(text(page('invoice-reminded'))).toBe('Reminded 12 Oct');
    });

    it('?remind=1 opens nothing when no reminder can be sent: not overdue, a draft, or between the levels', async () => {
      await render('/invoices/inv-wd-044?remind=1'); // open, not yet due
      await settle();
      expect(dialog()).toBeNull();
      await render('/invoices/inv-wd-draft?remind=1');
      await settle();
      expect(dialog()).toBeNull();

      const lange = invoiceOf('inv-wd-039');
      demo.saveInvoice({ ...lange, reminders: [{ level: 1, sentOn: '2026-10-20' }] });
      await render('/invoices/inv-wd-039?remind=1');
      await settle();
      expect(dialog()).toBeNull();
      expect(text(page('invoice-reminded'))).toBe(
        'Reminded 20 Oct · formal reminder possible from 27 Oct',
      );
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/invoices/inv-wd-039'));
    });

    it('a reminder for a part-paid invoice asks for what is left', async () => {
      demo.setBusiness('sara-yoga');
      const invoice = invoiceOf('inv-sy-021');
      demo.saveInvoice({ ...invoice, issueDate: '2026-09-01', paymentTermDays: 14 }); // due 15 Sep, 300.00 left
      await render('/invoices/inv-sy-021?remind=1');
      await expectOpen();
      expect(text(q('send-subject'))).toBe('Zahlungserinnerung zu Rechnung RE-2026-021');
      expect(q<HTMLTextAreaElement>('send-message')!.value).toContain('300,00');
      expect(q<HTMLTextAreaElement>('send-message')!.value).not.toContain('600,00');
    });
  });

  describe('closing it', () => {
    it('cancel sends nothing, now or when the wait would have been over', async () => {
      await render('/invoices/inv-wd-draft');
      page('preview-send')!.click();
      await expectOpen();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      button('send-cancel').click();
      expect(invoices.sending()).toBeNull();
      await vi.advanceTimersByTimeAsync(SEND_MS * 2);
      vi.useRealTimers();
      await expectClosed();
      expect(invoiceOf('inv-wd-draft').number).toBeNull();
      expect(text(page('preview-send'))).toBe('Preview and send');
    });

    it('the cross, Escape and a tap outside close it as cancel, and it opens again', async () => {
      await render('/invoices/inv-wd-draft');
      for (const close of [
        () => dialog()!.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!.click(),
        () =>
          dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
        () => document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click(),
      ]) {
        page('preview-send')!.click();
        await expectOpen();
        close();
        await expectClosed();
        expect(invoices.sending()).toBeNull();
        expect(invoiceOf('inv-wd-draft').number).toBeNull();
      }
    });

    it('what was typed is gone when it opens again', async () => {
      await render('/invoices/inv-wd-draft');
      page('preview-send')!.click();
      await expectOpen();
      const message = q<HTMLTextAreaElement>('send-message')!;
      message.value = 'Something else';
      message.dispatchEvent(new Event('input'));
      await settle();
      button('send-cancel').click();
      await expectClosed();

      page('preview-send')!.click();
      await expectOpen();
      expect(q<HTMLTextAreaElement>('send-message')!.value).toContain(
        'Guten Tag Bezirksamt Pankow',
      );
    });

    it('closing it while it sends does not stop the invoice: the page keeps saying Sending…', async () => {
      await render('/invoices/inv-wd-draft');
      page('preview-send')!.click();
      await expectOpen();
      await tapSend();
      dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(text(page('preview-send'))).toBe('Sending…');
      expect((page('preview-send') as HTMLButtonElement).disabled).toBe(true);

      await wait();
      expect(invoiceOf('inv-wd-draft').number).toBe('RE-2026-045');
      expect(page('preview-send')).toBeNull();
    });

    it('a reset while sending closes quietly: nothing was sent, and nothing is said', async () => {
      await render('/invoices/inv-wd-draft');
      page('preview-send')!.click();
      await expectOpen();
      await tapSend();
      expect(text(q('send-title'))).toBe('Sending…');

      demo.resetData();
      await wait();
      vi.useRealTimers();
      await expectClosed();

      expect(invoices.sending()).toBeNull();
      expect(invoiceOf('inv-wd-draft').number).toBeNull();
      expect(invoiceOf('inv-wd-draft').history).toHaveLength(1);
      expect(text(page('preview-send'))).toBe('Preview and send');
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('a reset while a reminder is on its way closes quietly too', async () => {
      await render('/invoices/inv-wd-039?remind=1');
      await expectOpen();
      await tapSend();
      demo.resetData();
      await wait();
      vi.useRealTimers();
      await expectClosed();
      expect(invoiceOf('inv-wd-039').reminders).toEqual([]);
    });

    it('leaving the page while it sends still sends, and breaks nothing when the answer comes', async () => {
      await render('/invoices/inv-wd-draft');
      page('preview-send')!.click();
      await expectOpen();
      await tapSend();
      harness!.fixture.destroy();
      await vi.advanceTimersByTimeAsync(SEND_MS);
      expect(invoiceOf('inv-wd-draft').number).toBe('RE-2026-045');
      expect(invoices.sending()).toBeNull();
    });

    it('the Send of the page is off while another invoice is on its way', async () => {
      await render('/invoices/inv-wd-draft');
      expect((page('preview-send') as HTMLButtonElement).disabled).toBe(false);

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const copy = invoices.duplicate('inv-wd-044');
      void invoices.send(copy, { to: 'x@example.com', subject: 's', body: 'b' });
      await settle();
      expect(invoices.sending()).toBe(copy);
      expect((page('preview-send') as HTMLButtonElement).disabled).toBe(true);
      expect(text(page('preview-send'))).toBe('Preview and send'); // it is not this invoice that is on its way

      await wait();
      expect((page('preview-send') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('as a dialog', () => {
    it('is a labelled modal dialog, and the cursor stays on its title as the steps change', async () => {
      await render('/invoices/inv-wd-draft?send=1');
      await expectOpen();
      const labelledBy = dialog()!.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy!)).toBe(q('send-title'));
      expect(dialog()!.getAttribute('aria-modal')).toBe('true');
      expect(text(dialog()!.querySelector('[data-slot="dialog-close"]'))).toBe('Close');

      await tapSend();
      await settle();
      expect(document.activeElement).toBe(q('send-title'));
      (document.activeElement as HTMLElement).blur();
      await wait();
      expect(text(q('send-title'))).toBe('Sent ✓');
      expect(document.activeElement).toBe(q('send-title'));
      await closeDialog();
    });

    it('takes no place in the page: its element is not displayed, and the card is as wide as the screen less a margin', async () => {
      await render('/invoices/inv-wd-draft?send=1');
      await expectOpen();
      const host = el.querySelector('app-invoice-send-dialog')!;
      expect(getComputedStyle(host).display).toBe('none');
      expect(host.contains(dialog())).toBe(false);
      expect(Array.from(q('invoice-send-dialog')!.classList)).toEqual(
        expect.arrayContaining(['w-[calc(100vw-2rem)]', 'max-w-md', 'overflow-y-auto']),
      );
    });

    it('explains the German term of a reminder on tap, without closing the dialog', async () => {
      await render('/invoices/inv-wd-039?remind=1');
      await expectOpen();
      q('send-kind')!.querySelector<HTMLButtonElement>('app-term button')!.click();
      await settle();
      expect(document.body.querySelectorAll('hlm-popover-content').length).toBeGreaterThan(0);
      expect(dialog()).not.toBeNull();
    });

    it('says the same in German', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render('/invoices/inv-wd-draft?send=1');
      await expectOpen();
      expect(text(q('send-title'))).toBe('Rechnung senden');
      expect(text(button('send-confirm'))).toBe('Senden');
      expect(text(button('send-cancel'))).toBe('Abbrechen');
      await tapSend();
      expect(text(q('send-title'))).toBe('Wird gesendet…');
      await wait();
      expect(text(q('send-title'))).toBe('Gesendet ✓');
      expect(text(button('send-close'))).toBe('Schließen');
      await closeDialog();
    });

    it('Arabic: the dialog is right to left, with the address, the number and the email itself left to right', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('/invoices/inv-wd-draft?send=1');
      await expectOpen();
      expect(dialog()!.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
      expect(text(q('send-title'))).toBe('إرسال الفاتورة');
      expect(q('send-to')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      // The email is German: its subject and message read left to right, with the language marked.
      expect(q('send-subject')!.getAttribute('dir')).toBe('ltr');
      expect(q('send-subject')!.getAttribute('lang')).toBe('de');
      const message = q<HTMLTextAreaElement>('send-message')!;
      expect(message.getAttribute('dir')).toBe('ltr');
      expect(message.getAttribute('lang')).toBe('de');
      expect(q('send-attachment')!.querySelector('bdi[dir="ltr"]')).not.toBeNull();

      await tapSend();
      expect(text(q('send-title'))).toBe('جارٍ الإرسال…');
      await wait();
      expect(text(q('send-title'))).toBe('أُرسل ✓');
      expect(q('send-number')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      expect(text(q('send-number'))).toBe('RE-2026-045');
      // The address inside the Arabic sentence is set apart, so it keeps its own direction.
      expect(q('send-done')!.textContent).toContain('⁨rechnungseingang@bezirksamt-pankow.example⁩');
      await closeDialog();
    });
  });
});

describe('the send step on its own', () => {
  let fixture: ComponentFixture<InvoiceSendDialog>;
  let demo: DemoStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
  });

  async function render(inputs: {
    invoiceId: string;
    kind: 'invoice' | 'reminder1' | 'reminder2';
    open: boolean;
  }): Promise<void> {
    fixture = TestBed.createComponent(InvoiceSendDialog);
    fixture.componentRef.setInput('invoiceId', inputs.invoiceId);
    fixture.componentRef.setInput('kind', inputs.kind);
    fixture.componentRef.setInput('open', inputs.open);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('is closed until it is told to open, and tells when it closes itself', async () => {
    await render({ invoiceId: 'inv-wd-draft', kind: 'invoice', open: false });
    expect(dialog()).toBeNull();
    const closed: boolean[] = [];
    fixture.componentInstance.open.subscribe((open) => closed.push(open));

    fixture.componentRef.setInput('open', true);
    await vi.waitFor(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      expect(dialog()).not.toBeNull();
    });
    button('send-cancel').click();
    await vi.waitFor(() => expect(closed).toEqual([false]));
  });

  it('an invoice that is not there gives an empty step that can only be closed', async () => {
    await render({ invoiceId: 'nope', kind: 'invoice', open: true });
    await vi.waitFor(async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      expect(dialog()).not.toBeNull();
    });
    expect(q('send-confirm')).toBeNull();
    expect(q('send-message')).toBeNull();
    expect(demo.business().invoices.some((i) => i.id === 'nope')).toBe(false);
  });
});
