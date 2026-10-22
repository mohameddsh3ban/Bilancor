import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import type { Business } from '../data/models';
import { decisionMinutes } from '../domain/home-figures';
import { reviewItems, type ReviewItem } from '../domain/review-queue';
import { DemoStateService } from './demo-state.service';

/** How long Undo stays on offer after an answer. */
export const UNDO_MS = 5000;

/** What an answer tells the person: a message (translation key and its values), and how many more payments a learned rule booked. */
export interface ReviewAnswer {
  labelKey: string;
  params?: Record<string, string>;
  learnedBookedCount?: number;
}

/** An answer, plus the line of the finish summary it adds to, if any. */
export interface ReviewAnswerResult extends ReviewAnswer {
  counts?: 'receipt' | 'duplicateRemoved';
}

/** What Undo takes back: the data as it was before the answer, and which counters the answer moved. */
interface UndoStep {
  snapshot: Business;
  /** Whether the answer took its item out of the queue (an item with a next problem stays and is not counted yet). */
  counted: boolean;
  counts: ReviewAnswerResult['counts'];
}

/** Everything one review session remembers. It belongs to one business and one data generation (see `ReviewService.session`). */
interface Session {
  /** Different for every session, so work that started in an earlier one can tell it is over. */
  id: number;
  answered: number;
  receiptsAdded: number;
  duplicatesRemoved: number;
  /** `kind:id` of the skipped items, in the order they were skipped. Some may not be in the queue any more. */
  skipped: readonly string[];
  lastAnswer: ReviewAnswer | null;
  undo: UndoStep | null;
}

let sessionCount = 0;
const emptySession = (): Session => ({
  id: ++sessionCount,
  answered: 0,
  receiptsAdded: 0,
  duplicatesRemoved: 0,
  skipped: [],
  lastAnswer: null,
  undo: null,
});

const itemKey = (item: ReviewItem): string => `${item.kind}:${item.id}`;
const outsideReview = (url: string): boolean => !url.startsWith('/review');

/** The counters of a session moved by one answer, forwards (`1`) or back (`-1`). */
function moveCounters(
  session: Session,
  step: UndoStep,
  direction: 1 | -1,
): Pick<Session, 'answered' | 'receiptsAdded' | 'duplicatesRemoved'> {
  return {
    answered: session.answered + (step.counted ? direction : 0),
    receiptsAdded: session.receiptsAdded + (step.counts === 'receipt' ? direction : 0),
    duplicatesRemoved:
      session.duplicatesRemoved + (step.counts === 'duplicateRemoved' ? direction : 0),
  };
}

/**
 * The state behind the review inbox: which decision is current, how far along the person is, skip, a one-level Undo
 * and what the finish screen sums up. The queue itself is the live `reviewItems` of the open business, so a decision
 * fixed anywhere else leaves it too. A session lasts until Reset demo or another business; closing the page keeps it.
 */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly demo = inject(DemoStateService);
  private readonly router = inject(Router);

  /** The business and the data generation a session belongs to. */
  private readonly scope = computed(
    () => `${this.demo.business().id}:${this.demo.dataGeneration()}`,
  );
  /** Starts over whenever the scope changes, and with it the undo step: a snapshot is never restored into other data. */
  private readonly session = linkedSignal<string, Session>({
    source: this.scope,
    computation: emptySession,
  });

  private readonly pendingSignal = signal(false);

  /** The decisions waiting right now, oldest first. */
  private readonly live = computed(() => reviewItems(this.demo.business(), this.demo.setup()));
  /** The session queue: the live items, except the skipped ones, which follow in the order they were skipped. */
  private readonly queue = computed(() => {
    const skipped = this.session().skipped;
    const live = this.live();
    if (skipped.length === 0) return live;
    const byKey = new Map(live.map((item) => [itemKey(item), item]));
    const rest = live.filter((item) => !skipped.includes(itemKey(item)));
    const back = skipped.flatMap((key) => byKey.get(key) ?? []);
    return [...rest, ...back];
  });

  readonly current = computed<ReviewItem | null>(() => this.queue()[0] ?? null);
  readonly answered = computed(() => this.session().answered);
  /** The number of the current card, 1-based; once nothing is left, the number of the last one. */
  readonly position = computed(() => this.answered() + (this.current() ? 1 : 0));
  /** What was answered plus what is left. It follows the live data: a decision that disappears elsewhere is not counted. */
  readonly total = computed(() => this.answered() + this.queue().length);
  readonly minutesLeft = computed(() => decisionMinutes(this.queue().length));
  readonly lastAnswer = computed(() => this.session().lastAnswer);
  readonly canUndo = computed(() => this.session().undo !== null);
  /** An answer is waiting for its `apply` to finish (a photo being read): until it is recorded, answer, skip and undo are ignored. */
  readonly pending = this.pendingSignal.asReadonly();
  readonly summary = computed(() => {
    const { answered, receiptsAdded, duplicatesRemoved } = this.session();
    return { decisions: answered, receiptsAdded, duplicatesRemoved };
  });

  private readonly returnUrlSignal = signal(outsideReview(this.router.url) ? this.router.url : '/');
  /** The last page the person was on outside `/review`, for ✕ and Back; `/` when there is none. */
  readonly returnUrl = this.returnUrlSignal.asReadonly();

  private undoTimer: ReturnType<typeof setTimeout> | undefined;
  /** The session the undo timer was started for. */
  private undoTimerSession = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.undoTimer));

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (outsideReview(event.urlAfterRedirects))
          this.returnUrlSignal.set(event.urlAfterRedirects);
      });

    // A linkedSignal starts over only when it is read after its scope changed. Read it at every change, so a session
    // cannot come back when the person goes to another business and back before anything has looked at it, and
    // drop the undo timer of the session that is over.
    effect(() => {
      this.scope();
      untracked(() => {
        if (this.session().id !== this.undoTimerSession) clearTimeout(this.undoTimer);
      });
    });
  }

  /**
   * Answers the current decision: takes a snapshot and notes the decision, runs `apply` (which changes the data), and
   * once `apply` is done counts the decision as answered when it left the queue and offers Undo. A decision with a next
   * problem stays current and is counted with its last answer. Ignored when nothing is waiting.
   *
   * `apply` may return a promise (a photo that is being read): the answer counts when it settles, for the decision
   * that was current when it started, and the snapshot is from before it started so Undo takes the photo back too.
   * A synchronous `apply` is recorded at once. When Reset demo or another business came in meanwhile, the result is
   * ignored. The returned promise settles when the answer is recorded or ignored, and rejects (recording nothing)
   * when `apply` does.
   *
   * While such an answer waits (`pending`), `answer`, `skip` and `undo` do nothing: a second answer would apply to
   * whatever card is current by then, and an undo or a skip would pull the data or the queue from under the first.
   */
  answer(apply: () => void | Promise<unknown>, result: ReviewAnswerResult): Promise<void> {
    const item = this.current();
    if (item === null || this.pending()) return Promise.resolve();
    const answering = {
      sessionId: this.session().id,
      key: itemKey(item),
      snapshot: this.demo.snapshot(),
    };
    const outcome = apply();
    if (!(outcome instanceof Promise)) {
      this.record(answering, result);
      return Promise.resolve();
    }
    this.pendingSignal.set(true);
    return outcome
      .then(() => this.record(answering, result))
      .finally(() => this.pendingSignal.set(false));
  }

  /** Moves the current decision behind the others; skipping again sends it to the end once more. */
  skip(): void {
    const item = this.current();
    if (item === null || this.pending()) return;
    const key = itemKey(item);
    this.session.update((session) => ({
      ...session,
      skipped: [...session.skipped.filter((k) => k !== key), key],
    }));
  }

  /** Takes back the last answer, its learned rule and everything it booked, and brings its card back. Does nothing once the undo time is over. */
  undo(): void {
    const step = this.session().undo;
    if (step === null || this.pending()) return;
    clearTimeout(this.undoTimer);
    this.demo.restore(step.snapshot);
    this.session.update((session) => ({
      ...session,
      ...moveCounters(session, step, -1),
      lastAnswer: null,
      undo: null,
    }));
  }

  /** Counts an answer whose `apply` is done, unless its session is over, and starts the undo window. */
  private record(
    answering: { sessionId: number; key: string; snapshot: Business },
    result: ReviewAnswerResult,
  ): void {
    if (this.session().id !== answering.sessionId) return;
    const { counts, ...lastAnswer } = result;
    const step: UndoStep = {
      snapshot: answering.snapshot,
      counted: !this.live().some((other) => itemKey(other) === answering.key),
      counts,
    };
    this.session.update((session) => ({
      ...session,
      ...moveCounters(session, step, 1),
      lastAnswer,
      undo: step,
    }));
    this.restartUndoTimer(answering.sessionId);
  }

  private restartUndoTimer(sessionId: number): void {
    clearTimeout(this.undoTimer);
    this.undoTimerSession = sessionId;
    this.undoTimer = setTimeout(
      () =>
        this.session.update((session) =>
          session.id === sessionId && session.undo !== null ? { ...session, undo: null } : session,
        ),
      UNDO_MS,
    );
  }
}
