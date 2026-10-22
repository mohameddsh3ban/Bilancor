import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import type { Doc, DocDirection } from '../data/models';
import { editDocument, keepDuplicate, setDirection } from '../domain/document-actions';
import { docName } from '../domain/document-status';
import type { ReviewItem } from '../domain/review-queue';
import { DocumentPaper } from '../documents/document-paper';
import { type DocChanges, parseDocAmount } from '../documents/document-edit-form';
import { DemoStateService } from '../state/demo-state.service';
import { ReviewService, type ReviewAnswerResult } from '../state/review.service';
import { ANSWERS_CLASS, ReviewCard } from './review-card';

/** A document waiting for the person's decision. */
export type DocumentItem = Extract<ReviewItem, { kind: 'document' }>;

const INPUT_CLASS =
  'border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 aria-invalid:border-negative h-10 w-full rounded-md border px-3 text-base outline-none focus-visible:ring-3';

/** The three fields reading can fail to find, by the problem that asks for them. */
const FIELD_OF = {
  checkAmount: { key: 'amount', labelKey: 'documents.detail.fields.amount' },
  checkDate: { key: 'date', labelKey: 'documents.detail.fields.date' },
  checkName: { key: 'name', labelKey: 'documents.detail.fields.name' },
} as const;

/**
 * The review card of a document: the frame with the document's basics, the drawn paper with the unclear spot marked,
 * the one question its problem asks and the answers to it. A possible duplicate is kept or removed, a direction is
 * answered, and a field that could not be read is typed in on the card (Save waits until what is typed is usable).
 * Every answer uses the same actions as the Documents page, goes through `ReviewService.answer` and ticks.
 *
 * The question follows the problem the stage hands over (`item().problem`): a document with two problems keeps this
 * card, and after the first answer it asks the next one.
 */
@Component({
  selector: 'app-document-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, DocumentPaper, HlmButton, ReviewCard, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <app-review-card
      [kindKey]="'review.kind.' + item().problem"
      [amountCents]="doc()?.amountCents ?? null"
      [name]="doc() ? name(doc()!) : ''"
      [date]="doc()?.date ?? null"
    >
      @if (doc(); as current) {
        <app-document-paper [doc]="current" />
        @switch (item().problem) {
          @case ('duplicate') {
            <p class="text-lg font-semibold" data-testid="card-question">
              @if (original(); as original) {
                {{
                  'documents.needsYou.duplicate' | transloco: { date: (original.addedOn | appDate) }
                }}
              } @else {
                {{ 'documents.needsYou.duplicateUnknown' | transloco }}
              }
            </p>
            <div [class]="answersClass">
              <button hlmBtn size="lg" type="button" data-testid="answer-keep" (click)="keepBoth()">
                {{ 'documents.needsYou.fix.keepBoth' | transloco }}
              </button>
              @if (current.paymentId === null) {
                <button
                  hlmBtn
                  size="lg"
                  type="button"
                  variant="outline"
                  data-testid="answer-remove"
                  (click)="remove()"
                >
                  {{ 'review.a.removeThis' | transloco }}
                </button>
              }
            </div>
          }
          @case ('direction') {
            <p class="text-lg font-semibold" data-testid="card-question">
              {{ 'documents.needsYou.direction' | transloco }}
            </p>
            <div [class]="answersClass">
              <button
                hlmBtn
                size="lg"
                type="button"
                data-testid="answer-received"
                (click)="markDirection('received')"
              >
                {{ 'documents.direction.received' | transloco }}
              </button>
              <button
                hlmBtn
                size="lg"
                type="button"
                variant="outline"
                data-testid="answer-sent"
                (click)="markDirection('sent')"
              >
                {{ 'documents.direction.sent' | transloco }}
              </button>
            </div>
          }
          @default {
            <form
              class="flex flex-col gap-3"
              novalidate
              data-testid="field-form"
              (submit)="save($event)"
            >
              <p class="text-lg font-semibold" data-testid="card-question">
                {{ 'documents.needsYou.' + item().problem | transloco }}
              </p>
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-muted-foreground" data-testid="field-label">
                  {{ field().labelKey | transloco }}
                </span>
                @switch (field().key) {
                  @case ('amount') {
                    <input
                      type="text"
                      inputmode="decimal"
                      dir="ltr"
                      data-testid="field-amount"
                      [class]="inputClass"
                      [value]="typed()"
                      [attr.aria-invalid]="amountError() ? 'true' : null"
                      [attr.aria-describedby]="amountError() ? 'field-error' : null"
                      (input)="type($event)"
                    />
                  }
                  @case ('date') {
                    <input
                      type="date"
                      dir="ltr"
                      data-testid="field-date"
                      [class]="inputClass"
                      [value]="typed()"
                      (input)="type($event)"
                    />
                  }
                  @default {
                    <input
                      type="text"
                      dir="auto"
                      data-testid="field-name"
                      [class]="inputClass"
                      [value]="typed()"
                      (input)="type($event)"
                    />
                  }
                }
              </label>
              @if (amountError()) {
                <p
                  class="text-negative -mt-1 text-xs"
                  id="field-error"
                  role="alert"
                  data-testid="field-error"
                >
                  {{ 'documents.detail.fix.amountError' | transloco }}
                </p>
              }
              <div [class]="answersClass">
                <button
                  hlmBtn
                  size="lg"
                  type="submit"
                  data-testid="answer-save"
                  [disabled]="!usable()"
                >
                  {{ 'documents.detail.fix.save' | transloco }}
                </button>
              </div>
            </form>
          }
        }
      }
    </app-review-card>
  `,
})
export class DocumentCard {
  private readonly demo = inject(DemoStateService);
  private readonly review = inject(ReviewService);

  readonly item = input.required<DocumentItem>();

  private readonly frame = viewChild(ReviewCard);

  protected readonly answersClass = ANSWERS_CLASS;
  protected readonly inputClass = INPUT_CLASS;
  protected readonly name = docName;

  /**
   * The document as it was last seen. An answer can take the document away ("Remove this one"), and the card is still on
   * screen with its tick for a moment after that, so it keeps showing what it knew.
   */
  protected readonly doc = linkedSignal<Doc | undefined, Doc | undefined>({
    source: () => this.demo.documents().find((d) => d.id === this.item().id),
    computation: (found, previous) => found ?? previous?.value,
  });

  /** The document this one looks like, when it is still there. */
  protected readonly original = computed(() => {
    const id = this.doc()?.duplicateOf;
    return id ? this.demo.documents().find((d) => d.id === id) : undefined;
  });

  /** The field a "check" problem asks for (the amount when it is not one: the form is only shown for those). */
  protected readonly field = computed(() => {
    const problem = this.item().problem;
    return problem === 'checkDate'
      ? FIELD_OF.checkDate
      : problem === 'checkName'
        ? FIELD_OF.checkName
        : FIELD_OF.checkAmount;
  });

  /** What is typed in the field. It starts empty for every problem, so what was typed for one never lands in the next. */
  protected readonly typed = linkedSignal<string, string>({
    source: () => `${this.item().id}:${this.item().problem}`,
    computation: () => '',
  });

  /** Whether what is typed can be saved: an amount above 0, a date, a name that is not blank. */
  protected readonly usable = computed(() => {
    switch (this.field().key) {
      case 'amount':
        return parseDocAmount(this.typed()) !== null;
      case 'date':
        return this.typed() !== '';
      case 'name':
        return this.typed().trim() !== '';
    }
  });

  /** Something is typed in the amount field, but it is not an amount. */
  protected readonly amountError = computed(
    () => this.field().key === 'amount' && this.typed().trim() !== '' && !this.usable(),
  );

  protected type(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  // Each answer changes the document only while it still applies, so a double tap never writes a second history line.

  protected keepBoth(): void {
    const doc = this.doc();
    if (!doc) return;
    this.answer(
      () =>
        this.demo.updateDocument(doc.id, (d) => (d.duplicateOf !== null ? keepDuplicate(d) : d)),
      { labelKey: 'review.result.keptBoth' },
    );
  }

  protected remove(): void {
    const doc = this.doc();
    if (!doc) return;
    this.answer(() => this.demo.removeDocument(doc.id), {
      labelKey: 'review.result.removed',
      counts: 'duplicateRemoved',
    });
  }

  protected markDirection(direction: DocDirection): void {
    const doc = this.doc();
    if (!doc) return;
    this.answer(
      () =>
        this.demo.updateDocument(doc.id, (d) =>
          d.direction === null ? setDirection(d, direction) : d,
        ),
      { labelKey: `review.result.${direction}` },
    );
  }

  /** Saves what is typed as the amount, date or name the problem asks for. */
  protected save(event: Event): void {
    event.preventDefault();
    const doc = this.doc();
    if (!doc || !this.usable()) return;
    const typed = this.typed();
    const { key } = this.field();
    const changes: DocChanges =
      key === 'amount'
        ? { amountCents: parseDocAmount(typed)! }
        : key === 'date'
          ? { date: typed }
          : { name: typed.trim() };
    this.answer(() => this.demo.updateDocument(doc.id, (d) => editDocument(d, changes)), {
      labelKey: `review.result.${key}Saved`,
    });
  }

  /** Answers the current decision with `apply`, and ticks in the same breath, as the card frame asks. */
  private answer(apply: () => void, result: ReviewAnswerResult): void {
    void this.review.answer(apply, result);
    this.frame()?.showTick(result.labelKey);
  }
}
