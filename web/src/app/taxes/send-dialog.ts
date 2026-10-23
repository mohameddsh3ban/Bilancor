import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EnvironmentInjector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoaderCircle } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { MoneyPipe } from '../core/format/money.pipe';
import { AppTaxPeriodPipe } from '../core/format/tax-period.pipe';
import { Term } from '../core/i18n/term';
import { DialogCard } from '../core/layout/dialog-card';
import type { SentVatReturn } from '../data/models';
import { resultWording, sentPeriod, type VatReturnView } from '../domain/vat-return';
import { TaxService } from '../state/tax.service';

type Step = 'check' | 'sending' | 'sent';

/** Stands where the term goes in a translated sentence, so the term can be a button of its own with its explanation. */
const TERM_MARK = '\u0001';

/** The translation key of the title at each step. */
const TITLE_KEY: Record<Step, string> = {
  check: 'taxes.send.button',
  sending: 'taxes.send.sending',
  sent: 'taxes.send.sent',
};

/**
 * The pop-up that sends a VAT return to the tax office (simulated). It opens at a check step with what is about to go
 * out; Send starts the wait ("Sending…"), and when the return has arrived it says "Sent ✓" with the transfer ticket and
 * a way to print the receipt. Cancel, the cross, Escape and a tap outside close it at the check step and send nothing.
 *
 * Closing it while it sends does not stop the return: it is recorded all the same and shows up in "Sent earlier". It says
 * "Sending…" only when the return on its way is the open business's. When nothing was sent after all (Reset demo came in
 * during the wait), it is back at the check step, without a word about it: there is nothing to report.
 */
@Component({
  selector: 'app-send-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppTaxPeriodPipe,
    DialogCard,
    HlmButton,
    HlmDialogImports,
    MoneyPipe,
    NgIcon,
    RouterLink,
    Term,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideLoaderCircle })],
  host: { class: 'contents' },
  template: `
    <hlm-dialog
      [state]="open() ? 'open' : 'closed'"
      autoFocus="dialog"
      (stateChanged)="onStateChanged($event)"
    >
      <hlm-dialog-content
        *hlmDialogPortal
        appDialogCard
        data-testid="send-dialog"
        [closeLabel]="'taxes.send.dialog.close' | transloco"
      >
        <hlm-dialog-header class="pe-8">
          <h2
            #title
            hlmDialogTitle
            tabindex="-1"
            class="text-lg leading-snug font-semibold outline-none"
            data-testid="send-title"
          >
            {{ titleKey() | transloco }}
          </h2>
        </hlm-dialog-header>

        @switch (step()) {
          @case ('check') {
            <dl class="flex flex-col gap-3">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-muted-foreground">{{ 'taxes.send.period' | transloco }}</dt>
                <dd class="font-medium" data-testid="send-period">
                  {{ view().period | appTaxPeriod }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-3" data-testid="send-charged">
                <dt class="min-w-0"><app-term key="umsatzsteuer" /></dt>
                <dd class="font-medium">
                  <bdi dir="ltr" data-testid="send-charged-amount">{{
                    view().chargedCents | money
                  }}</bdi>
                </dd>
              </div>
              <div class="flex items-start justify-between gap-3" data-testid="send-paid">
                <dt class="min-w-0"><app-term key="vorsteuer" /></dt>
                <dd class="font-medium">
                  <bdi dir="ltr" data-testid="send-paid-amount">{{ view().paidCents | money }}</bdi>
                </dd>
              </div>
              <div
                class="border-border flex items-baseline justify-between gap-3 border-t pt-3 font-semibold"
              >
                <dt data-testid="send-result-label">
                  {{ 'taxes.how.' + result().key | transloco }}
                </dt>
                <dd>
                  <bdi dir="ltr" data-testid="send-result-amount">{{ result().cents | money }}</bdi>
                </dd>
              </div>
            </dl>

            @let via = ('taxes.send.dialog.via' | transloco: { term: termMark }).split(termMark);
            <p class="text-muted-foreground text-sm" data-testid="send-via">
              {{ via[0] }}<app-term key="elster" />{{ via[1] }}
            </p>

            <hlm-dialog-footer>
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="min-h-10"
                data-testid="send-cancel"
                (click)="close()"
              >
                {{ 'taxes.send.dialog.cancel' | transloco }}
              </button>
              <button
                hlmBtn
                type="button"
                class="min-h-10"
                data-testid="send-confirm"
                [disabled]="tax.sending() || !tax.canSend(view())"
                (click)="send()"
              >
                {{ 'taxes.send.dialog.confirm' | transloco }}
              </button>
            </hlm-dialog-footer>
          }
          @case ('sending') {
            <p
              class="text-muted-foreground flex items-center gap-3 text-sm"
              data-testid="send-sending"
            >
              <ng-icon
                name="lucideLoaderCircle"
                size="20"
                class="text-primary shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {{ 'taxes.send.dialog.sending' | transloco }}
            </p>
          }
          @case ('sent') {
            @if (sent(); as done) {
              <p data-testid="send-done">
                {{
                  'taxes.send.dialog.done' | transloco: { period: (periodOf(done) | appTaxPeriod) }
                }}
              </p>
              <dl class="flex items-baseline justify-between gap-3">
                <dt class="text-muted-foreground">{{ 'taxes.send.ticket' | transloco }}</dt>
                <dd class="font-medium">
                  <bdi dir="ltr" data-testid="send-ticket">{{ done.ticket }}</bdi>
                </dd>
              </dl>

              <hlm-dialog-footer>
                <a
                  hlmBtn
                  variant="outline"
                  class="min-h-10"
                  data-testid="send-print"
                  [routerLink]="['/print/vat-return', done.periodStart]"
                >
                  {{ 'taxes.send.dialog.receipt' | transloco }}
                </a>
                <button
                  hlmBtn
                  type="button"
                  class="min-h-10"
                  data-testid="send-close"
                  (click)="close()"
                >
                  {{ 'taxes.send.dialog.close' | transloco }}
                </button>
              </hlm-dialog-footer>
            }
          }
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class SendDialog {
  protected readonly tax = inject(TaxService);
  private readonly injector = inject(EnvironmentInjector);

  /** The return to check: the open business's current one. Only read at the check step; the other steps never look at it again. */
  readonly view = input.required<VatReturnView>();
  /** Whether the dialog is open. */
  readonly open = model.required<boolean>();

  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  /**
   * The return that has arrived at the tax office, once it has. It is forgotten when the dialog opens again, so it always
   * starts at the check step, but kept while the dialog fades out so that it does not fall back to the check step in front of the eyes.
   */
  protected readonly sent = linkedSignal<boolean, SentVatReturn | null>({
    source: this.open,
    computation: (open, previous) => (open ? null : (previous?.value ?? null)),
  });

  protected readonly step = computed<Step>(() => {
    if (this.sent() !== null) return 'sent';
    return this.tax.sendingOpenBusiness() ? 'sending' : 'check';
  });
  protected readonly titleKey = computed(() => TITLE_KEY[this.step()]);

  protected readonly result = computed(() => resultWording(this.view()));
  protected readonly termMark = TERM_MARK;
  protected readonly periodOf = sentPeriod;

  /** The cross, Escape and a tap outside close the dialog by themselves; it follows. */
  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') this.open.set(false);
  }

  protected close(): void {
    this.open.set(false);
  }

  /**
   * Sends the return and waits for it. The cursor goes to the title at each change, since the button it was on is gone by then.
   * Nothing is said when nothing was sent: the dialog is at the check step again.
   */
  protected async send(): Promise<void> {
    const pending = this.tax.send();
    this.focusTitle();
    const sent = await pending;
    if (sent !== null) this.sent.set(sent);
    this.focusTitle();
  }

  /** After the next render. It is the app's injector that is asked: the page may have been left before the answer came, and a destroyed view cannot take new hooks. */
  private focusTitle(): void {
    afterNextRender(() => this.title()?.nativeElement.focus(), { injector: this.injector });
  }
}
