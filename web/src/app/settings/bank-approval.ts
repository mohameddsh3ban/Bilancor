import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { BankTile } from './bank-tile';

/**
 * The bank's sign-in as the demo shows it (screen 3 of the bank flow, and what Renew and Sign in again run): a clearly
 * marked DEMO page with the bank's tile, what the app wants to read, and Approve or Cancel. There is no field on it and
 * no bank behind it. `note` is a line the parent may add (the demo's explanation, already translated).
 */
@Component({
  selector: 'app-bank-approval',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BankTile, HlmButton, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section
      class="border-warning bg-card flex flex-col overflow-hidden rounded-xl border-2 border-dashed"
      data-testid="bank-approval"
    >
      <p
        class="bg-warning text-warning-foreground px-4 py-2 text-center text-sm font-semibold tracking-wide"
        data-testid="demo-label"
      >
        {{ 'bankConnect.approval.demo' | transloco }}
      </p>
      <div class="flex flex-col items-center gap-4 p-6 text-center">
        <app-bank-tile data-testid="bank-tile" size="lg" [name]="bankName()" />
        <p class="text-lg font-semibold" data-testid="approval-bank">
          <bdi dir="auto">{{ bankName() }}</bdi>
        </p>
        <p data-testid="approval-sentence">{{ 'bankConnect.approval.sentence' | transloco }}</p>
        @if (note(); as text) {
          <p class="text-muted-foreground text-sm" role="note" data-testid="approval-note">{{ text }}</p>
        }
        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button hlmBtn size="lg" type="button" data-testid="approve" (click)="approved.emit()">
            {{ 'bankConnect.approval.approve' | transloco }}
          </button>
          <button
            hlmBtn
            variant="outline"
            size="lg"
            type="button"
            data-testid="cancel"
            (click)="cancelled.emit()"
          >
            {{ 'bankConnect.approval.cancel' | transloco }}
          </button>
        </div>
      </div>
    </section>
  `,
})
export class BankApproval {
  readonly bankName = input.required<string>();
  /** A line under the sentence, or null for none. */
  readonly note = input<string | null>(null);
  readonly approved = output<void>();
  readonly cancelled = output<void>();
}
