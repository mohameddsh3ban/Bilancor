import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { Term } from '../core/i18n/term';
import { DialogCard } from '../core/layout/dialog-card';
import type { Transaction } from '../data/models';
import type { SelfIssuedInput } from '../domain/self-issued';
import { SelfIssuedForm } from '../payments/self-issued-form';

/**
 * The pop-up that writes a self-issued receipt on top of a review card: the same form as the page of its own (see `SelfIssuedForm`),
 * with the pop-up's title. A complete form is handed to the card (`created`), which writes the receipt and answers itself; Cancel, the
 * cross, Escape and a tap outside close the pop-up and change nothing. The form opens empty each time the pop-up opens.
 */
@Component({
  selector: 'app-self-issued-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogCard, HlmDialogImports, SelfIssuedForm, Term, TranslocoPipe],
  // Not displayed: the dialog shows through the overlay, so nothing of this element belongs in the card.
  host: { hidden: '' },
  template: `
    <hlm-dialog
      [state]="open() ? 'open' : 'closed'"
      autoFocus="dialog"
      (stateChanged)="onStateChanged($event)"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        appDialogCard
        data-testid="self-issued-dialog"
        [closeLabel]="'selfIssued.close' | transloco"
      >
        <app-self-issued-form
          [payment]="payment()"
          (created)="created.emit($event)"
          (cancelled)="open.set(false)"
        >
          <h2
            hlmDialogTitle
            appSelfIssuedTitle
            class="pe-8 text-lg leading-snug font-semibold [&_button]:text-start"
            data-testid="form-title"
          >
            <app-term key="eigenbeleg" />
          </h2>
        </app-self-issued-form>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class SelfIssuedDialog {
  /** The payment the receipt is for. */
  readonly payment = input.required<Transaction>();
  /** Whether the pop-up is open. */
  readonly open = model.required<boolean>();
  /** The form is complete and the person pressed Create receipt: what they filled in. The card closes the pop-up. */
  readonly created = output<SelfIssuedInput>();

  /** The cross, Escape and a tap outside close the pop-up by themselves; it follows. */
  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') this.open.set(false);
  }
}
