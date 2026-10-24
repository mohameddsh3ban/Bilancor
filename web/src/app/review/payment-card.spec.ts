import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { OFFICE, PRIVATE_OUT, REVENUE_19, SUPPLIES, TRAVEL } from '../data/categories';
import type { Transaction } from '../data/models';
import { READING_MS } from '../domain/document-upload';
import { invoiceStatus, owedSummary } from '../domain/invoices';
import { reviewItems } from '../domain/review-queue';
import { DemoStateService } from '../state/demo-state.service';
import { ReceiptService } from '../state/receipt.service';
import { ReviewService } from '../state/review.service';
import { UploadService } from '../state/upload.service';
import { type PaymentItem, PaymentCard } from './payment-card';
import { SAVING_MS, TICK_MS, TICK_NOTE_MS } from './review-card';

describe('PaymentCard', () => {
  let demo: DemoStateService;
  let review: ReviewService;
  let fixture: ComponentFixture<PaymentCard>;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
    review = TestBed.inject(ReviewService);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** The card of a payment, as the page shows it: the payment is made the current decision (the ones before it are skipped). */
  function show(id: string): void {
    for (let i = 0; i < 12 && review.current()?.id !== id; i++) review.skip();
    expect(review.current()?.id).toBe(id);
    fixture = TestBed.createComponent(PaymentCard);
    fixture.componentRef.setInput('item', review.current() as PaymentItem);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const all = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const tx = (id: string): Transaction => demo.business().transactions.find((t) => t.id === id)!;
  const queueLength = () => reviewItems(demo.business(), demo.setup()).length;
  /** The main answer is the filled button; the others are outlined. */
  const isMain = (node: HTMLElement | null | undefined) =>
    node?.className.split(/\s+/).includes('bg-primary') ?? false;

  function click(node: HTMLElement | null): void {
    expect(node).not.toBeNull();
    node!.click();
    fixture.detectChanges();
  }

  /** Lets time pass, then draws what the card made of it. */
  function play(ms: number): void {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** What a picker lists is in an overlay outside the card, so it is read from the document. */
  const inBody = (testId: string) =>
    Array.from(document.body.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const optionStartingWith = (start: string) =>
    inBody('category-option').find((option) => text(option).startsWith(start))!;

  describe('Unclear', () => {
    it('asks what the payment was for and offers its three categories, the likeliest as the main button', () => {
      show('wd-t4');

      expect(text(q('card-kind'))).toBe('Payment · not sorted yet');
      expect(text(q('card-question'))).toBe('What was this for?');
      const suggestions = all('answer-suggestion');
      expect(suggestions.map(text)).toEqual([
        'Office supplies',
        'Software & maintenance',
        'Other business costs',
      ]);
      expect(suggestions.map(isMain)).toEqual([true, false, false]);
      expect(text(q('change-category'))).toBe('Other category…');
      expect(isMain(q('change-category'))).toBe(false);
    });

    it('unclear Amazon: choosing a suggestion books it, learns, and books wd-t18 too', () => {
      vi.useFakeTimers();
      show('wd-t4'); // wd-t18, the older Amazon payment, is skipped
      expect(queueLength()).toBe(8);

      click(all('answer-suggestion')[0]);

      // The answered payment is booked and confirmed, and so is the other unclear Amazon payment.
      expect(tx('wd-t4')).toMatchObject({ booking: OFFICE, confirmed: true });
      expect(tx('wd-t4').history[0].key).toBe('categoryChanged');
      expect(tx('wd-t18')).toMatchObject({ booking: OFFICE, confirmed: true });
      expect(tx('wd-t18').history[0]).toMatchObject({
        key: 'bookedByRule',
        params: { category: 'office' },
      });
      expect(demo.business().categoryRules).toEqual([
        { counterpartyKey: 'amazon', booking: OFFICE },
      ]);
      // Both leave the queue: one answer, two fewer decisions.
      expect(queueLength()).toBe(6);
      expect(review.answered()).toBe(1);
      expect(review.lastAnswer()).toMatchObject({
        labelKey: 'review.result.booked',
        learnedBookedCount: 1,
      });

      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Booked');
      expect(all('tick-note').map(text)).toEqual([
        'Got it — Amazon will be booked as Office supplies automatically from now on.',
        '…and 1 more Amazon payment booked.',
      ]);
      expect(text(q('card-tick'))).toContain('and 1 more');
    });

    it('says how many more when the rule books several', () => {
      vi.useFakeTimers();
      // Two more unclear Amazon payments, besides wd-t18.
      const more = demo.snapshot();
      const base = more.transactions.find((t) => t.id === 'wd-t18')!;
      for (const id of ['wd-x1', 'wd-x2']) more.transactions.push({ ...base, id });
      demo.restore(more);
      show('wd-t4');

      click(all('answer-suggestion')[0]);

      play(SAVING_MS);
      expect(all('tick-note').map(text)[1]).toBe('…and 3 more Amazon payments booked.');
      expect(review.lastAnswer()?.learnedBookedCount).toBe(3);
    });

    it('learns without a second line when there is no other unclear payment of that name', () => {
      vi.useFakeTimers();
      demo.setBusiness('sara-yoga');
      show('sy-t7');

      click(all('answer-suggestion')[0]);

      expect(tx('sy-t7')).toMatchObject({ booking: SUPPLIES, confirmed: true });
      expect(demo.business().categoryRules).toEqual([
        { counterpartyKey: 'decathlon berlin', booking: SUPPLIES },
      ]);
      play(SAVING_MS);
      expect(all('tick-note').map(text)).toEqual([
        'Got it — Decathlon Berlin will be booked as Supplies automatically from now on.',
      ]);
      expect(review.lastAnswer()?.learnedBookedCount).toBe(0);
    });

    it('holds the tick longer so the message can be read', () => {
      vi.useFakeTimers();
      show('wd-t4');
      click(all('answer-suggestion')[0]);
      play(SAVING_MS + TICK_MS);
      expect(q('card-tick')).not.toBeNull();
      play(TICK_NOTE_MS - TICK_MS);
      expect(q('card-tick')).toBeNull();
    });

    it('Other category… picks a category from the list and learns it like a suggestion', async () => {
      show('wd-t4');
      click(q('change-category'));
      await settle();

      const option = optionStartingWith('Travel');
      expect(option).toBeDefined();
      vi.useFakeTimers();
      option.click();
      fixture.detectChanges();

      expect(tx('wd-t4')).toMatchObject({ booking: TRAVEL, confirmed: true });
      expect(demo.business().categoryRules).toEqual([
        { counterpartyKey: 'amazon', booking: TRAVEL },
      ]);
      expect(tx('wd-t18')).toMatchObject({ booking: TRAVEL, confirmed: true });
      expect(review.lastAnswer()?.labelKey).toBe('review.result.booked');
      play(SAVING_MS);
      expect(text(q('card-tick'))).toContain('and 1 more');
    });

    it('makes no rule when the name has nothing to match on, and books nothing else', () => {
      vi.useFakeTimers();
      demo.updateTransaction('wd-t4', (t) => ({ ...t, counterparty: '...' }));
      show('wd-t4');

      click(all('answer-suggestion')[0]);

      expect(tx('wd-t4')).toMatchObject({ booking: OFFICE, confirmed: true });
      expect(demo.business().categoryRules).toEqual([]);
      expect(tx('wd-t18').booking).toBeNull();
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Booked');
      expect(all('tick-note')).toHaveLength(0);
    });

    it('private is offered only without a linked document', () => {
      show('wd-t4');
      // Every sample payment that is unclear has its receipt, so there is no Private yet.
      expect(demo.business().documents.some((d) => d.paymentId === 'wd-t4')).toBe(true);
      expect(q('answer-private')).toBeNull();

      demo.unlink('doc-wd-t4');
      fixture.detectChanges();

      expect(q('answer-private')).not.toBeNull();
      expect(text(q('answer-private'))).toBe('Private, not for the business');
    });

    it('private is not offered for a payment that pays an invoice', () => {
      // wd-t1 pays RE-2026-041; it is made unclear and without a document, so only the invoice is left to say no
      demo.updateDocument('doc-wd-t1', (d) => ({ ...d, paymentId: null }));
      demo.updateTransaction('wd-t1', (t) => ({ ...t, booking: null, confirmed: false }));
      show('wd-t1');
      expect(text(q('card-kind'))).toBe('Payment · not sorted yet');
      expect(q('answer-private')).toBeNull();
    });

    it('Private marks the payment private and makes no rule', () => {
      vi.useFakeTimers();
      demo.unlink('doc-wd-t4');
      show('wd-t4');

      click(q('answer-private'));

      expect(tx('wd-t4')).toMatchObject({
        isPrivate: true,
        booking: PRIVATE_OUT,
        confirmed: true,
        receipt: 'notNeeded',
      });
      expect(demo.business().categoryRules).toEqual([]);
      expect(tx('wd-t18').booking).toBeNull(); // the other Amazon payment is left alone
      expect(review.lastAnswer()?.labelKey).toBe('review.result.private');
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Marked as private');
      expect(all('tick-note')).toHaveLength(0);
    });

    it('offers only Other category… when the payment has no suggestions', () => {
      demo.updateTransaction('wd-t4', (t) => ({ ...t, suggestions: undefined }));
      show('wd-t4');
      expect(all('answer-suggestion')).toHaveLength(0);
      expect(q('change-category')).not.toBeNull();
    });

    it('a Kleinunternehmer is only offered the categories that fit the business', () => {
      demo.setBusiness('sara-yoga');
      show('sy-t7');
      expect(all('answer-suggestion').map(text)).toEqual(['Supplies', 'Other business costs']);
    });
  });

  describe('a card that is not the current decision any more', () => {
    it('answers nothing, and its tap does not land on the card that took its place', () => {
      vi.useFakeTimers();
      show('wd-t4');
      const before = tx('wd-t4');
      review.skip(); // wd-t4 goes to the end; another card is current, but this one is still on screen

      click(all('answer-suggestion')[0]);
      play(SAVING_MS + TICK_MS);

      expect(tx('wd-t4')).toEqual(before);
      expect(review.answered()).toBe(0);
      expect(review.canUndo()).toBe(false);
      expect(queueLength()).toBe(8);
    });
  });

  describe('Confirm', () => {
    it('confirm card confirms', () => {
      vi.useFakeTimers();
      show('wd-t1');

      expect(text(q('card-kind'))).toBe('Payment · please confirm');
      expect(text(q('card-question'))).toBe('We booked this as Revenue (19% VAT). Is that right?');
      expect(text(q('answer-confirm'))).toBe("Yes, that's right");
      expect(isMain(q('answer-confirm'))).toBe(true);
      expect(text(q('change-category'))).toBe('Change category');
      expect(isMain(q('change-category'))).toBe(false);

      click(q('answer-confirm'));

      expect(tx('wd-t1')).toMatchObject({ booking: REVENUE_19, confirmed: true });
      expect(tx('wd-t1').history[0].key).toBe('confirmed');
      expect(demo.business().categoryRules).toEqual([]);
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Confirmed');
    });

    it('Change category picks another one, without making a rule', async () => {
      show('wd-t1');
      click(q('change-category'));
      await settle();

      const option = optionStartingWith('Revenue (7% VAT)');
      vi.useFakeTimers();
      option.click();
      fixture.detectChanges();

      expect(tx('wd-t1').booking?.labelKey).toBe('revenue7');
      expect(tx('wd-t1').confirmed).toBe(true);
      expect(tx('wd-t1').history[0].key).toBe('categoryChanged');
      expect(demo.business().categoryRules).toEqual([]);
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Category changed');
      expect(all('tick-note')).toHaveLength(0);
    });

    it('Change category on a payment with a self-issued receipt keeps its VAT at 0 %', async () => {
      demo.updateTransaction('wd-t20', (t) => ({ ...t, confirmed: false })); // the booking still waits to be confirmed
      TestBed.inject(ReceiptService).createSelfIssued('wd-t20', { purpose: 'Parking', reason: 'machine', reasonText: null, address: null }, 'payment');
      show('wd-t20');
      expect(text(q('card-kind'))).toBe('Payment · please confirm');
      click(q('change-category'));
      await settle();

      const option = optionStartingWith('Office supplies');
      vi.useFakeTimers();
      option.click();
      fixture.detectChanges();

      expect(tx('wd-t20').booking).toEqual({ ...OFFICE, vatRate: 0 });
      expect(tx('wd-t20').confirmed).toBe(true);
      expect(tx('wd-t20').history[0].key).toBe('categoryChanged');
    });

    it('choosing the category it already has counts as yes', async () => {
      show('wd-t1');
      click(q('change-category'));
      await settle();

      const option = optionStartingWith('Revenue (19% VAT)');
      vi.useFakeTimers();
      option.click();
      fixture.detectChanges();

      expect(tx('wd-t1')).toMatchObject({ booking: REVENUE_19, confirmed: true });
      expect(tx('wd-t1').history[0].key).toBe('confirmed');
      expect(review.lastAnswer()?.labelKey).toBe('review.result.confirmed');
    });
  });

  describe('Receipt missing', () => {
    it('asks for a receipt with three answers, taking a photo first', () => {
      show('wd-t3');

      expect(text(q('card-kind'))).toBe('Payment · receipt missing');
      expect(text(q('card-question'))).toBe("There's no receipt for this payment yet.");
      expect(text(q('answer-photo'))).toBe('Take a photo');
      expect(isMain(q('answer-photo'))).toBe(true);
      expect(text(q('pick-document'))).toBe('Pick from Documents');
      expect(isMain(q('pick-document'))).toBe(false);
      expect(text(q('answer-no-receipt'))).toBe('No receipt needed');
      expect(isMain(q('answer-no-receipt'))).toBe(false);
    });

    it('no receipt needed', () => {
      vi.useFakeTimers();
      show('wd-t3');

      click(q('answer-no-receipt'));

      expect(tx('wd-t3').receipt).toBe('notNeeded');
      expect(tx('wd-t3').history[0].key).toBe('receiptNotNeeded');
      expect(review.summary().receiptsAdded).toBe(0);
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Marked: no receipt needed');
    });

    it('pick from documents links wd-d4 to wd-t17', async () => {
      show('wd-t17');
      click(q('pick-document'));
      await settle();

      const options = inBody('document-picker-option');
      expect(text(options[0])).toContain('Böttcher Bürobedarf');
      vi.useFakeTimers();
      options[0].click();
      fixture.detectChanges();

      const doc = demo.documents().find((d) => d.id === 'wd-d4')!;
      expect(doc.paymentId).toBe('wd-t17');
      expect(tx('wd-t17')).toMatchObject({ receipt: 'attached', receiptFile: doc.fileName });
      expect(review.summary().receiptsAdded).toBe(1);
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Receipt added');
    });

    it("picking Studio Kern's document for the Kern payment pays the invoice", async () => {
      show('wd-t19');
      click(q('pick-document'));
      await settle();

      const options = inBody('document-picker-option');
      expect(text(options[0])).toContain('Studio Kern');
      vi.useFakeTimers();
      options[0].click();
      fixture.detectChanges();

      const invoice = demo.business().invoices.find((i) => i.id === 'inv-wd-044')!;
      expect(invoice.paymentIds).toEqual(['wd-t19']);
      expect(tx('wd-t19')).toMatchObject({ receipt: 'attached', receiptFile: 'RE-2026-044.pdf' });
      expect(tx('wd-t19').history[0].key).toBe('paysInvoice');
      expect(demo.documents().find((d) => d.id === 'wd-d2')!.paymentId).toBe('wd-t19');
      expect(review.summary().receiptsAdded).toBe(1);
    });

    describe('Is this the payment for an invoice?', () => {
      const owedCents = () => owedSummary(demo.business(), demo.setup()).owedCents;
      const invoice = () => demo.business().invoices.find((i) => i.id === 'inv-wd-044')!;

      it("weber's inbox asks whether the Kern payment pays RE-2026-044; Yes pays it and owed drops to €1,190.00", () => {
        vi.useFakeTimers();
        show('wd-t19');

        expect(text(q('card-kind'))).toBe('Payment · receipt missing');
        expect(text(q('card-question'))).toBe(
          'Is this the payment for invoice RE-2026-044 from Studio Kern?',
        );
        expect(text(q('answer-invoice-yes'))).toBe('Yes');
        expect(isMain(q('answer-invoice-yes'))).toBe(true);
        expect(text(q('pick-document'))).toBe('Pick another');
        expect(isMain(q('pick-document'))).toBe(false);
        expect(text(q('answer-no-receipt'))).toBe('No receipt needed');
        expect(isMain(q('answer-no-receipt'))).toBe(false);
        expect(q('answer-photo')).toBeNull();
        expect(owedCents()).toBe(357000);
        expect(invoiceStatus(invoice(), demo.business())).toBe('open');
        const waiting = queueLength();

        click(q('answer-invoice-yes'));

        expect(invoice().paymentIds).toEqual(['wd-t19']);
        expect(invoiceStatus(invoice(), demo.business())).toBe('paid');
        expect(tx('wd-t19')).toMatchObject({ receipt: 'attached', receiptFile: 'RE-2026-044.pdf' });
        expect(tx('wd-t19').history[0].key).toBe('paysInvoice');
        expect(owedCents()).toBe(119000);
        // One answer, one decision less; the invoice's document is the payment's receipt.
        expect(queueLength()).toBe(waiting - 1);
        expect(review.answered()).toBe(1);
        expect(review.summary().receiptsAdded).toBe(1);
        expect(review.lastAnswer()?.labelKey).toBe('review.result.invoicePaid');
        play(SAVING_MS);
        expect(text(q('tick-text'))).toBe('Invoice paid');
      });

      it("keeps the invoice question and its answers while the result shows, and after Undo they are still there", () => {
        vi.useFakeTimers();
        show('wd-t19');
        const question = 'Is this the payment for invoice RE-2026-044 from Studio Kern?';
        const stillAsksAboutTheInvoice = () => {
          expect(text(q('card-question'))).toBe(question);
          expect(text(q('answer-invoice-yes'))).toBe('Yes');
          expect(text(q('pick-document'))).toBe('Pick another');
          expect(text(q('answer-no-receipt'))).toBe('No receipt needed');
          expect(q('answer-photo')).toBeNull();
        };

        click(q('answer-invoice-yes'));

        // The payment pays the invoice now, so it fits no open invoice any more: the card must not notice.
        expect(owedCents()).toBe(119000);
        stillAsksAboutTheInvoice();
        play(SAVING_MS);
        expect(text(q('tick-text'))).toBe('Invoice paid');
        stillAsksAboutTheInvoice();

        review.undo();
        fixture.detectChanges();

        expect(owedCents()).toBe(357000);
        stillAsksAboutTheInvoice();
      });

      it('keeps the invoice question after the other answers too', async () => {
        const question = 'Is this the payment for invoice RE-2026-044 from Studio Kern?';
        show('wd-t19');
        click(q('pick-document'));
        await settle();
        vi.useFakeTimers();
        inBody('document-picker-option')[0].click();
        fixture.detectChanges();
        play(SAVING_MS);
        expect(invoice().paymentIds).toEqual(['wd-t19']);
        expect(text(q('card-question'))).toBe(question);
        expect(text(q('pick-document'))).toBe('Pick another');
        expect(q('answer-photo')).toBeNull();

        vi.useRealTimers();
        demo.resetData();
        show('wd-t19');
        vi.useFakeTimers();
        click(q('answer-no-receipt'));
        play(SAVING_MS);
        expect(tx('wd-t19').receipt).toBe('notNeeded');
        expect(text(q('card-question'))).toBe(question);
        expect(q('answer-photo')).toBeNull();
      });

      it('Undo takes the payment off the invoice again', () => {
        vi.useFakeTimers();
        show('wd-t19');
        click(q('answer-invoice-yes'));
        expect(owedCents()).toBe(119000);

        review.undo();

        expect(invoice().paymentIds).toEqual([]);
        expect(tx('wd-t19').receipt).toBe('missing');
        expect(owedCents()).toBe(357000);
      });

      it('pick another and no receipt still work', async () => {
        show('wd-t19');
        expect(text(q('pick-document'))).toBe('Pick another');
        click(q('pick-document'));
        await settle();
        const options = inBody('document-picker-option');
        expect(text(options[0])).toContain('Studio Kern');
        vi.useFakeTimers();
        options[0].click(); // the invoice's own document: picking it pays the invoice as well
        fixture.detectChanges();
        expect(invoice().paymentIds).toEqual(['wd-t19']);
        expect(owedCents()).toBe(119000);
        expect(review.lastAnswer()?.labelKey).toBe('review.result.receiptAdded');
        expect(review.summary().receiptsAdded).toBe(1);

        // From the start again: No receipt needed leaves the invoice unpaid.
        demo.resetData();
        show('wd-t19');
        click(q('answer-no-receipt'));
        expect(tx('wd-t19').receipt).toBe('notNeeded');
        expect(invoice().paymentIds).toEqual([]);
        expect(owedCents()).toBe(357000);
        expect(review.lastAnswer()?.labelKey).toBe('review.result.noReceipt');
      });

      it('asks the ordinary receipt question when the reference names the invoice', () => {
        // A reference with the number means the system is certain: there is nothing to ask about the invoice.
        demo.updateTransaction('wd-t19', (t) => ({ ...t, reference: 'RE-2026-044' }));
        show('wd-t19');
        expect(text(q('card-question'))).toBe("There's no receipt for this payment yet.");
        expect(text(q('pick-document'))).toBe('Pick from Documents');
        expect(q('answer-invoice-yes')).toBeNull();
        expect(isMain(q('answer-photo'))).toBe(true);
      });

      it('asks the ordinary receipt question for a payment that fits no invoice', () => {
        demo.updateTransaction('wd-t19', (t) => ({ ...t, amountCents: 238100 }));
        show('wd-t19');
        expect(text(q('card-question'))).toBe("There's no receipt for this payment yet.");
        expect(q('answer-invoice-yes')).toBeNull();
      });

      it('the words follow the language', () => {
        TestBed.inject(LanguageService).setLang('de');
        show('wd-t19');
        expect(text(q('card-question'))).toBe('Ist das die Zahlung für Rechnung RE-2026-044 an Studio Kern?');
        expect(text(q('answer-invoice-yes'))).toBe('Ja');
        expect(text(q('pick-document'))).toBe('Andere wählen');
      });

      it('in Arabic the number and the name are set apart in the sentence', () => {
        TestBed.inject(LanguageService).setLang('ar');
        show('wd-t19');
        expect(text(q('card-question'))).toContain('⁨RE-2026-044⁩');
        expect(text(q('card-question'))).toContain('⁨Studio Kern⁩');
      });
    });

    it('does not offer to add a document when none fits: that would leave the review', async () => {
      demo.updateDocument('wd-d1', (d) => ({ ...d, paymentId: 'wd-t2' }));
      demo.updateDocument('wd-d4', (d) => ({ ...d, paymentId: 'wd-t2' }));
      demo.updateDocument('wd-d8', (d) => ({ ...d, paymentId: 'wd-t2' }));
      show('wd-t17');
      click(q('pick-document'));
      await settle();

      expect(inBody('document-picker-empty')).toHaveLength(1);
      expect(inBody('document-picker-add')).toHaveLength(0);
    });

    describe('take a photo', () => {
      it('take a photo shows Reading… then moves on', async () => {
        vi.useFakeTimers();
        show('wd-t3');
        expect(text(q('answer-photo'))).toBe('Take a photo');

        click(q('answer-photo'));

        // While the photo is read: Reading…, nothing recorded, no tick yet.
        expect(review.pending()).toBe(true);
        expect(text(q('answer-photo'))).toBe('Reading…');
        expect(q('answer-photo')!.hasAttribute('disabled')).toBe(true);
        expect(q('card-tick')).toBeNull();
        expect(review.answered()).toBe(0);
        expect(tx('wd-t3').receipt).toBe('missing');

        await vi.advanceTimersByTimeAsync(READING_MS);
        fixture.detectChanges();

        // The photo is a receipt made from the payment, linked to it; the answer is recorded and ticks.
        expect(review.pending()).toBe(false);
        const photo = demo.documents().find((d) => d.paymentId === 'wd-t3' && d.source === 'photo');
        expect(photo).toBeDefined();
        expect(tx('wd-t3')).toMatchObject({ receipt: 'attached', receiptFile: photo!.fileName });
        expect(review.summary().receiptsAdded).toBe(1);
        expect(review.lastAnswer()?.labelKey).toBe('review.result.receiptAdded');
        expect(text(q('card-tick'))).toContain('Saving');
        play(SAVING_MS);
        expect(text(q('tick-text'))).toBe('Receipt added');
      });

      it('a photo that is dropped records nothing and leaves the card as it was', async () => {
        vi.useFakeTimers();
        show('wd-t3');
        click(q('answer-photo'));
        expect(review.pending()).toBe(true);

        demo.resetData(); // the photo is taken away while it is being read
        await vi.advanceTimersByTimeAsync(READING_MS + SAVING_MS + TICK_MS);
        fixture.detectChanges();

        expect(review.pending()).toBe(false);
        expect(review.answered()).toBe(0);
        expect(review.lastAnswer()).toBeNull();
        expect(q('card-tick')).toBeNull();
        expect(text(q('answer-photo'))).toBe('Take a photo');
        expect(q('answer-photo')!.hasAttribute('disabled')).toBe(false);
      });

      it('a photo for a payment that got its receipt meanwhile records nothing', async () => {
        vi.useFakeTimers();
        show('wd-t3');
        click(q('answer-photo'));

        demo.link('wd-d4', 'wd-t3'); // the receipt came from somewhere else while the photo was read
        await vi.advanceTimersByTimeAsync(READING_MS + SAVING_MS + TICK_MS);
        fixture.detectChanges();

        expect(review.pending()).toBe(false);
        expect(review.answered()).toBe(0);
        expect(review.summary().receiptsAdded).toBe(0);
        expect(review.lastAnswer()).toBeNull();
        expect(q('card-tick')).toBeNull();
        // The photo stays as a document of its own, not linked to anything.
        const photo = demo.documents().find((d) => d.source === 'photo');
        expect(photo?.paymentId).toBeNull();
      });

      it('shows Reading… also when the photo was taken elsewhere', async () => {
        vi.useFakeTimers();
        show('wd-t3');
        void TestBed.inject(UploadService).addPhotoFor('wd-t3');
        fixture.detectChanges();

        expect(text(q('answer-photo'))).toBe('Reading…');
        expect(q('answer-photo')!.hasAttribute('disabled')).toBe(true);
        await vi.advanceTimersByTimeAsync(READING_MS);
      });
    });
  });

  it('the words follow the language', () => {
    TestBed.inject(LanguageService).setLang('de');
    show('wd-t1');
    expect(text(q('card-question'))).toBe(
      'Wir haben das als Einnahmen (19 % USt) gebucht. Stimmt das?',
    );
    expect(text(q('answer-confirm'))).toBe('Ja, stimmt');
    expect(text(q('change-category'))).toBe('Kategorie ändern');
  });

  it('an answer never moves off the review page', () => {
    vi.useFakeTimers();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    show('wd-t1');
    click(q('answer-confirm'));
    play(SAVING_MS + TICK_MS);
    expect(navigate).not.toHaveBeenCalled();
  });
});
