import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { Term, TermKey } from '../core/i18n/term';
import { Booking, Doc, Transaction } from '../data/models';
import { vatRateShown } from '../domain/tax-rules';
import { DemoStateService } from '../state/demo-state.service';
import { DocumentEditForm } from './document-edit-form';

/** A booking with no category, to ask what VAT to show for a document that has none yet. */
const NO_BOOKING: Booking = { skr03: '', nameDe: '', labelKey: '', vatRate: 0 };

/**
 * What reading found in a document (type, from and to, invoice number, date, amount, VAT, due date), the note on why
 * it was filed as received or sent, and Edit, which swaps the list for the edit form. The form closes when another
 * document is shown, and there is nothing to edit while the document is still being read, for the document of an
 * invoice written in Invoices, or for a self-issued receipt (both are locked).
 */
@Component({
  selector: 'app-document-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, DocumentEditForm, HlmButton, MoneyPipe, Term, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section class="flex flex-col gap-3" data-testid="fields-section">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-muted-foreground text-sm font-medium">
          {{ 'documents.detail.fields.title' | transloco }}
        </h2>
        @if (!editing() && !doc().reading && doc().invoice === null && doc().selfIssued === null) {
          <button
            #editButton
            hlmBtn
            variant="outline"
            size="sm"
            type="button"
            data-testid="edit-fields"
            (click)="startEdit()"
          >
            {{ 'documents.detail.fields.edit' | transloco }}
          </button>
        }
      </div>

      @if (editing()) {
        <app-document-edit-form [doc]="doc()" (done)="stopEditing()" />
      } @else {
        <dl class="flex flex-col gap-3 text-sm">
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.direction' | transloco }}
            </dt>
            <dd class="font-medium" data-testid="field-type">
              @if (doc().direction) {
                <app-term [key]="termKey()" />
              } @else {
                —
              }
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.parties' | transloco }}
            </dt>
            <dd class="flex flex-wrap items-center gap-x-2 font-medium" data-testid="field-parties">
              @if (parties(); as pair) {
                <span class="min-w-0 wrap-break-word" dir="auto" data-testid="party-from">{{
                  pair.from
                }}</span>
                <span class="text-muted-foreground inline-block rtl:rotate-180" aria-hidden="true"
                  >→</span
                >
                <span class="min-w-0 wrap-break-word" dir="auto" data-testid="party-to">{{
                  pair.to
                }}</span>
              } @else {
                <span class="min-w-0 wrap-break-word" dir="auto" data-testid="party-from">{{
                  doc().name ?? '—'
                }}</span>
              }
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.invoiceNo' | transloco }}
            </dt>
            <dd class="font-medium wrap-break-word">
              <bdi dir="ltr"
                ><span data-testid="field-invoice">{{ doc().invoiceNo || '—' }}</span></bdi
              >
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">{{ 'documents.detail.fields.date' | transloco }}</dt>
            <dd class="font-medium" data-testid="field-date">
              @if (doc().date; as date) {
                {{ date | appDate: { year: true } }}
              } @else {
                —
              }
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.amount' | transloco }}
            </dt>
            <dd class="font-medium">
              <bdi dir="ltr">
                <span data-testid="field-amount">
                  @let amount = doc().amountCents;
                  @if (amount !== null) {
                    {{ amount | money }}
                  } @else {
                    —
                  }
                </span>
              </bdi>
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">{{ 'documents.detail.fields.vat' | transloco }}</dt>
            <dd class="font-medium" data-testid="field-vat">
              @if (vat(); as shown) {
                <bdi dir="ltr">{{
                  'payments.detail.booking.vatRate' | transloco: { rate: shown.rate }
                }}</bdi>
                @if (shown.cents !== null) {
                  ·
                  <bdi dir="ltr">{{ shown.cents | money }}</bdi>
                }
              } @else {
                {{ 'payments.detail.booking.noVat' | transloco }}
              }
              @if (kleinunternehmer()) {
                <span class="text-muted-foreground block text-xs font-normal">
                  <app-term key="kleinunternehmer" />
                </span>
              }
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-muted-foreground">
              {{ 'documents.detail.fields.dueDate' | transloco }}
            </dt>
            <dd class="font-medium" data-testid="field-due">
              @if (doc().dueDate; as due) {
                {{ due | appDate: { year: true } }}
              } @else {
                —
              }
            </dd>
          </div>
        </dl>
        @if (doc().direction; as direction) {
          @if (!directionChosen()) {
            <p class="text-muted-foreground text-xs" data-testid="why-note">
              {{ 'documents.detail.why.' + direction | transloco }}
            </p>
          }
        }
      }
    </section>
  `,
})
export class DocumentFields {
  private readonly demo = inject(DemoStateService);
  private readonly injector = inject(Injector);

  readonly doc = input.required<Doc>();
  /** The payment the document is linked to, if any: its booking is the one the document is booked with. */
  readonly payment = input<Transaction | null>(null);

  private readonly editButton = viewChild<ElementRef<HTMLElement>>('editButton');

  /** Whether the edit form is open. It belongs to the document it was opened for: another document starts closed. */
  protected readonly editing = linkedSignal<string, boolean>({
    source: () => this.doc().id,
    computation: () => false,
  });

  protected readonly kleinunternehmer = computed(
    () => this.demo.business().taxProfile.kleinunternehmer,
  );
  /** Whether the person chose the direction (on the Needs-you card or in Edit): then it was not "set" by reading, so there is no why-note. */
  protected readonly directionChosen = computed(() =>
    this.doc().history.some((h) => h.key === 'markedReceived' || h.key === 'markedSent'),
  );
  protected readonly termKey = computed<TermKey>(() =>
    this.doc().direction === 'received' ? 'eingangsbeleg' : 'ausgangsbeleg',
  );

  /** Who it is from and to: the other party and the person's own business, in the order of the direction. */
  protected readonly parties = computed(() => {
    const doc = this.doc();
    const other = doc.name ?? '—';
    const own = this.demo.business().name;
    if (doc.direction === 'received') return { from: other, to: own };
    return doc.direction === 'sent' ? { from: own, to: other } : null;
  });

  /** The VAT to show, or null for "no VAT" (always so for a Kleinunternehmer). The amount is the share of the gross total. */
  protected readonly vat = computed(() => {
    const doc = this.doc();
    const booking = this.payment()?.booking ?? doc.booking ?? NO_BOOKING;
    const rate = vatRateShown(this.demo.business().taxProfile, {
      ...booking,
      vatRate: doc.vatRate,
    });
    if (rate === null) return null;
    const cents =
      doc.amountCents === null ? null : Math.round((doc.amountCents * rate) / (100 + rate));
    return { rate, cents };
  });

  protected startEdit(): void {
    this.editing.set(true);
  }

  /** The form is done (saved or cancelled): the list is back, and the cursor returns to Edit. */
  protected stopEditing(): void {
    this.editing.set(false);
    afterNextRender(() => this.editButton()?.nativeElement.focus(), { injector: this.injector });
  }
}
