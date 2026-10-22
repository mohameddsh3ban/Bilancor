import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TxStatus } from '../data/models';

const CHIP_CLASSES: Record<TxStatus, string> = {
  booked: 'bg-positive/10 text-positive',
  confirm: 'bg-warning/10 text-warning',
  unclear: 'bg-warning/10 text-warning',
  noReceipt: 'bg-negative/10 text-negative',
};

/** A payment's status as a coloured word (never only an icon). */
@Component({
  selector: 'app-payment-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <span
      class="rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      data-testid="tx-status"
      [class]="chipClasses()"
    >
      {{ 'home.status.' + status() | transloco }}
    </span>
  `,
})
export class PaymentStatusChip {
  readonly status = input.required<TxStatus>();

  protected chipClasses(): string {
    return CHIP_CLASSES[this.status()];
  }
}
