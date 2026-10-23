import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCamera, lucideLoaderCircle } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { LanguageService } from '../core/i18n/language.service';
import type { Booking, Invoice } from '../data/models';
import { counterpartyKey } from '../domain/category-rules';
import { invoiceMatch, invoiceOfPayment } from '../domain/invoices';
import {
  changeCategory,
  confirmBooking,
  markNoReceiptNeeded,
  setPrivate,
} from '../domain/payment-actions';
import type { ReviewItem } from '../domain/review-queue';
import { categoriesFor } from '../domain/tax-rules';
import { CategoryPicker } from '../payments/category-picker';
import { DocumentPicker } from '../payments/document-picker';
import { isolateText } from '../payments/payment-history';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService } from '../state/invoice.service';
import { ReviewService, reviewItemKey, type ReviewAnswerResult } from '../state/review.service';
import { UploadService } from '../state/upload.service';
import { ANSWERS_CLASS, ReviewCard, type TickNote } from './review-card';

/** A payment waiting for the person's decision. */
export type PaymentItem = Extract<ReviewItem, { kind: 'payment' }>;

/**
 * The review card of a payment: the frame with the payment's basics, then the one question its problem asks and the
 * answers to it (the likeliest first, as the main button). Every answer changes the sample data through the same
 * actions the Payments page uses, goes through `ReviewService.answer` (so it counts, and Undo can take it back) and ticks.
 *
 * The question follows the problem the stage hands over (`item().problem`): a payment with two problems keeps this card,
 * and after the first answer the same card asks the next question.
 *
 * A payment that is missing its receipt and probably pays one open invoice (see `invoiceGuess`) is asked that first, "Is
 * this the payment for invoice …?": Yes pays the invoice, Pick another opens the list of documents, and No receipt needed
 * is as it always was.
 *
 * Only a category chosen for an Unclear payment teaches the app: it makes a rule for that counterparty (see `choose`).
 */
@Component({
  selector: 'app-payment-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CategoryPicker, DocumentPicker, HlmButton, NgIcon, ReviewCard, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCamera, lucideLoaderCircle })],
  host: { class: 'block' },
  template: `
    <app-review-card
      [kindKey]="'review.kind.' + item().problem"
      [amountCents]="payment()?.amountCents ?? null"
      [signed]="true"
      [name]="payment()?.counterparty ?? ''"
      [date]="item().date"
    >
      @if (payment(); as tx) {
        @switch (item().problem) {
          @case ('unclear') {
            <p class="text-lg font-semibold" data-testid="card-question">
              {{ 'review.q.unclear' | transloco }}
            </p>
            <div [class]="answersClass">
              @for (booking of suggestions(); track booking.skr03; let first = $first) {
                <button
                  hlmBtn
                  size="lg"
                  type="button"
                  data-testid="answer-suggestion"
                  [variant]="first ? 'default' : 'outline'"
                  (click)="choose(booking)"
                >
                  {{ 'booking.' + booking.labelKey | transloco }}
                </button>
              }
              @if (canBePrivate()) {
                <button
                  hlmBtn
                  size="lg"
                  type="button"
                  variant="outline"
                  data-testid="answer-private"
                  (click)="markPrivate()"
                >
                  {{ 'review.a.private' | transloco }}
                </button>
              }
              <app-category-picker
                class="w-full"
                labelKey="review.a.otherCategory"
                (picked)="choose($event)"
              />
            </div>
          }
          @case ('confirm') {
            @if (tx.booking; as booking) {
              <p class="text-lg font-semibold" data-testid="card-question">
                {{
                  'review.q.confirm'
                    | transloco: { category: ('booking.' + booking.labelKey | transloco) }
                }}
              </p>
            }
            <div [class]="answersClass">
              <button
                hlmBtn
                size="lg"
                type="button"
                data-testid="answer-confirm"
                (click)="confirm()"
              >
                {{ 'review.a.confirm' | transloco }}
              </button>
              <app-category-picker
                class="w-full"
                labelKey="review.a.changeCategory"
                [current]="tx.booking"
                (picked)="changeTo($event)"
              />
            </div>
          }
          @case ('noReceipt') {
            <!-- An incoming payment that fits one open invoice (and does not name it) asks about that invoice first. -->
            @let guess = invoiceGuess();
            <p class="text-lg font-semibold" data-testid="card-question">
              @if (guess) {
                {{
                  'review.q.invoiceMatch'
                    | transloco: { number: shown(guess.number ?? ''), name: shown(guess.customer.name) }
                }}
              } @else {
                {{ 'review.q.noReceipt' | transloco }}
              }
            </p>
            <div [class]="answersClass">
              @if (guess) {
                <button
                  hlmBtn
                  size="lg"
                  type="button"
                  data-testid="answer-invoice-yes"
                  (click)="confirmInvoice(guess)"
                >
                  {{ 'review.a.yes' | transloco }}
                </button>
              } @else {
                <button
                  hlmBtn
                  size="lg"
                  type="button"
                  data-testid="answer-photo"
                  [disabled]="reading()"
                  (click)="takePhoto()"
                >
                  <ng-icon
                    size="16"
                    aria-hidden="true"
                    [name]="reading() ? 'lucideLoaderCircle' : 'lucideCamera'"
                    [class]="reading() ? 'animate-spin motion-reduce:animate-none' : ''"
                  />
                  {{
                    (reading() ? 'payments.detail.receipt.reading' : 'review.a.takePhoto')
                      | transloco
                  }}
                </button>
              }
              <app-document-picker
                class="w-full"
                [labelKey]="guess ? 'review.a.pickAnother' : 'payments.detail.receipt.pickDocument'"
                [payment]="tx"
                [canAdd]="false"
                (picked)="pickDocument($event)"
              />
              <button
                hlmBtn
                size="lg"
                type="button"
                variant="outline"
                data-testid="answer-no-receipt"
                (click)="noReceiptNeeded()"
              >
                {{ 'payments.detail.receipt.noReceiptNeeded' | transloco }}
              </button>
            </div>
          }
        }
      }
    </app-review-card>
  `,
})
export class PaymentCard {
  private readonly demo = inject(DemoStateService);
  private readonly invoices = inject(InvoiceService);
  private readonly review = inject(ReviewService);
  private readonly upload = inject(UploadService);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  readonly item = input.required<PaymentItem>();

  private readonly frame = viewChild(ReviewCard);

  protected readonly answersClass = ANSWERS_CLASS;

  protected readonly payment = computed(() =>
    this.demo.business().transactions.find((tx) => tx.id === this.item().id),
  );

  /** The categories the payment came with as suggestions, as far as the business can book to them. */
  protected readonly suggestions = computed<Booking[]>(() => {
    const offered = categoriesFor(this.demo.business().taxProfile);
    return (this.payment()?.suggestions ?? []).flatMap(
      (key) => offered.find((category) => category.labelKey === key) ?? [],
    );
  });

  /** A payment that a document is linked to, or that pays an invoice, cannot be private (the payment's own page does not allow it either). */
  protected readonly canBePrivate = computed(() => {
    const business = this.demo.business();
    const id = this.item().id;
    return !business.documents.some((doc) => doc.paymentId === id) && invoiceOfPayment(business, id) === null;
  });

  /**
   * The invoice this payment is probably for, when the system is not certain: money coming in with no receipt, whose
   * reference names no invoice, and whose amount is what exactly one open invoice still has to be paid. The card asks about it
   * before it asks for a receipt. Null for every other payment (one that names its invoice is linked, not asked about).
   */
  protected readonly invoiceGuess = computed<Invoice | null>(() => {
    const tx = this.payment();
    const match = tx ? invoiceMatch(this.demo.business(), tx) : null;
    return match && !match.certain ? match.invoice : null;
  });

  /** What names this card to the review service, so an answer given here never lands on another card. */
  private readonly key = computed(() => reviewItemKey(this.item()));

  /** A photo is being read for this payment (taken here, or on the payment's own page). */
  protected readonly reading = computed(() => this.upload.readingFor() === this.item().id);

  /**
   * The person says what an Unclear payment was for. The payment gets the category, and the app learns it: payments
   * from that counterparty are booked the same way from now on, and the other unclear ones of it are booked right now.
   * Nothing is learned from a name with nothing to match on. What was learned is told under the tick.
   */
  protected choose(booking: Booking): void {
    const tx = this.payment();
    if (!tx) return;
    const rule = counterpartyKey(tx.counterparty);
    // `learnedBookedCount` is filled in while the answer is applied; the service reads it when it records the answer.
    const result: ReviewAnswerResult = { labelKey: 'review.result.booked' };
    void this.review.answer(
      () => {
        this.demo.updateTransaction(tx.id, (current) => changeCategory(current, booking));
        if (rule !== '') {
          result.learnedBookedCount = this.demo.addRule(
            { counterpartyKey: rule, booking },
            tx.id,
          ).length;
        }
      },
      result,
      this.key(),
    );
    const notes = rule === '' ? [] : this.learnedNotes(tx.counterparty, booking, result);
    this.frame()?.showTick(result.labelKey, {}, notes);
  }

  protected markPrivate(): void {
    const tx = this.payment();
    if (!tx) return;
    this.answer(
      () => this.demo.updateTransaction(tx.id, (current) => setPrivate(current, true)),
      'review.result.private',
    );
  }

  protected confirm(): void {
    const tx = this.payment();
    if (!tx) return;
    this.answer(
      () => this.demo.updateTransaction(tx.id, confirmBooking),
      'review.result.confirmed',
    );
  }

  /** Another category changes the booking (no rule is made: rules come from Unclear payments only); the one it has counts as yes. */
  protected changeTo(booking: Booking): void {
    const tx = this.payment();
    if (!tx) return;
    if (tx.booking?.skr03 === booking.skr03) {
      this.confirm();
      return;
    }
    this.answer(
      () => this.demo.updateTransaction(tx.id, (current) => changeCategory(current, booking)),
      'review.result.categoryChanged',
    );
  }

  protected noReceiptNeeded(): void {
    const tx = this.payment();
    if (!tx) return;
    this.answer(
      () => this.demo.updateTransaction(tx.id, markNoReceiptNeeded),
      'review.result.noReceipt',
    );
  }

  /** A name or number in a sentence of the question: in Arabic it is set apart, so that it keeps its own direction. */
  protected shown(text: string): string {
    return this.language.lang() === 'ar' ? isolateText(text) : text;
  }

  /**
   * Yes, this payment pays the invoice (see `InvoiceService.confirmMatch`): the invoice is paid, and its sent document is the
   * payment's receipt, which counts as a receipt added like one picked from Documents.
   */
  protected confirmInvoice(invoice: Invoice): void {
    const tx = this.payment();
    if (!tx) return;
    this.answer(
      () => this.invoices.confirmMatch(tx.id, invoice.id),
      'review.result.invoicePaid',
      'receipt',
    );
  }

  protected pickDocument(docId: string): void {
    const tx = this.payment();
    if (!tx) return;
    this.answer(() => this.demo.link(docId, tx.id), 'review.result.receiptAdded', 'receipt');
  }

  /**
   * Simulates a photo of the receipt: the answer waits until it is read (the card shows Reading…), and counts only when
   * the photo became the payment's receipt. A photo that is dropped (Reset demo while it was read, the payment got its
   * receipt meanwhile) records nothing and leaves the card as it was.
   */
  protected takePhoto(): void {
    const tx = this.payment();
    if (!tx || this.reading()) return;
    const result: ReviewAnswerResult = {
      labelKey: 'review.result.receiptAdded',
      counts: 'receipt',
    };
    this.review
      .answer(
        async () => {
          const outcome = await this.upload.addPhotoFor(tx.id);
          if (outcome !== 'linked') throw new Error('photo dropped');
        },
        result,
        this.key(),
      )
      .then(
        () => this.frame()?.showTick(result.labelKey),
        () => undefined,
      );
  }

  /** Answers the current decision with `apply`, and ticks in the same breath, as the card frame asks. */
  private answer(apply: () => void, labelKey: string, counts?: ReviewAnswerResult['counts']): void {
    void this.review.answer(apply, { labelKey, counts }, this.key());
    this.frame()?.showTick(labelKey);
  }

  /** What the app learned, as the lines under the tick: the rule, and how many other payments it booked at once. */
  private learnedNotes(name: string, booking: Booking, result: ReviewAnswerResult): TickNote[] {
    // A name in an Arabic sentence is set apart so that it keeps its own direction.
    const shown = this.language.lang() === 'ar' ? isolateText(name) : name;
    const notes: TickNote[] = [
      {
        key: 'review.learned',
        params: { name: shown, category: this.transloco.translate(`booking.${booking.labelKey}`) },
      },
    ];
    const count = result.learnedBookedCount ?? 0;
    if (count > 0) {
      notes.push({
        key: `review.learnedMore.${count === 1 ? 'one' : 'many'}`,
        params: { name: shown, count: String(count) },
      });
    }
    return notes;
  }
}
