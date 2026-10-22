import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { OFFICE } from '../data/categories';
import type { Transaction } from '../data/models';
import type { ReviewItem } from '../domain/review-queue';
import { changeCategory, confirmBooking, markNoReceiptNeeded } from '../domain/payment-actions';
import { paymentStatus } from '../domain/payment-status';
import { DemoStateService } from './demo-state.service';
import { ReviewService, UNDO_MS } from './review.service';

const ANSWER = { labelKey: 'review.answered.booked' };
const WEBER_ORDER = ['wd-t18', 'wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1'];

describe('ReviewService', () => {
  let demo: DemoStateService;
  let review: ReviewService;

  const payment = (id: string): Transaction =>
    demo.business().transactions.find((t) => t.id === id)!;
  const currentId = (): string | undefined => review.current()?.id;

  /** Answers the current card the way the page does: the change to the data happens inside `apply`. */
  const fix = (id: string, change: (tx: Transaction) => Transaction, result = ANSWER): void =>
    review.answer(() => demo.updateTransaction(id, change), result);
  const categorise = (id: string): void => fix(id, (tx) => changeCategory(tx, OFFICE));
  /** Answers the first three cards of Weber Design (wd-t18, wd-t17, wd-t4), so the fourth is current. */
  const answerFirstThree = (): void => {
    categorise('wd-t18');
    fix('wd-t17', markNoReceiptNeeded);
    categorise('wd-t4');
  };

  /** Settles whatever is wrong with an item in one go, so it leaves the queue. */
  const settle = (item: ReviewItem): void => {
    if (item.kind === 'payment') {
      demo.updateTransaction(item.id, (tx) => ({
        ...tx,
        booking: tx.booking ?? OFFICE,
        confirmed: true,
        receipt: tx.receipt === 'missing' ? 'notNeeded' : tx.receipt,
      }));
    } else {
      demo.updateDocument(item.id, (doc) => ({ ...doc, amountCents: doc.amountCents ?? 1000 }));
    }
  };
  /** Answers every card as it comes up and says in which order they came. */
  const answerAll = (): string[] => {
    const ids: string[] = [];
    for (let item = review.current(); item !== null && ids.length < 20; item = review.current()) {
      ids.push(item.id);
      review.answer(() => settle(item!), ANSWER);
    }
    return ids;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    demo = TestBed.inject(DemoStateService);
    review = TestBed.inject(ReviewService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('current is the oldest item and total counts all', () => {
    expect(review.current()).toEqual({
      kind: 'payment',
      id: 'wd-t18',
      date: '2026-10-02',
      problem: 'unclear',
    });
    expect(review.position()).toBe(1);
    expect(review.total()).toBe(6);
    expect(review.answered()).toBe(0);
    expect(review.minutesLeft()).toBe(6);
    expect(review.lastAnswer()).toBeNull();
    expect(review.canUndo()).toBe(false);
    expect(review.summary()).toEqual({ decisions: 0, receiptsAdded: 0, duplicatesRemoved: 0 });
  });

  it('answering moves on and counts', () => {
    review.answer(() => demo.updateTransaction('wd-t18', (tx) => changeCategory(tx, OFFICE)), {
      labelKey: 'review.answered.booked',
      params: { category: 'Office' },
    });

    expect(paymentStatus(payment('wd-t18'))).toBe('booked');
    expect(currentId()).toBe('wd-t17');
    expect(review.answered()).toBe(1);
    expect(review.position()).toBe(2);
    expect(review.total()).toBe(6);
    expect(review.minutesLeft()).toBe(5);
    expect(review.summary().decisions).toBe(1);
    expect(review.canUndo()).toBe(true);
    expect(review.lastAnswer()).toEqual({
      labelKey: 'review.answered.booked',
      params: { category: 'Office' },
    });
  });

  it('answering every card finishes the session', () => {
    expect(answerAll()).toEqual(WEBER_ORDER);

    expect(review.current()).toBeNull();
    expect(review.answered()).toBe(6);
    expect(review.position()).toBe(6);
    expect(review.total()).toBe(6);
    expect(review.summary().decisions).toBe(6);
  });

  it('an item with a second problem stays current', () => {
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, confirmed: false }));
    answerFirstThree();
    expect(review.current()).toMatchObject({ id: 'wd-t3', problem: 'confirm' });
    expect(review.answered()).toBe(3);

    fix('wd-t3', confirmBooking);

    expect(review.current()).toMatchObject({ id: 'wd-t3', problem: 'noReceipt' });
    expect(review.answered()).toBe(3);
    expect(review.position()).toBe(4);
    expect(review.total()).toBe(6);
    expect(review.canUndo()).toBe(true);
    expect(review.lastAnswer()).toEqual(ANSWER);

    fix('wd-t3', markNoReceiptNeeded);
    expect(currentId()).toBe('wd-t1');
    expect(review.answered()).toBe(4);
  });

  it('undoing the first answer of an item with two problems brings its first question back and keeps the count', () => {
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, confirmed: false }));
    answerFirstThree();
    fix('wd-t3', confirmBooking);

    review.undo();

    expect(review.current()).toMatchObject({ id: 'wd-t3', problem: 'confirm' });
    expect(review.answered()).toBe(3);
    expect(payment('wd-t3').confirmed).toBe(false);
  });

  it('a skipped item comes back after the others', () => {
    review.skip();

    expect(currentId()).toBe('wd-t17');
    expect(review.answered()).toBe(0);
    expect(review.position()).toBe(1);
    expect(review.total()).toBe(6);

    expect(answerAll()).toEqual(['wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1', 'wd-t18']);
  });

  it('skipped items come back in the order they were skipped', () => {
    review.skip(); // wd-t18
    review.skip(); // wd-t17
    review.skip(); // wd-t4

    expect(answerAll()).toEqual(['wd-t3', 'wd-t1', 'wd-d1', 'wd-t18', 'wd-t17', 'wd-t4']);
  });

  it('when everything is skipped, skipping goes on round the queue', () => {
    for (let i = 0; i < 6; i++) review.skip();
    expect(currentId()).toBe('wd-t18'); // all skipped: the first skipped one comes first

    review.skip(); // wd-t18 goes behind the others
    expect(currentId()).toBe('wd-t17');
    expect(review.answered()).toBe(0);
    expect(review.total()).toBe(6);
    expect(answerAll()).toEqual(['wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1', 'wd-t18']);
  });

  it('skipping the only card keeps it', () => {
    demo.setBusiness('sara-yoga');
    for (let i = 0; i < 2; i++) {
      const item = review.current()!;
      review.answer(() => settle(item), ANSWER);
    }
    expect(currentId()).toBe('sy-t2');

    review.skip();

    expect(currentId()).toBe('sy-t2');
    expect(review.position()).toBe(3);
    expect(review.total()).toBe(3);
  });

  it('a skipped item that was fixed elsewhere just disappears', () => {
    review.skip(); // wd-t18
    demo.updateTransaction('wd-t18', (tx) => changeCategory(tx, OFFICE));

    expect(review.total()).toBe(5);
    expect(review.answered()).toBe(0);
    expect(answerAll()).toEqual(['wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1']);
  });

  it('answering with nothing to review does nothing', () => {
    const apply = vi.fn();
    demo.setBusiness('cafe-linde');
    expect(review.current()).toBeNull();

    review.answer(apply, ANSWER);
    review.skip();

    expect(apply).not.toHaveBeenCalled();
    expect(review.answered()).toBe(0);
    expect(review.canUndo()).toBe(false);
    expect(review.lastAnswer()).toBeNull();
    expect(review.position()).toBe(0);
    expect(review.total()).toBe(0);
    expect(review.minutesLeft()).toBe(1);
  });

  it('undo restores the change and the counters', () => {
    categorise('wd-t18');
    review.answer(() => demo.link('wd-d4', 'wd-t17'), { ...ANSWER, counts: 'receipt' });
    expect(review.summary()).toEqual({ decisions: 2, receiptsAdded: 1, duplicatesRemoved: 0 });
    expect(payment('wd-t17').receipt).toBe('attached');
    expect(currentId()).toBe('wd-t4');

    review.undo();

    expect(payment('wd-t17').receipt).toBe('missing');
    expect(demo.documents().find((d) => d.id === 'wd-d4')!.paymentId).toBeNull();
    expect(currentId()).toBe('wd-t17');
    expect(review.answered()).toBe(1);
    expect(review.position()).toBe(2);
    expect(review.summary()).toEqual({ decisions: 1, receiptsAdded: 0, duplicatesRemoved: 0 });
    expect(review.canUndo()).toBe(false);
    expect(review.lastAnswer()).toBeNull();
    expect(paymentStatus(payment('wd-t18'))).toBe('booked'); // the answer before it stays
  });

  it('undo goes back one answer only', () => {
    categorise('wd-t18');
    fix('wd-t17', markNoReceiptNeeded);
    review.undo();
    review.undo();

    expect(paymentStatus(payment('wd-t18'))).toBe('booked');
    expect(payment('wd-t17').receipt).toBe('missing');
    expect(review.answered()).toBe(1);
  });

  it('undo reverts the duplicate count', () => {
    demo.updateDocument('wd-d2', (d) => ({ ...d, duplicateOf: 'wd-d3' }));
    expect(review.total()).toBe(7);
    answerFirstThree();
    expect(review.current()).toMatchObject({ id: 'wd-d2', problem: 'duplicate' });

    review.answer(() => demo.removeDocument('wd-d2'), { ...ANSWER, counts: 'duplicateRemoved' });
    expect(review.summary()).toEqual({ decisions: 4, receiptsAdded: 0, duplicatesRemoved: 1 });
    expect(demo.documents().some((d) => d.id === 'wd-d2')).toBe(false);

    review.undo();
    expect(review.summary()).toEqual({ decisions: 3, receiptsAdded: 0, duplicatesRemoved: 0 });
    expect(demo.documents().some((d) => d.id === 'wd-d2')).toBe(true);
    expect(currentId()).toBe('wd-d2');
  });

  it('undo after a learned rule restores both payments and the rules', () => {
    const before = structuredClone(demo.business());
    expect(before.categoryRules).toEqual([]);

    let booked: string[] = [];
    review.answer(
      () => {
        demo.updateTransaction('wd-t18', (tx) => changeCategory(tx, OFFICE));
        booked = demo.addRule({ counterpartyKey: 'amazon', booking: OFFICE }, 'wd-t18');
      },
      { ...ANSWER, learnedBookedCount: 1 },
    );

    expect(booked).toEqual(['wd-t4']);
    expect(demo.business().categoryRules).toEqual([{ counterpartyKey: 'amazon', booking: OFFICE }]);
    expect(paymentStatus(payment('wd-t4'))).toBe('booked');
    // The rule took wd-t4 out of the queue too, and only the card that was answered counts.
    expect(review.answered()).toBe(1);
    expect(review.total()).toBe(5);
    expect(currentId()).toBe('wd-t17');
    expect(review.lastAnswer()).toEqual({ ...ANSWER, learnedBookedCount: 1 });

    review.undo();

    expect(demo.business()).toEqual(before);
    expect(review.answered()).toBe(0);
    expect(review.total()).toBe(6);
    expect(currentId()).toBe('wd-t18');
  });

  describe('the undo window', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('canUndo ends after 5000 ms', () => {
      expect(UNDO_MS).toBe(5000);
      categorise('wd-t18');
      expect(review.canUndo()).toBe(true);

      vi.advanceTimersByTime(4999);
      expect(review.canUndo()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(review.canUndo()).toBe(false);

      review.undo(); // too late: nothing changes
      expect(paymentStatus(payment('wd-t18'))).toBe('booked');
      expect(review.answered()).toBe(1);
    });

    it('a new answer restarts the 5000 ms', () => {
      categorise('wd-t18');
      vi.advanceTimersByTime(3000);
      fix('wd-t17', markNoReceiptNeeded);

      vi.advanceTimersByTime(4999);
      expect(review.canUndo()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(review.canUndo()).toBe(false);
    });

    it('undo stops the timer, so a later answer gets its full time', () => {
      categorise('wd-t18');
      vi.advanceTimersByTime(4000);
      review.undo();
      expect(review.canUndo()).toBe(false);

      categorise('wd-t18');
      vi.advanceTimersByTime(4999);
      expect(review.canUndo()).toBe(true);
    });

    it('the last answer stays for the page after the undo window is over', () => {
      categorise('wd-t18');
      vi.advanceTimersByTime(UNDO_MS);
      expect(review.canUndo()).toBe(false);
      expect(review.lastAnswer()).toEqual(ANSWER);
    });
  });

  describe('a reset or another business', () => {
    it('reset demo while reviewing rebuilds the queue', () => {
      categorise('wd-t18');
      review.skip(); // wd-t17
      fix('wd-t4', markNoReceiptNeeded);
      expect(review.answered()).toBe(1);
      expect(review.canUndo()).toBe(true);

      demo.resetData();

      expect(review.current()).toMatchObject({ id: 'wd-t18', problem: 'unclear' });
      expect(review.answered()).toBe(0);
      expect(review.position()).toBe(1);
      expect(review.total()).toBe(6);
      expect(review.minutesLeft()).toBe(6);
      expect(review.summary()).toEqual({ decisions: 0, receiptsAdded: 0, duplicatesRemoved: 0 });
      expect(review.lastAnswer()).toBeNull();
      expect(review.canUndo()).toBe(false);
      expect(answerAll()).toEqual(WEBER_ORDER); // nothing is still skipped
    });

    it('undo does nothing after a reset', () => {
      categorise('wd-t18');
      fix('wd-t17', markNoReceiptNeeded);
      demo.resetData();

      review.undo();

      expect(paymentStatus(payment('wd-t18'))).toBe('unclear');
      expect(payment('wd-t17').receipt).toBe('missing');
      expect(review.answered()).toBe(0);
      expect(review.total()).toBe(6);
    });

    it('an answer after a reset can be undone', () => {
      categorise('wd-t18');
      demo.resetData();
      categorise('wd-t18');
      expect(review.canUndo()).toBe(true);

      review.undo();

      expect(paymentStatus(payment('wd-t18'))).toBe('unclear');
      expect(review.answered()).toBe(0);
    });

    it('another business starts its own session', () => {
      categorise('wd-t18');
      review.skip();

      demo.setBusiness('sara-yoga');

      expect(review.current()).toMatchObject({ id: 'sy-t8' });
      expect(review.answered()).toBe(0);
      expect(review.total()).toBe(3);
      expect(review.summary().decisions).toBe(0);
      expect(review.lastAnswer()).toBeNull();
      expect(review.canUndo()).toBe(false);
    });

    it('undo does nothing in another business and leaves the first one as it was', () => {
      categorise('wd-t18');
      demo.setBusiness('sara-yoga');
      const sara = demo.business();

      review.undo();

      expect(demo.business()).toBe(sara);
      demo.setBusiness('weber-design');
      expect(paymentStatus(payment('wd-t18'))).toBe('booked');
    });

    it('coming back to the first business starts over, not where it left off', () => {
      categorise('wd-t18');
      review.skip(); // wd-t17
      demo.setBusiness('sara-yoga');
      TestBed.tick();
      demo.setBusiness('weber-design');
      TestBed.tick();

      expect(review.answered()).toBe(0);
      expect(review.canUndo()).toBe(false);
      expect(answerAll()).toEqual(['wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1']); // wd-t17 is not skipped any more
    });
  });
});

describe('ReviewService returnUrl', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'old', redirectTo: 'payments' },
          { path: '**', children: [] },
        ]),
      ],
    });
    router = TestBed.inject(Router);
  });

  it('is / until the person has been somewhere', () => {
    expect(TestBed.inject(ReviewService).returnUrl()).toBe('/');
  });

  it('returnUrl is the last page outside /review', async () => {
    const review = TestBed.inject(ReviewService);

    await router.navigateByUrl('/payments/wd-t3?tab=history');
    expect(review.returnUrl()).toBe('/payments/wd-t3?tab=history');

    await router.navigateByUrl('/review');
    expect(review.returnUrl()).toBe('/payments/wd-t3?tab=history');
    await router.navigateByUrl('/review/anything');
    expect(review.returnUrl()).toBe('/payments/wd-t3?tab=history');

    await router.navigateByUrl('/documents');
    expect(review.returnUrl()).toBe('/documents');
  });

  it('follows a redirect to where the page really is', async () => {
    const review = TestBed.inject(ReviewService);
    await router.navigateByUrl('/old');
    expect(review.returnUrl()).toBe('/payments');
  });

  it('knows the page the person is on when the service starts late', async () => {
    await router.navigateByUrl('/documents');
    expect(TestBed.inject(ReviewService).returnUrl()).toBe('/documents');
  });

  it('is / when the service starts on a review page', async () => {
    await router.navigateByUrl('/review');
    expect(TestBed.inject(ReviewService).returnUrl()).toBe('/');
  });
});
