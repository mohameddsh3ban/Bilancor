import { formatDate, formatMoney } from '../core/format/format';
import type { Business, Invoice } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { invoiceText } from '../domain/invoice-texts';
import { FORMAL_REMINDER_DAYS, invoiceMail } from './invoice-mail';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const invoiceOf = (b: Business, id: string): Invoice => b.invoices.find((i) => i.id === id)!;

/** The business with a payment of `cents` on one of its invoices, so the invoice is part paid. */
function withPayment(b: Business, invoiceId: string, cents: number): Business {
  const part = { ...b.transactions.find((t) => t.amountCents > 0)!, id: 'part', amountCents: cents };
  return {
    ...b,
    transactions: [part, ...b.transactions],
    invoices: b.invoices.map((i) => (i.id === invoiceId ? { ...i, paymentIds: ['part'] } : i)),
  };
}

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

    it('keeps the wording that no payment was found for an invoice nobody paid anything on', () => {
      const mail = invoiceMail('reminder1', invoiceOf(weber, 'inv-wd-039'), weber);
      expect(mail.body).toContain('keinen Zahlungseingang feststellen');
      expect(mail.body).not.toContain('noch ein Betrag');
    });

    it('for a part-paid invoice names the whole invoice and what is left, and does not say nothing came in', () => {
      const partly = withPayment(weber, 'inv-wd-039', 30000); // 1.190,00 € with 300,00 € paid
      const mail = invoiceMail('reminder1', invoiceOf(partly, 'inv-wd-039'), partly);
      expect(mail.subject).toBe('Zahlungserinnerung zu Rechnung RE-2026-039');
      expect(mail.body).toBe(
        invoiceText('de', 'emailReminderBodyPartly', {
          name: 'Bäckerei Lange',
          number: 'RE-2026-039',
          total: formatMoney(119000, 'de'),
          left: formatMoney(89000, 'de'),
          date: formatDate('2026-09-30', 'de', { year: true }),
        }),
      );
      expect(mail.body).toContain(
        `zu unserer Rechnung RE-2026-039 über ${formatMoney(119000, 'de')} ist noch ein Betrag von ${formatMoney(89000, 'de')} offen.`,
      );
      expect(mail.body).not.toContain('keinen Zahlungseingang');
    });

    it('is written the same way in English', () => {
      const partly = withPayment(weber, 'inv-wd-039', 30000);
      const english = { ...invoiceOf(partly, 'inv-wd-039'), language: 'en' as const };
      const mail = invoiceMail('reminder1', english, partly);
      expect(mail.body).toContain(
        `for our invoice RE-2026-039 for ${formatMoney(119000, 'en')}, an amount of ${formatMoney(89000, 'en')} is still open.`,
      );
      expect(mail.body).not.toContain('not yet received payment');
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
      expect(mail.body).not.toContain('noch ein Betrag');
    });

    it('the new date is FORMAL_REMINDER_DAYS (7) days from today', () => {
      expect(FORMAL_REMINDER_DAYS).toBe(7);
      const mail = invoiceMail('reminder2', invoiceOf(cafe, 'inv-cl-053'), cafe, '2026-11-02');
      expect(mail.body).toContain(formatDate('2026-11-09', 'de', { year: true }));
    });

    it('for a part-paid invoice names the whole invoice and what is left', () => {
      const partly = withPayment(cafe, 'inv-cl-053', 30000); // 1.285,20 € with 300,00 € paid
      const mail = invoiceMail('reminder2', invoiceOf(partly, 'inv-cl-053'), partly);
      expect(mail.subject).toBe('Mahnung zu Rechnung RE-2026-053');
      expect(mail.body).toBe(
        invoiceText('de', 'emailFormalBodyPartly', {
          name: 'Kanzlei Hoffmann',
          number: 'RE-2026-053',
          total: formatMoney(128520, 'de'),
          left: formatMoney(98520, 'de'),
          date: formatDate('2026-10-29', 'de', { year: true }),
        }),
      );
      expect(mail.body).toContain(
        `ist von der Rechnung RE-2026-053 über ${formatMoney(128520, 'de')} noch ein Betrag von ${formatMoney(98520, 'de')} offen.`,
      );
      expect(mail.body).toContain('Verzugszinsen');
    });

    it('is written the same way in English', () => {
      const partly = withPayment(cafe, 'inv-cl-053', 30000);
      const english = { ...invoiceOf(partly, 'inv-cl-053'), language: 'en' as const };
      const mail = invoiceMail('reminder2', english, partly);
      expect(mail.body).toContain(
        `${formatMoney(98520, 'en')} of invoice RE-2026-053 for ${formatMoney(128520, 'en')} is still unpaid.`,
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
