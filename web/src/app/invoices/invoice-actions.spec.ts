import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DEMO_TODAY } from '../data/demo-date';
import type { Invoice } from '../data/models';
import { invoiceStatus } from '../domain/invoices';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService } from '../state/invoice.service';
import { InvoiceActions } from './invoice-actions';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

@Component({ template: '' })
class EditStub {}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim() ?? '';
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = <T extends HTMLElement = HTMLElement>(testId: string) =>
  dialog()?.querySelector<T>(`[data-testid="${testId}"]`) ?? null;
const inBody = (testId: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

describe('InvoiceActions', () => {
  let fixture: ComponentFixture<InvoiceActions>;
  let demo: DemoStateService;
  let invoices: InvoiceService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([{ path: 'invoices/:id/edit', component: EditStub }]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    invoices = TestBed.inject(InvoiceService);
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

  async function render(id: string, businessId = 'weber-design'): Promise<void> {
    demo.setBusiness(businessId);
    fixture = TestBed.createComponent(InvoiceActions);
    fixture.componentRef.setInput('invoiceId', id);
    await settle();
  }

  const q = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const invoiceOf = (id: string, businessId = 'weber-design'): Invoice =>
    demo.businesses.find((b) => b.id === businessId)!.invoices.find((i) => i.id === id)!;
  const statusOf = (id: string, businessId = 'weber-design') =>
    invoiceStatus(
      invoiceOf(id, businessId),
      demo.businesses.find((b) => b.id === businessId)!,
    );

  async function expectDialog(open: boolean): Promise<void> {
    await vi.waitFor(async () => {
      await settle();
      expect(dialog() !== null).toBe(open);
    });
  }

  async function openMenu(): Promise<void> {
    q('more-actions')!.click();
    await vi.waitFor(async () => {
      await settle();
      expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    });
  }

  const menuItems = () =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menu"] [data-testid^="menu-"]'),
    ).map((item) => item.getAttribute('data-testid'));

  describe('which actions an invoice has', () => {
    it('an open invoice: mark as paid, the menu with duplicate and cancel, and the demo payment', async () => {
      await render('inv-wd-044');
      expect(text(q('mark-paid'))).toBe('Mark as paid');
      expect(q('more-actions')!.getAttribute('aria-label')).toBe('More actions');
      expect(q('demo-payment')).not.toBeNull();
      await openMenu();
      expect(menuItems()).toEqual(['menu-duplicate', 'menu-cancel']);
      expect(text(inBody('menu-duplicate'))).toBe('Duplicate');
      expect(text(inBody('menu-cancel'))).toBe('Cancel invoice');
    });

    it('an overdue invoice has the same', async () => {
      await render('inv-wd-039');
      expect(q('mark-paid')).not.toBeNull();
      await openMenu();
      expect(menuItems()).toEqual(['menu-duplicate', 'menu-cancel']);
      expect(q('demo-payment')).not.toBeNull();
    });

    it('a part-paid invoice can be paid in cash, copied, and says why it cannot be cancelled', async () => {
      demo.setBusiness('sara-yoga');
      demo.renewConnection('sy-qonto');
      await render('inv-sy-021', 'sara-yoga');
      expect(statusOf('inv-sy-021', 'sara-yoga')).toBe('partlyPaid');
      expect(q('mark-paid')).not.toBeNull();
      await openMenu();
      expect(menuItems()).toEqual(['menu-duplicate', 'menu-cancel-paid']);
      expect(text(inBody('menu-cancel-paid'))).toBe(
        'Cancelling an invoice that was partly paid needs a credit note — coming later',
      );
      expect(q('demo-payment')).not.toBeNull();
    });

    it('a paid invoice: nothing to pay, and the menu only explains that cancelling needs a credit note', async () => {
      await render('inv-wd-043');
      expect(q('mark-paid')).toBeNull();
      expect(q('demo-payment')).toBeNull();
      await openMenu();
      expect(menuItems()).toEqual(['menu-cancel-paid']);
      const note = inBody('menu-cancel-paid')!;
      expect(text(note)).toBe('Cancelling a paid invoice needs a credit note — coming later');
      expect(note.getAttribute('aria-disabled')).toBe('true');
      // It is words, not a button: tapping it changes nothing.
      note.click();
      await settle();
      expect(statusOf('inv-wd-043')).toBe('paid');
      expect(dialog()).toBeNull();
    });

    it('a draft, a cancelled invoice, a cancellation invoice and an unknown id have none', async () => {
      for (const id of ['inv-wd-draft', 'inv-wd-040', 'inv-wd-042', 'nope']) {
        await render(id);
        expect(q('invoice-actions'), id).toBeNull();
        expect(q('mark-paid'), id).toBeNull();
        expect(q('more-actions'), id).toBeNull();
        expect(q('demo-payment'), id).toBeNull();
      }
    });

    it('follows the invoice: after it is paid the actions are gone', async () => {
      await render('inv-wd-044');
      invoices.simulatePayment('inv-wd-044');
      await settle();
      expect(q('mark-paid')).toBeNull();
      expect(q('demo-payment')).toBeNull();
    });
  });

  describe('mark as paid', () => {
    it('mark as paid in cash: asks for the day, starting with today, and puts the money in the cash box', async () => {
      await render('inv-wd-044');
      q('mark-paid')!.click();
      await expectDialog(true);

      expect(text(inDialog('pay-title'))).toBe('Mark RE-2026-044 as paid');
      expect(text(inDialog('pay-body'))).toContain('Paid in cash on');
      const date = inDialog<HTMLInputElement>('pay-date')!;
      expect(date.type).toBe('date');
      expect(date.value).toBe(DEMO_TODAY);
      expect(date.max).toBe(DEMO_TODAY);
      expect(date.min).toBe('2026-10-16'); // the day of the invoice
      expect(date.getAttribute('dir')).toBe('ltr');
      expect(inDialog<HTMLButtonElement>('pay-confirm')!.disabled).toBe(false);
      expect(statusOf('inv-wd-044')).toBe('open'); // nothing happens before the person confirms

      date.value = '2026-10-21';
      date.dispatchEvent(new Event('input'));
      await settle();
      inDialog('pay-confirm')!.click();
      await expectDialog(false);

      const business = demo.business();
      const cash = business.accounts.find((a) => a.kind === 'cash')!;
      expect(business.transactions[0]).toMatchObject({
        accountId: cash.id,
        date: '2026-10-21',
        amountCents: 238000,
        counterparty: 'Studio Kern',
      });
      expect(statusOf('inv-wd-044')).toBe('paid');
      expect(invoiceOf('inv-wd-044').history[1]).toMatchObject({ key: 'paidInCash' });
    });

    it('the hint says how the payment is recorded, not that money goes into the cash box: no balance moves in the demo', async () => {
      await render('inv-wd-044');
      q('mark-paid')!.click();
      await expectDialog(true);
      expect(text(inDialog('pay-hint'))).toBe(
        "It's recorded as a cash payment and counts like any other payment in your VAT return and year figures.",
      );

      expect(de.invoices.actions.payDialog.hint).not.toContain('Kasse');
      expect(ar.invoices.actions.payDialog.hint).not.toContain('صندوق');
      expect(en.invoices.actions.payDialog.hint).not.toContain('cash box');
    });

    it('in German the line "marked as paid in cash" is about the invoice or the payment, both feminine: sie', () => {
      expect(de.history.paidInCash).toBe('Du hast sie als bar bezahlt markiert');
    });

    it('with today as the day, as it starts', async () => {
      await render('inv-wd-044');
      q('mark-paid')!.click();
      await expectDialog(true);
      inDialog('pay-confirm')!.click();
      await expectDialog(false);
      expect(demo.business().transactions[0].date).toBe(DEMO_TODAY);
    });

    it('pays what is left of a part-paid invoice', async () => {
      demo.setBusiness('sara-yoga');
      demo.renewConnection('sy-qonto');
      await render('inv-sy-021', 'sara-yoga');
      q('mark-paid')!.click();
      await expectDialog(true);
      inDialog('pay-confirm')!.click();
      await expectDialog(false);
      expect(demo.business().transactions[0].amountCents).toBe(30000);
      expect(statusOf('inv-sy-021', 'sara-yoga')).toBe('paid');
    });

    it('a day after today, before the invoice, or none cannot be confirmed, and the field says what is wanted', async () => {
      await render('inv-wd-044');
      q('mark-paid')!.click();
      await expectDialog(true);
      const date = inDialog<HTMLInputElement>('pay-date')!;
      expect(inDialog('pay-error')).toBeNull();

      for (const day of ['2026-10-23', '2026-10-15', '']) {
        date.value = day;
        date.dispatchEvent(new Event('input'));
        await settle();
        expect(inDialog<HTMLButtonElement>('pay-confirm')!.disabled, day).toBe(true);
        expect(text(inDialog('pay-error')), day).toBe(
          'Pick a day from the invoice date up to today.',
        );
        expect(inDialog('pay-error')!.getAttribute('role')).toBe('alert');
        expect(date.getAttribute('aria-invalid')).toBe('true');
      }
      date.value = '2026-10-16';
      date.dispatchEvent(new Event('input'));
      await settle();
      expect(inDialog<HTMLButtonElement>('pay-confirm')!.disabled).toBe(false);
      expect(inDialog('pay-error')).toBeNull();
    });

    it('cancel, and the day being forgotten when it opens again', async () => {
      await render('inv-wd-044');
      q('mark-paid')!.click();
      await expectDialog(true);
      const date = inDialog<HTMLInputElement>('pay-date')!;
      date.value = '2026-10-18';
      date.dispatchEvent(new Event('input'));
      await settle();
      inDialog('pay-cancel')!.click();
      await expectDialog(false);
      expect(statusOf('inv-wd-044')).toBe('open');
      expect(demo.business().transactions.some((t) => t.date === '2026-10-18')).toBe(false);

      q('mark-paid')!.click();
      await expectDialog(true);
      expect(inDialog<HTMLInputElement>('pay-date')!.value).toBe(DEMO_TODAY);
    });

    it('the cross and Escape close it and change nothing', async () => {
      await render('inv-wd-044');
      for (const close of [
        () => dialog()!.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!.click(),
        () =>
          dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
      ]) {
        q('mark-paid')!.click();
        await expectDialog(true);
        close();
        await expectDialog(false);
        expect(statusOf('inv-wd-044')).toBe('open');
      }
    });
  });

  describe('duplicate', () => {
    it('makes a new draft with the same customer and lines, and goes to its edit page', async () => {
      await render('inv-wd-044');
      const before = demo.business().invoices.length;
      await openMenu();
      inBody('menu-duplicate')!.click();
      await settle();

      const invoicesNow = demo.business().invoices;
      expect(invoicesNow).toHaveLength(before + 1);
      const copy = invoicesNow.at(-1)!;
      expect(copy.number).toBeNull();
      expect(copy.customer.name).toBe('Studio Kern');
      expect(copy.lines).toEqual(invoiceOf('inv-wd-044').lines);
      expect(copy.history[0]).toMatchObject({
        key: 'invoiceDuplicated',
        params: { number: 'RE-2026-044' },
      });
      await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe(`/invoices/${copy.id}/edit`));
    });
  });

  describe('cancel invoice', () => {
    it('asks once, with what happens, before it does anything', async () => {
      await render('inv-wd-044');
      await openMenu();
      inBody('menu-cancel')!.click();
      await expectDialog(true);

      expect(text(inDialog('cancel-title'))).toBe('Cancel invoice RE-2026-044?');
      expect(text(inDialog('cancel-body'))).toBe(
        'This creates a cancellation invoice. The original stays on record.',
      );
      expect(text(inDialog('cancel-keep'))).toBe('Keep invoice');
      expect(text(inDialog('cancel-confirm'))).toBe('Cancel invoice');
      expect(statusOf('inv-wd-044')).toBe('open');
      expect(
        demo.business().invoices.some((i) => i.cancels !== null && i.cancels === 'inv-wd-044'),
      ).toBe(false);
    });

    it('keep invoice closes it and changes nothing', async () => {
      await render('inv-wd-044');
      const before = demo.business();
      await openMenu();
      inBody('menu-cancel')!.click();
      await expectDialog(true);
      inDialog('cancel-keep')!.click();
      await expectDialog(false);
      expect(demo.business()).toBe(before);
    });

    it('confirming makes the cancellation invoice RE-2026-045 and cancels the original', async () => {
      await render('inv-wd-044');
      await openMenu();
      inBody('menu-cancel')!.click();
      await expectDialog(true);
      inDialog('cancel-confirm')!.click();
      await expectDialog(false);

      expect(statusOf('inv-wd-044')).toBe('cancelled');
      const original = invoiceOf('inv-wd-044');
      const cancellation = demo.business().invoices.find((i) => i.id === original.cancelledBy)!;
      expect(cancellation).toMatchObject({ number: 'RE-2026-045', cancels: 'inv-wd-044' });
      // A cancelled invoice has nothing left to do here.
      expect(q('mark-paid')).toBeNull();
      expect(q('more-actions')).toBeNull();
      expect(q('demo-payment')).toBeNull();
    });

    it('closes quietly when it can no longer be cancelled (it was paid meanwhile)', async () => {
      await render('inv-wd-044');
      await openMenu();
      inBody('menu-cancel')!.click();
      await expectDialog(true);
      invoices.simulatePayment('inv-wd-044');
      inDialog('cancel-confirm')!.click();
      await expectDialog(false);
      expect(statusOf('inv-wd-044')).toBe('paid');
      expect(
        demo.business().invoices.some((i) => i.cancels !== null && i.cancels === 'inv-wd-044'),
      ).toBe(false);
    });
  });

  describe('the demo payment', () => {
    it('is marked as demo, in the style of the demo bar', async () => {
      await render('inv-wd-044');
      const control = q('demo-control')!;
      expect(text(control.querySelector('[data-testid="demo-label"]'))).toBe('Demo');
      expect(text(q('demo-payment'))).toBe("Simulate the customer's payment");
      expect(control.classList).toContain('bg-primary');
      expect(control.classList).toContain('text-primary-foreground');
    });

    it('demo payment turns Studio Kern paid, with the payment on the bank account', async () => {
      await render('inv-wd-044');
      q('demo-payment')!.click();
      await settle();
      expect(statusOf('inv-wd-044')).toBe('paid');
      expect(demo.business().transactions[0]).toMatchObject({
        accountId: 'wd-qonto',
        amountCents: 238000,
        reference: 'RE-2026-044',
      });
      expect(q('demo-payment')).toBeNull();
    });

    it('is hidden without a bank: not connected yet, or a sign-in that has ended', async () => {
      await render('inv-wd-044');
      expect(q('demo-payment')).not.toBeNull();
      demo.setSetup('new');
      await settle();
      expect(q('demo-payment')).toBeNull();
      expect(q('mark-paid')).not.toBeNull(); // paying in cash needs no bank

      demo.setSetup('active');
      await render('inv-sy-021', 'sara-yoga'); // Qonto's consent ended on 20 Oct
      expect(q('demo-payment')).toBeNull();
      demo.renewConnection('sy-qonto');
      await settle();
      expect(q('demo-payment')).not.toBeNull();
    });
  });

  describe('in other languages', () => {
    it('says the same in German', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render('inv-wd-044');
      expect(text(q('mark-paid'))).toBe('Als bezahlt markieren');
      expect(text(q('demo-payment'))).toBe('Zahlung des Kunden simulieren');
      await openMenu();
      expect(text(inBody('menu-duplicate'))).toBe('Duplizieren');
      expect(text(inBody('menu-cancel'))).toBe('Rechnung stornieren');
    });

    it('Arabic: the dialogs are right to left, the day and the number left to right', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('inv-wd-044');
      q('mark-paid')!.click();
      await expectDialog(true);
      expect(dialog()!.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
      expect(inDialog('pay-date')!.getAttribute('dir')).toBe('ltr');
      expect(inDialog('pay-title')!.textContent).toContain('⁨RE-2026-044⁩');
      inDialog('pay-cancel')!.click();
      await expectDialog(false);

      await openMenu();
      inBody('menu-cancel')!.click();
      await expectDialog(true);
      expect(dialog()!.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
      expect(inDialog('cancel-title')!.textContent).toContain('⁨RE-2026-044⁩');
    });
  });
});
