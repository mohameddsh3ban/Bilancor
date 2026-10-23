import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { AppDatePipe } from '../core/format/date.pipe';
import { pluralKey } from '../core/i18n/plural-key';
import { Term } from '../core/i18n/term';
import { addDays } from '../domain/bank-connection';
import type { VatReturnView } from '../domain/vat-return';
import { DemoStateService } from '../state/demo-state.service';
import { TaxService } from '../state/tax.service';
import { SendDialog } from './send-dialog';

/**
 * The card of the VAT tab that sends the open return to the tax office. Its button is one of three: waiting for the
 * period to end (off, with the day it can go), a way to the payments that still need the person, or Send, which opens
 * the dialog that checks the return and sends it. While the open business's return is on its way the button says
 * "Sending…" and is off, even when the dialog was closed in between, so the same return cannot go out twice. The dialog
 * belongs to the business it was opened for: opening another business closes it.
 */
@Component({
  selector: 'app-send-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, HlmButton, HlmCardImports, RouterLink, SendDialog, Term, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <section hlmCard size="sm" data-testid="vat-send">
      <div hlmCardContent class="flex flex-col gap-3">
        @if (view().state === 'inProgress') {
          <button
            hlmBtn
            size="lg"
            type="button"
            disabled
            aria-describedby="vat-send-note"
            data-testid="vat-send-button"
          >
            {{ 'taxes.send.button' | transloco }}
          </button>
          <p id="vat-send-note" class="text-muted-foreground text-sm" data-testid="vat-send-note">
            {{ 'taxes.send.readyFrom' | transloco }}
            <bdi dir="ltr">{{ readyFrom() | appDate }}</bdi>
          </p>
        } @else if (!tax.canSend(view())) {
          <a hlmBtn size="lg" variant="outline" routerLink="/review" data-testid="vat-send-button">
            {{
              plural('taxes.send.fix', view().needsYouCount)
                | transloco: { count: view().needsYouCount }
            }}
          </a>
        } @else {
          <button
            hlmBtn
            size="lg"
            type="button"
            data-testid="vat-send-button"
            [disabled]="tax.sendingOpenBusiness()"
            (click)="dialogOpen.set(true)"
          >
            {{
              (tax.sendingOpenBusiness() ? 'taxes.send.sending' : 'taxes.send.button') | transloco
            }}
          </button>
        }
        <p class="text-muted-foreground text-xs" data-testid="vat-send-via">
          {{ 'taxes.send.via' | transloco }} <app-term key="elster" />
        </p>
      </div>
    </section>

    <app-send-dialog [view]="view()" [(open)]="dialogOpen" />
  `,
})
export class SendCard {
  protected readonly tax = inject(TaxService);
  private readonly demo = inject(DemoStateService);

  /** The return to send: the open business's current one. */
  readonly view = input.required<VatReturnView>();

  protected readonly plural = pluralKey;

  /** The open business's id, a signal of its own: any edit of the business makes a new business object, but not a new id. */
  private readonly businessId = computed(() => this.demo.business().id);

  /** Whether the dialog is open; it closes by itself when another business is opened. */
  protected readonly dialogOpen = linkedSignal<string, boolean>({
    source: this.businessId,
    computation: () => false,
  });

  /** The first day the return can be sent: the day after its period. */
  protected readyFrom(): string {
    return addDays(this.view().period.end, 1);
  }
}
