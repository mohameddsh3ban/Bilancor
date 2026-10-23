import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  untracked,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoaderCircle } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { Term, type TermKey } from '../core/i18n/term';
import { DialogCard } from '../core/layout/dialog-card';
import { isolateText } from '../payments/payment-history';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService, type InvoiceEmail } from '../state/invoice.service';
import { invoiceMail, type SendKind } from './invoice-mail';

type Step = 'check' | 'sending' | 'sent';

/** What the "Sent ✓" step tells: what went out, to whom, and for an invoice the number it was given. */
interface Done {
  kind: SendKind;
  to: string;
  number: string | null;
}

/** The look of the message field: a text field that grows with its text. */
const MESSAGE_CLASS =
  'border-input bg-background w-full resize-y rounded-md border px-3 py-2 text-sm leading-relaxed';

/**
 * The pop-up that sends an invoice, or a reminder for one, to the customer by email (simulated). It opens at a check
 * step with what is about to go out: the address, the subject, the file or files that go with it and the message, ready
 * written in the language of the invoice and editable. Nothing is sent until the person presses Send, which starts the
 * wait ("Sending…"); then it says "Sent ✓" (with the number the invoice was given). Cancel, the cross, Escape and a tap
 * outside close it at the check step and send nothing.
 *
 * Closing it while it sends does not stop the email: it is recorded all the same, and the page behind says "Sending…"
 * until then. When nothing went out after all (Reset demo came in during the wait, or the invoice stopped being
 * sendable), it closes without a word: there is nothing to report.
 */
@Component({
  selector: 'app-invoice-send-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogCard, HlmButton, HlmDialogImports, NgIcon, Term, TranslocoPipe],
  viewProviders: [provideIcons({ lucideLoaderCircle })],
  // Not displayed: the dialog shows through the overlay, so nothing of this element belongs in the page's column.
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
        data-testid="invoice-send-dialog"
        [closeLabel]="'invoices.send.close' | transloco"
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
            @if (mail(); as mail) {
              <dl class="flex flex-col gap-3 text-sm">
                @if (kind() !== 'invoice') {
                  <div class="flex flex-col gap-0.5">
                    <dt class="text-muted-foreground text-xs">
                      {{ 'invoices.send.type' | transloco }}
                    </dt>
                    <dd class="font-medium" data-testid="send-kind">
                      <app-term [key]="termKey()" />
                    </dd>
                  </div>
                }
                <div class="flex flex-col gap-0.5">
                  <dt class="text-muted-foreground text-xs">
                    {{ 'invoices.send.to' | transloco }}
                  </dt>
                  <dd class="font-medium wrap-break-word">
                    <bdi dir="ltr" data-testid="send-to">{{ mail.to }}</bdi>
                  </dd>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-muted-foreground text-xs">
                    {{ 'invoices.send.subject' | transloco }}
                  </dt>
                  <dd
                    class="font-medium wrap-break-word rtl:text-end"
                    dir="ltr"
                    data-testid="send-subject"
                    [lang]="mail.lang"
                  >
                    {{ mail.subject }}
                  </dd>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-muted-foreground text-xs">
                    {{ 'invoices.send.attachment' | transloco }}
                  </dt>
                  <dd class="flex flex-col gap-0.5 font-medium" data-testid="send-attachment">
                    <span
                      ><bdi dir="ltr">{{ mail.number }}.pdf</bdi></span
                    >
                    @if (mail.format === 'zugferd') {
                      <span>+ <app-term key="zugferd" /></span>
                    }
                    @if (mail.format === 'xrechnung') {
                      <span>
                        + <bdi dir="ltr">{{ mail.number }}.xml</bdi> <app-term key="xrechnung" />
                      </span>
                    }
                  </dd>
                </div>
              </dl>

              <label class="flex flex-col gap-1 text-sm">
                <span class="text-muted-foreground text-xs">
                  {{ 'invoices.send.message' | transloco }}
                </span>
                <textarea
                  rows="9"
                  dir="ltr"
                  data-testid="send-message"
                  [class]="messageClass"
                  [lang]="mail.lang"
                  [value]="message()"
                  (input)="onMessage($event)"
                ></textarea>
              </label>
            }

            <hlm-dialog-footer>
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="min-h-10"
                data-testid="send-cancel"
                (click)="close()"
              >
                {{ 'invoices.send.cancel' | transloco }}
              </button>
              @if (mail()) {
                <button
                  hlmBtn
                  type="button"
                  class="min-h-10"
                  data-testid="send-confirm"
                  [disabled]="invoices.sending() !== null"
                  (click)="send()"
                >
                  {{ 'invoices.send.confirm' | transloco }}
                </button>
              }
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
              {{ 'invoices.send.onItsWay' | transloco: { email: isolate(mail()?.to ?? '') } }}
            </p>
          }
          @case ('sent') {
            @if (sent(); as done) {
              <p data-testid="send-done">
                {{
                  (done.kind === 'invoice'
                    ? 'invoices.send.doneInvoice'
                    : 'invoices.send.doneReminder'
                  ) | transloco: { email: isolate(done.to) }
                }}
              </p>
              @if (done.number; as number) {
                <dl class="flex items-baseline justify-between gap-3">
                  <dt class="text-muted-foreground">{{ 'invoices.send.number' | transloco }}</dt>
                  <dd class="font-medium">
                    <bdi dir="ltr" data-testid="send-number">{{ number }}</bdi>
                  </dd>
                </dl>
              }

              <hlm-dialog-footer>
                <button
                  hlmBtn
                  type="button"
                  class="min-h-10"
                  data-testid="send-close"
                  (click)="close()"
                >
                  {{ 'invoices.send.close' | transloco }}
                </button>
              </hlm-dialog-footer>
            }
          }
        }
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class InvoiceSendDialog {
  protected readonly invoices = inject(InvoiceService);
  private readonly demo = inject(DemoStateService);
  private readonly injector = inject(EnvironmentInjector);
  private destroyed = false;

  /** The invoice the email is about: the draft to send, or the sent invoice to remind. */
  readonly invoiceId = input.required<string>();
  /** What goes out: the invoice, the friendly reminder or the formal one. */
  readonly kind = input.required<SendKind>();
  /** Whether the dialog is open. */
  readonly open = model.required<boolean>();

  private readonly title = viewChild<ElementRef<HTMLElement>>('title');

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  /** The email as it would go out now; null when the invoice is not there. It is only read at the check step (and for the address while sending): the other steps never look at it again. */
  protected readonly mail = computed(() => {
    const business = this.demo.business();
    const invoice = business.invoices.find((i) => i.id === this.invoiceId());
    return invoice ? invoiceMail(this.kind(), invoice, business) : null;
  });

  /** One id for what the dialog is open for, a signal of its own: it changes when the dialog opens or closes, and not when the invoice does. */
  private readonly openFor = computed(() =>
    this.open() ? `${this.invoiceId()}|${this.kind()}` : null,
  );

  /** The message: the ready-written text each time the dialog opens, then what the person typed. It is not written again when the invoice changes under it. */
  protected readonly message = linkedSignal<string | null, string>({
    source: this.openFor,
    computation: () => untracked(this.mail)?.body ?? '',
  });

  /**
   * What was sent, once it has been. It is forgotten when the dialog opens again, so it always starts at the check
   * step, but kept while the dialog fades out so that it does not fall back to the check step in front of the eyes.
   */
  protected readonly sent = linkedSignal<boolean, Done | null>({
    source: this.open,
    computation: (open, previous) => (open ? null : (previous?.value ?? null)),
  });

  protected readonly step = computed<Step>(() => {
    if (this.sent() !== null) return 'sent';
    return this.invoices.sending() === this.invoiceId() ? 'sending' : 'check';
  });
  protected readonly titleKey = computed(() => {
    const step = this.step();
    return step === 'check' ? `invoices.send.title.${this.kind()}` : `invoices.send.title.${step}`;
  });
  /** The German term of the reminder being sent. */
  protected readonly termKey = computed<TermKey>(() =>
    this.kind() === 'reminder2' ? 'mahnung' : 'zahlungserinnerung',
  );
  protected readonly messageClass = MESSAGE_CLASS;
  protected readonly isolate = isolateText;

  /** The cross, Escape and a tap outside close the dialog by themselves; it follows. */
  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') this.open.set(false);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onMessage(event: Event): void {
    this.message.set((event.target as HTMLTextAreaElement).value);
  }

  /**
   * Sends the email and waits for it. The cursor goes to the title at each change, since the button it was on is gone
   * by then. When nothing was sent the dialog closes without a word; when the page was left meanwhile there is nothing to tell.
   */
  protected async send(): Promise<void> {
    const mail = this.mail();
    if (!mail) return;
    const id = this.invoiceId();
    const kind = this.kind();
    const email: InvoiceEmail = { to: mail.to, subject: mail.subject, body: this.message() };
    const pending =
      kind === 'invoice'
        ? this.invoices.send(id, email)
        : this.invoices.remind(id, kind === 'reminder1' ? 1 : 2, email);
    this.focusTitle();
    const ok = await pending;
    if (this.destroyed) return;
    if (!ok) {
      this.open.set(false);
      return;
    }
    // The number it was given when the time was up, which is the next free one by then.
    const given =
      kind === 'invoice'
        ? (this.demo.business().invoices.find((i) => i.id === id)?.number ?? mail.number)
        : null;
    this.sent.set({ kind, to: mail.to, number: given });
    this.focusTitle();
  }

  /** After the next render. It is the app's injector that is asked: the page may have been left before the answer came, and a destroyed view cannot take new hooks. */
  private focusTitle(): void {
    afterNextRender(() => this.title()?.nativeElement.focus(), { injector: this.injector });
  }
}
