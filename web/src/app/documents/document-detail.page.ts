import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { map } from 'rxjs';
import { MoneyPipe } from '../core/format/money.pipe';
import { Booking, Doc, DocField, Transaction } from '../data/models';
import { changeDocCategory, confirmDocBooking, editDocument } from '../domain/document-actions';
import { missingField, visibleDocuments } from '../domain/document-status';
import { changeCategory, confirmBooking } from '../domain/payment-actions';
import { DemoStateService } from '../state/demo-state.service';
import { BookingLabel } from '../payments/booking-label';
import { CategoryPicker } from '../payments/category-picker';
import { PaymentHistory } from '../payments/payment-history';
import { DocChanges, parseDocAmount } from './document-edit-form';
import { DocumentFields } from './document-fields';
import { DocumentPaper } from './document-paper';
import { DocumentPayment } from './document-payment';
import { DocumentStatusChip } from './document-status-chip';
import { DocumentSteps } from './document-steps';

/**
 * One document of the open business, top to bottom: the scan (a drawn page), a box to type in what could not be
 * read, the header, the three steps, what was read with Edit, the booking, the payment, the history and Remove.
 * Typing in a field, booking and linking really change the sample data, and each change adds a history line. Below `lg`
 * it is a page of its own; from `lg` it is the panel beside the list. When the document is not there (another
 * business opened, an unknown id, not shown in this setup state) it goes back to the list.
 */
@Component({
  selector: 'app-document-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BookingLabel,
    CategoryPicker,
    DocumentFields,
    DocumentPaper,
    DocumentPayment,
    DocumentStatusChip,
    DocumentSteps,
    HlmButton,
    MoneyPipe,
    NgIcon,
    PaymentHistory,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideX })],
  host: { class: 'flex flex-col gap-3' },
  template: `
    @if (doc(); as doc) {
      <a
        class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium lg:hidden"
        data-testid="back-link"
        routerLink="/documents"
      >
        <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
        {{ 'documents.detail.back' | transloco }}
      </a>

      <article
        class="bg-card border-border flex flex-col gap-6 rounded-xl border p-4"
        data-testid="document-detail"
      >
        <app-document-paper [doc]="doc" />

        @if (fixField(); as field) {
          <form
            class="border-warning/30 bg-warning/5 flex flex-col gap-3 rounded-lg border p-3"
            data-testid="fix-box"
            aria-labelledby="fix-text"
            novalidate
            (submit)="saveFix($event)"
          >
            <p class="text-sm" id="fix-text" data-testid="fix-text">
              {{ 'documents.detail.fix.' + field | transloco }}
            </p>
            <label class="flex flex-col gap-1 text-sm">
              <span class="text-muted-foreground">{{
                'documents.detail.fields.' + field | transloco
              }}</span>
              <input
                #fixInput
                class="border-input bg-background h-10 w-full rounded-md border px-3 text-sm aria-invalid:border-negative"
                data-testid="fix-input"
                [attr.type]="field === 'date' ? 'date' : 'text'"
                [attr.inputmode]="field === 'amount' ? 'decimal' : null"
                [attr.dir]="field === 'name' ? 'auto' : 'ltr'"
                [attr.aria-invalid]="fixError() ? 'true' : null"
                [attr.aria-describedby]="fixError() ? 'fix-error' : null"
                [value]="fixText()"
                (input)="setFix($event)"
              />
            </label>
            @if (fixError()) {
              <p class="text-negative text-xs" id="fix-error" role="alert" data-testid="fix-error">
                {{ 'documents.detail.fix.' + field + 'Error' | transloco }}
              </p>
            }
            <button hlmBtn size="lg" type="submit" data-testid="fix-save">
              {{ 'documents.detail.fix.save' | transloco }}
            </button>
          </form>
        }

        <header class="flex flex-col gap-1">
          <div class="flex items-start justify-between gap-3">
            <bdi dir="ltr" class="text-3xl font-semibold">
              <span data-testid="document-detail-amount">
                @let amount = doc.amountCents;
                @if (amount !== null) {
                  {{ amount | money }}
                } @else {
                  —
                }
              </span>
            </bdi>
            <a
              class="text-muted-foreground hover:bg-muted hidden size-8 shrink-0 items-center justify-center rounded-md lg:inline-flex"
              data-testid="close-panel"
              routerLink="/documents"
              [attr.aria-label]="'documents.detail.close' | transloco"
            >
              <ng-icon name="lucideX" size="18" aria-hidden="true" />
            </a>
          </div>
          <h1 class="text-lg font-medium wrap-break-word" data-testid="document-detail-name">
            <span dir="auto">
              @if (doc.name) {
                {{ doc.name }}
              } @else {
                <bdi dir="ltr">{{ doc.fileName }}</bdi>
              }
            </span>
          </h1>
          <p class="text-muted-foreground text-sm" data-testid="document-detail-meta">
            @if (doc.direction) {
              {{ 'documents.detail.kind.' + doc.direction | transloco }}
            } @else {
              {{ 'documents.status.direction' | transloco }}
            }
            @if (doc.invoiceNo) {
              ·
              <bdi dir="ltr"
                ><span data-testid="document-detail-invoice">{{ doc.invoiceNo }}</span></bdi
              >
            }
          </p>
          <span class="self-start" aria-live="polite">
            <app-document-status-chip [doc]="doc" />
          </span>
        </header>

        <app-document-steps [doc]="doc" [payment]="payment()" />

        <app-document-fields [doc]="doc" [payment]="payment()" />

        <section class="flex flex-col gap-3" data-testid="booking-section">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.booking.title' | transloco }}
          </h2>
          <p class="text-sm font-medium wrap-break-word" data-testid="booking-label">
            @if (booking(); as current) {
              <app-booking-label [booking]="current" />
            } @else {
              <span class="text-warning">{{ 'payments.detail.booking.none' | transloco }}</span>
            }
          </p>
          @if (payment()) {
            <p class="text-muted-foreground text-xs" data-testid="booking-hint">
              {{ 'documents.detail.booking.hint' | transloco }}
            </p>
          }
          <div class="flex flex-wrap items-center gap-2">
            @if (!doc.reading) {
              <app-category-picker [current]="booking()" (picked)="pick($event)" />
            }
            @if (needsConfirm()) {
              <button
                hlmBtn
                size="lg"
                type="button"
                data-testid="confirm-booking"
                (click)="confirm()"
              >
                {{ 'payments.detail.booking.confirm' | transloco }}
              </button>
            }
          </div>
        </section>

        <app-document-payment [doc]="doc" [payment]="payment()" />

        <section class="flex flex-col gap-3" data-testid="history-section">
          <h2 class="text-muted-foreground text-sm font-medium">
            {{ 'payments.detail.history.title' | transloco }}
          </h2>
          <app-payment-history [entries]="doc.history" [accounts]="accounts()" />
        </section>

        @if (doc.paymentId === null && !doc.reading) {
          <button
            hlmBtn
            variant="destructive"
            size="lg"
            type="button"
            data-testid="remove-document"
            (click)="remove()"
          >
            {{ 'documents.detail.remove' | transloco }}
          </button>
        }
      </article>
    }
  `,
})
export class DocumentDetailPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly fixInput = viewChild<ElementRef<HTMLInputElement>>('fixInput');

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  /** The business that was open when the document was opened: the document is gone from the page when another one opens. */
  private readonly businessId = this.demo.business().id;

  /** The open document; none when its id is unknown, another business is open, or it is not shown yet in this setup state. */
  protected readonly doc = computed<Doc | null>(() => {
    if (this.demo.business().id !== this.businessId) return null;
    return (
      visibleDocuments(this.demo.documents(), this.demo.setup()).find((d) => d.id === this.id()) ??
      null
    );
  });

  /** The payment the document is linked to. */
  protected readonly payment = computed<Transaction | null>(() => {
    const paymentId = this.doc()?.paymentId;
    if (!paymentId) return null;
    return this.demo.business().transactions.find((tx) => tx.id === paymentId) ?? null;
  });

  protected readonly accounts = computed(() => this.demo.business().accounts);

  /**
   * The field of the document that could not be read and is asked for in the box under the scan. A document that is
   * still being read has nothing "not read" yet: Reading… comes before Check in its status, and so before this box.
   */
  protected readonly fixField = computed<DocField | null>(() => {
    const doc = this.doc();
    return doc === null || doc.reading ? null : missingField(doc);
  });
  /** What is typed in the box, and whether it was refused; both start over for another document or another field. */
  protected readonly fixText = linkedSignal<string, string>({
    source: () => `${this.id()}:${this.fixField()}`,
    computation: () => '',
  });
  protected readonly fixError = linkedSignal<string, boolean>({
    source: () => `${this.id()}:${this.fixField()}`,
    computation: () => false,
  });

  /** The booking of the document: the payment's once they are linked, since the two are booked together. */
  protected readonly booking = computed<Booking | null>(() => {
    const payment = this.payment();
    return payment ? payment.booking : (this.doc()?.booking ?? null);
  });
  protected readonly needsConfirm = computed(() => {
    const payment = this.payment();
    const confirmed = payment ? payment.confirmed : this.doc()?.bookingConfirmed;
    return this.booking() !== null && !confirmed;
  });

  constructor() {
    effect(() => {
      if (this.doc() === null) {
        untracked(() => void this.router.navigateByUrl('/documents', { replaceUrl: true }));
      }
    });

    // The field that could not be read is ready to type in: a document opens (from "Type it in") with the cursor in it,
    // and after one field is saved the cursor moves on to the next one.
    effect(() => {
      this.fixField(); // asked again, so the cursor moves when the next field is asked for
      const input = this.fixInput();
      if (input) untracked(() => input.nativeElement.focus());
    });
  }

  protected setFix(event: Event): void {
    this.fixText.set((event.target as HTMLInputElement).value);
    this.fixError.set(false);
  }

  // Each action changes the document or the payment only while it still applies, so a double tap never writes a second history line.

  /** Types in the field that could not be read; a value that does not fit (an amount of 0 or less, an empty text) is refused. */
  protected saveFix(event: Event): void {
    event.preventDefault();
    const doc = this.doc();
    const field = this.fixField();
    if (doc === null || field === null) return;
    const typed = this.fixText().trim();
    const changes = this.fixChanges(field, typed);
    if (changes === null) {
      this.fixError.set(true);
      return;
    }
    this.demo.updateDocument(doc.id, (d) =>
      missingField(d) === field ? editDocument(d, changes) : d,
    );
  }

  protected confirm(): void {
    const payment = this.payment();
    const doc = this.doc();
    if (payment) {
      this.demo.updateTransaction(payment.id, (tx) =>
        tx.booking !== null && !tx.confirmed ? confirmBooking(tx) : tx,
      );
    } else if (doc) {
      this.demo.updateDocument(doc.id, (d) =>
        d.booking !== null && !d.bookingConfirmed ? confirmDocBooking(d) : d,
      );
    }
  }

  /** Another category changes the booking; the one it already has confirms it when it still waits for confirmation. */
  protected pick(booking: Booking): void {
    const payment = this.payment();
    const doc = this.doc();
    if (payment) {
      this.demo.updateTransaction(payment.id, (tx) => {
        if (tx.booking?.skr03 !== booking.skr03) return changeCategory(tx, booking);
        return tx.booking !== null && !tx.confirmed ? confirmBooking(tx) : tx;
      });
    } else if (doc) {
      this.demo.updateDocument(doc.id, (d) => {
        if (d.booking?.skr03 !== booking.skr03) return changeDocCategory(d, booking);
        return d.booking !== null && !d.bookingConfirmed ? confirmDocBooking(d) : d;
      });
    }
  }

  /** Takes a document that has no payment out of the list and goes back to it. */
  protected remove(): void {
    const doc = this.doc();
    if (doc === null || doc.paymentId !== null) return;
    this.demo.removeDocument(doc.id);
    void this.router.navigateByUrl('/documents', { replaceUrl: true });
  }

  private fixChanges(field: DocField, typed: string): DocChanges | null {
    switch (field) {
      case 'amount': {
        const amountCents = parseDocAmount(typed);
        return amountCents === null ? null : { amountCents };
      }
      case 'date':
        return typed === '' ? null : { date: typed };
      case 'name':
        return typed === '' ? null : { name: typed };
    }
  }
}
