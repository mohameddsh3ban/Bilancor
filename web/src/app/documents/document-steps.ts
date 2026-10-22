import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { Doc, Transaction } from '../data/models';
import { missingField } from '../domain/document-status';

type StepId = 'read' | 'booked' | 'paid';
type StepState = 'done' | 'current' | 'todo';

interface Step {
  id: StepId;
  /** The text key under `documents.detail.steps`. */
  label: string;
  state: StepState;
  /** The classes that colour the line from the step before (the first step has none): green once that step is done. */
  line: string;
}

/**
 * Where a document is on its way: Read, Booked, Paid. A step is done when nothing is missing from the document, when
 * its booking has a category and is confirmed (the payment's booking once there is a payment), when a payment is
 * linked. The first step that is not done is the current one. A booking that waits for the person reads Confirm, and
 * the last step of an invoice the person sent reads Waiting for payment until it is linked.
 */
@Component({
  selector: 'app-document-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck })],
  host: { class: 'block' },
  template: `
    <ol
      class="flex items-start"
      data-testid="document-steps"
      [attr.aria-label]="'documents.detail.steps.title' | transloco"
    >
      @for (step of steps(); track step.id) {
        <li
          class="relative flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 text-center not-first:before:absolute not-first:before:end-1/2 not-first:before:top-3.5 not-first:before:h-px not-first:before:w-full"
          [class]="step.line"
          [attr.data-testid]="'step-' + step.id"
          [attr.data-state]="step.state"
          [attr.aria-current]="step.state === 'current' ? 'step' : null"
        >
          <span
            class="relative z-10 flex size-7 items-center justify-center rounded-full"
            aria-hidden="true"
            [class]="circleClasses(step.state)"
          >
            @switch (step.state) {
              @case ('done') {
                <ng-icon name="lucideCheck" size="16" />
              }
              @case ('current') {
                <span class="bg-primary size-2.5 rounded-full"></span>
              }
            }
          </span>
          <span
            class="text-xs"
            data-testid="step-label"
            [class]="step.state === 'todo' ? 'text-muted-foreground' : 'font-semibold'"
            >{{ 'documents.detail.steps.' + step.label | transloco }}</span
          >
          @if (step.state === 'done') {
            <span class="sr-only">{{ 'documents.detail.steps.done' | transloco }}</span>
          } @else if (step.state === 'current') {
            <span class="sr-only">{{ 'documents.detail.steps.current' | transloco }}</span>
          }
        </li>
      }
    </ol>
  `,
})
export class DocumentSteps {
  readonly doc = input.required<Doc>();
  /** The payment the document is linked to, if any. */
  readonly payment = input<Transaction | null>(null);

  protected readonly steps = computed<Step[]>(() => {
    const doc = this.doc();
    const payment = this.payment();
    const booking = payment ? payment.booking : doc.booking;
    const confirmed = payment ? payment.confirmed : doc.bookingConfirmed;
    const read = missingField(doc) === null;
    const booked = booking !== null && confirmed;
    const paid = doc.paymentId !== null;
    const done = [read, booked, paid];
    const current = done.indexOf(false);
    const state = (index: number): StepState =>
      done[index] ? 'done' : index === current ? 'current' : 'todo';
    const line = (index: number): string =>
      index > 0 && done[index - 1] ? 'before:bg-positive' : 'before:bg-border';
    return [
      { id: 'read', label: 'read', state: state(0), line: line(0) },
      {
        id: 'booked',
        label: booking !== null && !confirmed ? 'confirm' : 'booked',
        state: state(1),
        line: line(1),
      },
      {
        id: 'paid',
        label: doc.direction === 'sent' && !paid ? 'waiting' : 'paid',
        state: state(2),
        line: line(2),
      },
    ];
  });

  protected circleClasses(state: StepState): string {
    switch (state) {
      case 'done':
        return 'bg-positive text-positive-foreground';
      case 'current':
        return 'bg-card border-primary border-2';
      default:
        return 'bg-card border-border border';
    }
  }
}
