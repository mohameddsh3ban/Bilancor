import { formatDate, formatMoney } from '../core/format/format';
import type { Business, Invoice } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { invoiceText } from '../domain/invoice-texts';
import { invoiceMail } from './invoice-mail';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const invoiceOf = (b: Business, id: string): Invoice => b.invoices.find((i) => i.id === id)!;

describe('invoiceMail', () => {
  const weber = business('weber-design');
  const cafe = business('cafe-linde');

  describe('the invoice itself', () => {
    it('goes to the customer, with the number it will be given, in the invoice language', () => {
      const mail = invoiceMail('invoice', invoiceOf(weber, 'inv-wd-draft'), weber);
      expect(mail.to).toBe('rechnungseingang@bezirksamt-pankow.example');
      expect(mail.number).toBe('RE-2026-045');
      expect(mail.subject).toBe('Rechnung RE-2026-045');
      expect(mail.body).toBe(
        invoiceText('de', 'emailInvoiceBody', {
          name: 'Bezirksamt Pankow',
          number: 'RE-2026-045',
          amount: formatMoney(416500, 'de'),
          date: formatDate('2026-11-05', 'de', { year: true }),
        }),
      );
      expect(mail.body).toContain('Guten Tag Bezirksamt Pankow');
      expect(mail.lang).toBe('de');
    });

    it('is written in English for an English invoice, with the amount and date as an English reader writes them', () => {
      const draft = { ...invoiceOf(weber, 'inv-wd-draft'), language: 'en' as const };
      const mail = invoiceMail('invoice', draft, weber);
      expect(mail.subject).toBe('Invoice RE-2026-045');
      expect(mail.body).toContain('Hello Bezirksamt Pankow');
      expect(mail.body).toContain(formatMoney(416500, 'en'));
      expect(mail.body).toContain(formatDate('2026-11-05', 'en', { year: true }));
      expect(mail.lang).toBe('en');
    });

    it('asks for the whole amount', () => {
      const mail = invoiceMail('invoice', invoiceOf(weber, 'inv-wd-draft'), weber);
      expect(mail.body).toContain(formatMoney(416500, 'de'));
    });
  });

  describe('the friendly reminder', () => {
    it('is for the invoice that is overdue, names the day it was due and what is still to pay', () => {
      const mail = invoiceMail('reminder1', invoiceOf(weber, 'inv-wd-039'), weber);
      expect(mail.to).toBe('info@baeckerei-lange.example');
      expect(mail.number).toBe('RE-2026-039');
      expect(mail.subject).toBe('Zahlungserinnerung zu Rechnung RE-2026-039');
      expect(mail.body).toBe(
        invoiceText('de', 'emailReminderBody', {
          name: 'Bäckerei Lange',
          number: 'RE-2026-039',
          amount: formatMoney(119000, 'de'),
          date: formatDate('2026-09-30', 'de', { year: true }),
        }),
      );
    });

    it('asks for what is left when part of the invoice was paid', () => {
      const lange = invoiceOf(weber, 'inv-wd-039');
      const part = {
        ...weber.transactions.find((t) => t.amountCents > 0)!,
        id: 'part',
        amountCents: 30000,
      };
      const partly: Business = {
        ...weber,
        transactions: [part, ...weber.transactions],
        invoices: weber.invoices.map((i) =>
          i.id === lange.id ? { ...i, paymentIds: ['part'] } : i,
        ),
      };
      const mail = invoiceMail('reminder1', invoiceOf(partly, 'inv-wd-039'), partly);
      expect(mail.body).toContain(formatMoney(89000, 'de'));
      expect(mail.body).not.toContain(formatMoney(119000, 'de'));
    });
  });

  describe('the formal reminder', () => {
    it('is the Mahnung, and gives a new date: a week from today', () => {
      const mail = invoiceMail('reminder2', invoiceOf(cafe, 'inv-cl-053'), cafe);
      expect(mail.to).toBe('sekretariat@kanzlei-hoffmann.example');
      expect(mail.subject).toBe('Mahnung zu Rechnung RE-2026-053');
      expect(mail.body).toBe(
        invoiceText('de', 'emailFormalBody', {
          name: 'Kanzlei Hoffmann',
          number: 'RE-2026-053',
          amount: formatMoney(128520, 'de'),
          date: formatDate('2026-10-29', 'de', { year: true }),
        }),
      );
    });
  });

  describe('the file that goes with it', () => {
    it('a business customer in Germany gets ZUGFeRD, a public office an XRechnung', () => {
      expect(invoiceMail('reminder1', invoiceOf(weber, 'inv-wd-039'), weber).format).toBe(
        'zugferd',
      );
      expect(invoiceMail('invoice', invoiceOf(weber, 'inv-wd-draft'), weber).format).toBe(
        'xrechnung',
      );
    });

    it('a Kleinunternehmer sends a plain PDF', () => {
      const sara = business('sara-yoga');
      expect(invoiceMail('invoice', invoiceOf(sara, 'inv-sy-021'), sara).format).toBe('pdf');
    });

    it('a sent invoice keeps the format it went out in, whatever the tax details say now', () => {
      const lange = invoiceOf(weber, 'inv-wd-039');
      const kleinNow: Business = {
        ...weber,
        taxProfile: { ...weber.taxProfile, kleinunternehmer: true },
      };
      expect(invoiceMail('reminder1', lange, kleinNow).format).toBe('zugferd');
    });
  });
});
