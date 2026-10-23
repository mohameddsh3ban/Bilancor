import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { OFFICE } from '../data/categories';
import type { Transaction } from '../data/models';
import type { ReviewItem } from '../domain/review-queue';
import { changeCategory, confirmBooking, markNoReceiptNeeded } from '../domain/payment-actions';
import { paymentStatus } from '../domain/payment-status';
import { READING_MS } from '../domain/document-upload';
import { DemoStateService } from './demo-state.service';
import { ReviewService, UNDO_MS, reviewItemKey } from './review.service';
import { UploadService } from './upload.service';

const ANSWER = { labelKey: 'review.answered.booked' };
const WEBER_ORDER = ['wd-t18', 'wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1', 'wd-t19'];

describe('ReviewService', () => {
  let demo: DemoStateService;
  let review: ReviewService;

  const payment = (id: string): Transaction =>
    demo.business().transactions.find((t) => t.id === id)!;
  const currentId = (): string | undefined => review.current()?.id;

  /** Answers the current card the way the page does: the change to the data happens inside `apply`. */
  const fix = (id: string, change: (tx: Transaction) => Transaction, result = ANSWER): void => {
    void review.answer(() => demo.updateTransaction(id, change), result); // a sync apply is recorded at once
  };
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
    expect(review.total()).toBe(7);
    expect(review.answered()).toBe(0);
    expect(review.minutesLeft()).toBe(7);
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
    expect(review.total()).toBe(7);
    expect(review.minutesLeft()).toBe(6);
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
    expect(review.answered()).toBe(7);
    expect(review.position()).toBe(7);
    expect(review.total()).toBe(7);
    expect(review.summary().decisions).toBe(7);
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
    expect(review.total()).toBe(7);
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
    expect(review.total()).toBe(7);

    expect(answerAll()).toEqual(['wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1', 'wd-t19', 'wd-t18']);
  });

  it('skipped items come back in the order they were skipped', () => {
    review.skip(); // wd-t18
    review.skip(); // wd-t17
    review.skip(); // wd-t4

    expect(answerAll()).toEqual(['wd-t3', 'wd-t1', 'wd-d1', 'wd-t19', 'wd-t18', 'wd-t17', 'wd-t4']);
  });

  it('when everything is skipped, skipping goes on round the queue', () => {
    for (let i = 0; i < 7; i++) review.skip();
    expect(currentId()).toBe('wd-t18'); // all skipped: the first skipped one comes first

    review.skip(); // wd-t18 goes behind the others
    expect(currentId()).toBe('wd-t17');
    expect(review.answered()).toBe(0);
    expect(review.total()).toBe(7);
    expect(answerAll()).toEqual(['wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1', 'wd-t19', 'wd-t18']);
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

    expect(review.total()).toBe(6);
    expect(review.answered()).toBe(0);
    expect(answerAll()).toEqual(['wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1', 'wd-t19']);
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

  describe('an answer that names its card', () => {
    it('is applied while that card is the current one', () => {
      const item = review.current()!;
      const apply = vi.fn(() => settle(item));

      review.answer(apply, ANSWER, reviewItemKey(item));

      expect(apply).toHaveBeenCalledOnce();
      expect(review.answered()).toBe(1);
    });

    it('does nothing once another card is current', () => {
      const staleKey = reviewItemKey(review.current()!);
      categorise('wd-t18'); // wd-t17 is current now
      const apply = vi.fn();

      review.answer(apply, { labelKey: 'review.answered.stale' }, staleKey);

      expect(apply).not.toHaveBeenCalled();
      expect(currentId()).toBe('wd-t17');
      expect(review.answered()).toBe(1);
      expect(review.lastAnswer()).toEqual(ANSWER); // still the answer before
      expect(review.pending()).toBe(false);
    });

    it('does nothing for a card that was skipped and is not current any more', () => {
      const first = reviewItemKey(review.current()!);
      review.skip(); // wd-t17 is current, wd-t18 is at the end
      const apply = vi.fn();

      review.answer(apply, ANSWER, first);

      expect(apply).not.toHaveBeenCalled();
      expect(review.answered()).toBe(0);
      expect(review.canUndo()).toBe(false);
    });

    it('does nothing, and does not start waiting, when the answer would take time', async () => {
      const staleKey = reviewItemKey(review.current()!);
      categorise('wd-t18');
      const apply = vi.fn(() => new Promise<void>(() => undefined));

      await review.answer(apply, ANSWER, staleKey);

      expect(apply).not.toHaveBeenCalled();
      expect(review.pending()).toBe(false);
    });

    it('is still the same card after its first problem is answered', () => {
      demo.updateTransaction('wd-t3', (tx) => ({ ...tx, confirmed: false }));
      answerFirstThree();
      const key = reviewItemKey(review.current()!); // wd-t3, which has two problems

      review.answer(() => demo.updateTransaction('wd-t3', confirmBooking), ANSWER, key);
      expect(review.current()).toMatchObject({ id: 'wd-t3', problem: 'noReceipt' });

      review.answer(() => demo.updateTransaction('wd-t3', markNoReceiptNeeded), ANSWER, key);
      expect(currentId()).toBe('wd-t1');
      expect(review.answered()).toBe(4);
    });

    it('an answer without a key still goes to whatever is current', () => {
      categorise('wd-t18');
      const apply = vi.fn(() => settle(review.current()!));

      review.answer(apply, ANSWER);

      expect(apply).toHaveBeenCalledOnce();
      expect(review.answered()).toBe(2);
    });

    it('names a card by its kind and id', () => {
      expect(reviewItemKey(review.current()!)).toBe('payment:wd-t18');
      expect(
        reviewItemKey({ kind: 'document', id: 'wd-d1', date: '2026-10-01', problem: 'duplicate' }),
      ).toBe('document:wd-d1');
    });
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
    // A duplicate is a file that was added, not the document of an invoice written in Invoices (that one cannot be removed).
    demo.updateDocument('wd-d2', (d) => ({ ...d, duplicateOf: 'wd-d3', invoice: null }));
    expect(review.total()).toBe(8);
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

  it('undo does not take back tax answers, accounts or history saved after the answer', () => {
    categorise('wd-t18');
    const answers = { ...demo.business().taxProfile, vatPeriod: 'quarterly' as const };
    demo.saveTaxProfile(answers);
    const history = demo.business().history;
    expect(history.map((line) => line.key)).toEqual(['taxChanged']);

    review.undo();

    expect(paymentStatus(payment('wd-t18'))).toBe('unclear'); // the answer is taken back
    expect(demo.business().taxProfile).toEqual(answers);
    expect(demo.business().history).toBe(history);
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
    expect(review.total()).toBe(6);
    expect(currentId()).toBe('wd-t17');
    expect(review.lastAnswer()).toEqual({ ...ANSWER, learnedBookedCount: 1 });

    review.undo();

    expect(demo.business()).toEqual(before);
    expect(review.answered()).toBe(0);
    expect(review.total()).toBe(7);
    expect(currentId()).toBe('wd-t18');
  });

  it('an answer that changes no business or data does not start a new session', () => {
    categorise('wd-t18');

    TestBed.tick();

    expect(review.answered()).toBe(1);
    expect(review.canUndo()).toBe(true);
    expect(review.lastAnswer()).toEqual(ANSWER);
  });

  describe('an answer that takes time', () => {
    let upload: UploadService;
    const uploads = () => demo.documents().filter((d) => d.fromUpload);
    const takePhoto = (): Promise<void> =>
      review.answer(() => upload.addPhotoFor('wd-t17'), ANSWER);

    beforeEach(() => {
      vi.useFakeTimers();
      upload = TestBed.inject(UploadService);
      categorise('wd-t18'); // wd-t17 (receipt missing) is current now
      vi.advanceTimersByTime(UNDO_MS); // so that only the photo answer can be undone
    });

    it('is counted once, when it is done, and undo restores the data from before it', async () => {
      const done = takePhoto();

      // While the photo is read the card stays and nothing is counted yet.
      expect(currentId()).toBe('wd-t17');
      expect(review.answered()).toBe(1);
      expect(review.canUndo()).toBe(false);
      vi.advanceTimersByTime(READING_MS - 1);
      expect(review.answered()).toBe(1);

      vi.advanceTimersByTime(1);
      await done;

      expect(payment('wd-t17').receipt).toBe('attached');
      expect(uploads()).toHaveLength(1);
      expect(currentId()).toBe('wd-t4');
      expect(review.answered()).toBe(2);
      expect(review.summary().decisions).toBe(2);
      expect(review.canUndo()).toBe(true);
      expect(review.lastAnswer()).toEqual(ANSWER);

      review.undo();

      expect(payment('wd-t17').receipt).toBe('missing');
      expect(uploads()).toEqual([]);
      expect(currentId()).toBe('wd-t17');
      expect(review.answered()).toBe(1);
      expect(review.canUndo()).toBe(false);
    });

    it('starts its undo window when it is done, not when it was asked', async () => {
      const done = takePhoto();
      vi.advanceTimersByTime(READING_MS);
      await done;

      vi.advanceTimersByTime(UNDO_MS - 1);
      expect(review.canUndo()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(review.canUndo()).toBe(false);
    });

    it('is ignored when Reset demo came in between', async () => {
      const done = takePhoto();
      vi.advanceTimersByTime(1000);
      demo.resetData();
      vi.advanceTimersByTime(READING_MS);
      await done;

      expect(review.answered()).toBe(0);
      expect(review.canUndo()).toBe(false);
      expect(review.lastAnswer()).toBeNull();
      expect(review.total()).toBe(7);
      expect(currentId()).toBe('wd-t18');
    });

    it('is ignored when another business was opened in between', async () => {
      const done = takePhoto();
      demo.setBusiness('sara-yoga');
      vi.advanceTimersByTime(READING_MS);
      await done;

      expect(review.answered()).toBe(0);
      expect(review.canUndo()).toBe(false);
      expect(review.lastAnswer()).toBeNull();
      expect(currentId()).toBe('sy-t8');
    });

    it('that fails is not recorded', async () => {
      const failing = review.answer(() => Promise.reject(new Error('no photo')), ANSWER);
      await expect(failing).rejects.toThrow('no photo');

      expect(review.answered()).toBe(1);
      expect(review.canUndo()).toBe(false);
      expect(currentId()).toBe('wd-t17');
    });

    describe('is the only thing going on', () => {
      it('pending is true from the start of the answer until it is recorded', async () => {
        expect(review.pending()).toBe(false);
        const done = takePhoto();
        expect(review.pending()).toBe(true);

        vi.advanceTimersByTime(READING_MS - 1);
        expect(review.pending()).toBe(true);
        vi.advanceTimersByTime(1);
        await done;

        expect(review.pending()).toBe(false);
      });

      it('another answer, skip and undo do nothing meanwhile', async () => {
        fix('wd-t17', markNoReceiptNeeded); // answered 2 and undoable; wd-t4 is current
        let finish!: () => void;
        const slow = review.answer(() => new Promise<void>((resolve) => (finish = resolve)), {
          labelKey: 'review.answered.slow',
        });
        const applySecond = vi.fn();

        await review.answer(applySecond, ANSWER);
        review.skip();
        review.undo();

        expect(applySecond).not.toHaveBeenCalled();
        expect(currentId()).toBe('wd-t4'); // not skipped
        expect(review.answered()).toBe(2); // not undone either
        expect(payment('wd-t17').receipt).toBe('notNeeded');
        expect(review.canUndo()).toBe(true);
        expect(review.lastAnswer()).toEqual(ANSWER);

        finish();
        await slow;
        expect(review.pending()).toBe(false);
        expect(review.lastAnswer()).toEqual({ labelKey: 'review.answered.slow' });
      });

      it('skip works again once it is recorded', async () => {
        const done = takePhoto();
        vi.advanceTimersByTime(READING_MS);
        await done;

        review.skip();
        expect(currentId()).toBe('wd-t3');
      });

      it('an answer that fails sets it free again', async () => {
        const failing = review.answer(() => Promise.reject(new Error('no photo')), ANSWER);
        expect(review.pending()).toBe(true);
        await expect(failing).rejects.toThrow('no photo');

        expect(review.pending()).toBe(false);
        fix('wd-t17', markNoReceiptNeeded);
        expect(review.answered()).toBe(2);
      });

      it('Reset demo while it waits does not leave it stuck', async () => {
        const done = takePhoto();
        demo.resetData();
        vi.advanceTimersByTime(READING_MS);
        await done;

        expect(review.pending()).toBe(false);
        categorise('wd-t18');
        expect(review.answered()).toBe(1);
      });
    });

    it('an answer that needs no time is never pending', () => {
      fix('wd-t17', markNoReceiptNeeded);
      expect(review.pending()).toBe(false);
      expect(review.answered()).toBe(2);
    });
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

    it('a timer from before a reset cannot end the undo window of the next session', () => {
      categorise('wd-t18'); // t = 0, its window would end at 5000
      vi.advanceTimersByTime(1000);
      demo.resetData();
      vi.advanceTimersByTime(1000);
      categorise('wd-t18'); // t = 2000, its window ends at 7000

      vi.advanceTimersByTime(3000); // t = 5000
      expect(review.canUndo()).toBe(true);
      vi.advanceTimersByTime(2000); // t = 7000
      expect(review.canUndo()).toBe(false);
    });

    it('the undo timer is cleared when the session starts over', () => {
      categorise('wd-t18');
      expect(vi.getTimerCount()).toBe(1);

      demo.resetData();
      TestBed.tick();

      expect(vi.getTimerCount()).toBe(0);
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
      expect(review.total()).toBe(7);
      expect(review.minutesLeft()).toBe(7);
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
      expect(review.total()).toBe(7);
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
      expect(answerAll()).toEqual(['wd-t17', 'wd-t4', 'wd-t3', 'wd-t1', 'wd-d1', 'wd-t19']); // wd-t17 is not skipped any more
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

  describe('cameFromReturnUrl (the page just before /review in the browser history)', () => {
    it('is false until /review has been opened', async () => {
      const review = TestBed.inject(ReviewService);
      expect(review.cameFromReturnUrl()).toBe(false);
      await router.navigateByUrl('/payments');
      expect(review.cameFromReturnUrl()).toBe(false);
    });

    it('is true when /review is opened from a page in the app', async () => {
      const review = TestBed.inject(ReviewService);
      await router.navigateByUrl('/payments');
      await router.navigateByUrl('/review');

      expect(review.cameFromReturnUrl()).toBe(true);
      expect(review.returnUrl()).toBe('/payments');
    });

    it('is false when /review is the first page, a direct load', async () => {
      const review = TestBed.inject(ReviewService);
      await router.navigateByUrl('/review');

      expect(review.cameFromReturnUrl()).toBe(false);
      expect(review.returnUrl()).toBe('/');
    });

    it('stays true while the person moves inside /review', async () => {
      const review = TestBed.inject(ReviewService);
      await router.navigateByUrl('/documents');
      await router.navigateByUrl('/review');
      await router.navigateByUrl('/review/anything');

      expect(review.cameFromReturnUrl()).toBe(true);
    });

    it('is false again once the person has left, and true for the next visit from another page', async () => {
      const review = TestBed.inject(ReviewService);
      await router.navigateByUrl('/payments');
      await router.navigateByUrl('/review');
      await router.navigateByUrl('/documents');
      expect(review.cameFromReturnUrl()).toBe(false);

      await router.navigateByUrl('/review');
      expect(review.cameFromReturnUrl()).toBe(true);
      expect(review.returnUrl()).toBe('/documents');
    });

    it('knows the page before it when the service starts late', async () => {
      await router.navigateByUrl('/documents');
      const review = TestBed.inject(ReviewService);

      await router.navigateByUrl('/review');
      expect(review.cameFromReturnUrl()).toBe(true);
    });

    it('is false when the service starts late, on /review itself', async () => {
      await router.navigateByUrl('/documents');
      await router.navigateByUrl('/review');

      expect(TestBed.inject(ReviewService).cameFromReturnUrl()).toBe(false);
    });
  });
});
