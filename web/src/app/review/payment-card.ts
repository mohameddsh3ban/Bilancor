import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { ReviewItem } from '../domain/review-queue';
import { DemoStateService } from '../state/demo-state.service';
import { ReviewCard } from './review-card';

/** A payment waiting for the person's decision. */
export type PaymentItem = Extract<ReviewItem, { kind: 'payment' }>;

/** The review card of a payment: the frame with the payment's basics. The questions and answers come next. */
@Component({
  selector: 'app-payment-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReviewCard],
  host: { class: 'block' },
  template: `
    <app-review-card
      [kindKey]="'review.kind.' + item().problem"
      [amountCents]="payment()?.amountCents ?? null"
      [signed]="true"
      [name]="payment()?.counterparty ?? ''"
      [date]="item().date"
    />
  `,
})
export class PaymentCard {
  private readonly demo = inject(DemoStateService);

  readonly item = input.required<PaymentItem>();

  protected readonly payment = computed(() =>
    this.demo.business().transactions.find((tx) => tx.id === this.item().id),
  );
}
