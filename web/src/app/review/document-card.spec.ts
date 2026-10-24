import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Doc } from '../data/models';
import { reviewItems } from '../domain/review-queue';
import { DemoStateService } from '../state/demo-state.service';
import { ReviewService } from '../state/review.service';
import { type DocumentItem, DocumentCard } from './document-card';
import { SAVING_MS, TICK_MS } from './review-card';

describe('DocumentCard', () => {
  let demo: DemoStateService;
  let review: ReviewService;
  let fixture: ComponentFixture<DocumentCard>;
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

  /** The card of a document, as the page shows it: the document is made the current decision (the ones before it are skipped). */
  function show(id: string): void {
    for (let i = 0; i < 12 && review.current()?.id !== id; i++) review.skip();
    expect(review.current()?.id).toBe(id);
    fixture = TestBed.createComponent(DocumentCard);
    fixture.componentRef.setInput('item', review.current() as DocumentItem);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const doc = (id: string): Doc | undefined => demo.documents().find((d) => d.id === id);
  const queueLength = () => reviewItems(demo.business(), demo.setup()).length;
  /** The main answer is the filled button; the others are outlined. */
  const isMain = (node: HTMLElement | null | undefined) =>
    node?.className.split(/\s+/).includes('bg-primary') ?? false;
  const save = () => q('answer-save') as HTMLButtonElement;

  function click(node: HTMLElement | null): void {
    expect(node).not.toBeNull();
    node!.click();
    fixture.detectChanges();
  }

  /** Types into a field the way a person does. */
  function type(testId: string, value: string): void {
    const input = q(testId) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Lets time pass, then draws what the card made of it. */
  function play(ms: number): void {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  /**
   * `wd-d3` as a possible duplicate of `wd-d2`, which is the oldest decision then. A duplicate is a file that was added, so it is
   * not the document of an invoice written in Invoices (that one cannot be removed).
   */
  function makeDuplicate(extra: Partial<Doc> = {}): void {
    demo.updateDocument('wd-d3', (d) => ({ ...d, duplicateOf: 'wd-d2', invoice: null, ...extra }));
  }

  it('shows the paper with the unclear spot marked', () => {
    show('wd-d1');
    expect(q('document-paper')).not.toBeNull();
    expect(q('paper-missing')!.getAttribute('data-field')).toBe('amount');
    expect(q('card-amount')).toBeNull(); // the amount is not known
    expect(text(q('card-name'))).toBe('Bürobedarf Schulz');
  });

  describe('Check amount', () => {
    it('asks for the amount with a field and a Save that waits for a good amount', () => {
      show('wd-d1');

      expect(text(q('card-kind'))).toBe('Document · check the amount');
      expect(text(q('card-question'))).toBe("We couldn't read the amount.");
      expect(text(q('field-label'))).toBe('Amount');
      const field = q('field-amount') as HTMLInputElement;
      expect(field.getAttribute('inputmode')).toBe('decimal');
      expect(field.getAttribute('dir')).toBe('ltr');
      expect(save().hasAttribute('disabled')).toBe(true);
      expect(isMain(save())).toBe(true);
      expect(text(save())).toBe('Save');
    });

    it.each(['', '   ', 'abc', '0', '0,00', '-5', '12,3,4x'])(
      'Save stays disabled for "%s"',
      (typed) => {
        show('wd-d1');
        type('field-amount', typed);
        expect(save().hasAttribute('disabled')).toBe(true);
      },
    );

    it.each(['49,90', '49.90', ' 49,9 ', '€ 49,90'])('amount: %s saves 4990 cents', (typed) => {
      vi.useFakeTimers();
      show('wd-d1');
      type('field-amount', typed);
      expect(save().hasAttribute('disabled')).toBe(false);

      click(save());

      expect(doc('wd-d1')!.amountCents).toBe(4990);
      expect(doc('wd-d1')!.history[0].key).toBe('docEdited');
      expect(queueLength()).toBe(7);
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Amount saved');
      expect(review.lastAnswer()?.labelKey).toBe('review.result.amountSaved');
    });

    it('reads a thousands separator', () => {
      vi.useFakeTimers();
      show('wd-d1');
      type('field-amount', '1.234,50');
      click(save());
      expect(doc('wd-d1')!.amountCents).toBe(123450);
    });

    it('says what is wrong with an amount that was typed, and nothing before', () => {
      show('wd-d1');
      expect(q('field-error')).toBeNull();
      type('field-amount', 'abc');
      expect(text(q('field-error'))).toBe('Type an amount above 0, like 71.39.');
      expect(q('field-amount')!.getAttribute('aria-invalid')).toBe('true');
      type('field-amount', '49,90');
      expect(q('field-error')).toBeNull();
    });

    it('Enter in the field saves', () => {
      vi.useFakeTimers();
      show('wd-d1');
      type('field-amount', '49,90');
      (q('field-form') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
      expect(doc('wd-d1')!.amountCents).toBe(4990);
    });

    it('does not save an amount that is not good, even when the form is sent', () => {
      show('wd-d1');
      type('field-amount', 'abc');
      (q('field-form') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
      expect(doc('wd-d1')!.amountCents).toBeNull();
      expect(review.answered()).toBe(0);
    });
  });

  describe('Check date', () => {
    beforeEach(() => {
      demo.updateDocument('wd-d1', (d) => ({ ...d, amountCents: 1500, date: null }));
    });

    it('asks for the date with a date field', () => {
      show('wd-d1');
      expect(text(q('card-kind'))).toBe('Document · check the date');
      expect(text(q('card-question'))).toBe("We couldn't read the date.");
      expect(text(q('field-label'))).toBe('Date');
      expect(q('field-date')!.getAttribute('type')).toBe('date');
      expect(q('paper-missing')!.getAttribute('data-field')).toBe('date');
      expect(save().hasAttribute('disabled')).toBe(true);
    });

    it('saves the date once it is set', () => {
      vi.useFakeTimers();
      show('wd-d1');
      type('field-date', '2026-10-19');
      expect(save().hasAttribute('disabled')).toBe(false);

      click(save());

      expect(doc('wd-d1')!.date).toBe('2026-10-19');
      expect(doc('wd-d1')!.history[0].key).toBe('docEdited');
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Date saved');
    });

    it('does not save when the date is cleared again', () => {
      show('wd-d1');
      type('field-date', '2026-10-19');
      type('field-date', '');
      expect(save().hasAttribute('disabled')).toBe(true);
    });
  });

  describe('Check name', () => {
    beforeEach(() => {
      demo.updateDocument('wd-d1', (d) => ({ ...d, amountCents: 1500, name: null }));
    });

    it('asks for the name with a text field, in the text direction of what is typed', () => {
      show('wd-d1');
      expect(text(q('card-kind'))).toBe('Document · check the name');
      expect(text(q('card-question'))).toBe("We couldn't read the name.");
      expect(text(q('field-label'))).toBe('Name');
      expect(q('field-name')!.getAttribute('type')).toBe('text');
      expect(q('field-name')!.getAttribute('dir')).toBe('auto');
      expect(q('paper-missing')!.getAttribute('data-field')).toBe('name');
      expect(save().hasAttribute('disabled')).toBe(true);
    });

    it('Save waits for something that is not blank, then saves it without outer spaces', () => {
      vi.useFakeTimers();
      show('wd-d1');
      type('field-name', '   ');
      expect(save().hasAttribute('disabled')).toBe(true);
      type('field-name', '  Bürobedarf Schulz GmbH ');
      expect(save().hasAttribute('disabled')).toBe(false);

      click(save());

      expect(doc('wd-d1')!.name).toBe('Bürobedarf Schulz GmbH');
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Name saved');
    });
  });

  describe('Possible duplicate', () => {
    it('asks about the document it looks like, keeping both first', () => {
      makeDuplicate();
      show('wd-d3');

      expect(text(q('card-kind'))).toBe('Document · possible duplicate');
      expect(text(q('card-question'))).toBe('Looks like the one you added on 16 Oct.');
      expect(text(q('answer-keep'))).toBe('Keep both');
      expect(isMain(q('answer-keep'))).toBe(true);
      expect(text(q('answer-remove'))).toBe('Remove this one');
      expect(isMain(q('answer-remove'))).toBe(false);
      expect(q('field-form')).toBeNull();
    });

    it('says so when the document it looks like is gone', () => {
      makeDuplicate({ duplicateOf: 'wd-zz' });
      show('wd-d3');
      expect(text(q('card-question'))).toBe('Looks like a document you added before.');
    });

    it('duplicate: keep both', () => {
      vi.useFakeTimers();
      makeDuplicate();
      show('wd-d3');

      click(q('answer-keep'));

      expect(doc('wd-d3')).toBeDefined();
      expect(doc('wd-d3')!.duplicateOf).toBeNull();
      expect(doc('wd-d3')!.history[0].key).toBe('keptDuplicate');
      expect(review.summary().duplicatesRemoved).toBe(0);
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Kept both');
    });

    it('duplicate: remove this one, and the card still names it while it ticks', () => {
      vi.useFakeTimers();
      makeDuplicate();
      show('wd-d3');
      expect(queueLength()).toBe(9); // the eight decisions of the sample data, and this one

      click(q('answer-remove'));

      expect(doc('wd-d3')).toBeUndefined();
      expect(review.summary().duplicatesRemoved).toBe(1);
      expect(queueLength()).toBe(8);
      expect(text(q('card-name'))).toBe('Bäckerei Lange');
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Removed');
      expect(text(q('card-name'))).toBe('Bäckerei Lange');
    });

    it('cannot remove a document that is linked to a payment', () => {
      makeDuplicate({ paymentId: 'wd-t2' });
      show('wd-d3');
      expect(q('answer-keep')).not.toBeNull();
      expect(q('answer-remove')).toBeNull();
    });
  });

  describe('a card that is not the current decision any more', () => {
    it('answers nothing, and its tap does not land on the card that took its place', () => {
      vi.useFakeTimers();
      demo.updateDocument('wd-d2', (d) => ({ ...d, direction: null }));
      show('wd-d2');
      const before = doc('wd-d2');
      review.skip(); // wd-d2 goes to the end; another card is current, but this one is still on screen

      click(q('answer-received'));
      play(SAVING_MS + TICK_MS);

      expect(doc('wd-d2')).toEqual(before);
      expect(review.answered()).toBe(0);
      expect(review.canUndo()).toBe(false);
    });
  });

  describe('Received or sent?', () => {
    beforeEach(() => {
      demo.updateDocument('wd-d2', (d) => ({ ...d, direction: null }));
    });

    it('asks which it is, Received first', () => {
      show('wd-d2');
      expect(text(q('card-kind'))).toBe('Document · type unknown');
      expect(text(q('card-question'))).toBe('Is this a bill you received or an invoice you sent?');
      expect(text(q('answer-received'))).toBe('Received');
      expect(isMain(q('answer-received'))).toBe(true);
      expect(text(q('answer-sent'))).toBe('Sent');
      expect(isMain(q('answer-sent'))).toBe(false);
    });

    it('direction: received', () => {
      vi.useFakeTimers();
      show('wd-d2');

      click(q('answer-received'));

      expect(doc('wd-d2')!.direction).toBe('received');
      expect(doc('wd-d2')!.history[0].key).toBe('markedReceived');
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Marked as received');
    });

    it('direction: sent', () => {
      vi.useFakeTimers();
      show('wd-d2');

      click(q('answer-sent'));

      expect(doc('wd-d2')!.direction).toBe('sent');
      expect(doc('wd-d2')!.history[0].key).toBe('markedSent');
      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Marked as sent');
    });
  });

  it('the words follow the language', () => {
    TestBed.inject(LanguageService).setLang('de');
    show('wd-d1');
    expect(text(q('card-question'))).toBe('Wir konnten den Betrag nicht lesen.');
    expect(text(q('field-label'))).toBe('Betrag');
    expect(text(save())).toBe('Speichern');
  });

  it('an answer never moves off the review page', () => {
    vi.useFakeTimers();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    show('wd-d1');
    type('field-amount', '49,90');
    click(save());
    play(SAVING_MS + TICK_MS);
    expect(navigate).not.toHaveBeenCalled();
  });
});
