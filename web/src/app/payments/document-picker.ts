import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { Doc, Transaction } from '../data/models';
import { DocumentStatusChip } from '../documents/document-status-chip';
import { documentCandidates } from '../domain/document-matching';
import { docDay } from '../domain/document-search';
import { docName, missingField, visibleDocuments } from '../domain/document-status';
import { parseAmountQuery } from '../domain/payment-filters';
import { DemoStateService } from '../state/demo-state.service';

/**
 * The documents whose name contains the typed text (any case, outer spaces ignored; a document with no name is
 * known by its file name), or whose amount is the typed one (`23,80` and `23.80` both find 23.80 euros; the sign
 * does not matter). Nothing typed keeps them all, in the order they came in.
 */
export function matchDocuments(docs: readonly Doc[], query: string): Doc[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return [...docs];
  const amount = parseAmountQuery(needle);
  return docs.filter(
    (doc) =>
      docName(doc).toLocaleLowerCase().includes(needle) ||
      (amount !== null && doc.amountCents === amount.cents),
  );
}

/**
 * A "Pick from Documents" button that opens a searchable list of the documents the payment could get as its
 * receipt (the ones that fit, best first). Choosing one emits its id and closes the list. The list is a popover that
 * is nearly as wide as the screen on a phone. Linking is the page's job, not this list's.
 */
@Component({
  selector: 'app-document-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    DocumentStatusChip,
    HlmButton,
    HlmPopoverImports,
    MoneyPipe,
    NgIcon,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideSearch })],
  host: { class: 'inline-block' },
  template: `
    <hlm-popover align="start" (stateChanged)="onState($event)">
      <button hlmPopoverTrigger hlmBtn variant="outline" size="lg" data-testid="pick-document">
        {{ 'payments.detail.receipt.pickDocument' | transloco }}
      </button>
      <ng-template hlmPopoverPortal let-popover>
        <!-- On a phone the list starts where the button does (inside the page and card padding), so it is 4.5rem narrower than the screen. -->
        <hlm-popover-content class="w-[min(24rem,calc(100vw-4.5rem))] gap-2 p-2">
          <div class="relative">
            <ng-icon
              name="lucideSearch"
              size="16"
              class="text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              class="border-input bg-background placeholder:text-muted-foreground h-10 w-full rounded-md border ps-9 pe-3 text-sm"
              data-testid="document-search"
              [value]="query()"
              [attr.aria-label]="'payments.detail.docPicker.search' | transloco"
              [placeholder]="'payments.detail.docPicker.placeholder' | transloco"
              (input)="setQuery($event)"
            />
          </div>
          <ul class="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            @for (doc of matches(); track doc.id) {
              <li>
                <button
                  type="button"
                  class="hover:bg-muted focus-visible:bg-muted flex w-full items-start gap-3 rounded-md px-2 py-2 text-start text-sm outline-none"
                  data-testid="document-picker-option"
                  (click)="choose(doc, popover)"
                >
                  <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span class="truncate font-medium" dir="auto" data-testid="picker-name">
                      @if (doc.name) {
                        {{ doc.name }}
                      } @else {
                        <bdi dir="ltr">{{ doc.fileName }}</bdi>
                      }
                    </span>
                    <span class="text-muted-foreground text-xs" data-testid="picker-meta">{{
                      day(doc) | appDate
                    }}</span>
                    @if (doc.name) {
                      <span class="text-muted-foreground truncate text-xs">
                        <bdi dir="ltr"
                          ><span data-testid="picker-file">{{ doc.fileName }}</span></bdi
                        >
                      </span>
                    }
                    @if (missingField(doc) !== null) {
                      <app-document-status-chip class="self-start" [doc]="doc" />
                    }
                  </span>
                  <bdi dir="ltr" class="shrink-0 font-medium">
                    <span data-testid="picker-amount">
                      @if (doc.amountCents !== null) {
                        {{ doc.amountCents | money }}
                      } @else {
                        —
                      }
                    </span>
                  </bdi>
                </button>
              </li>
            } @empty {
              @if (candidates().length === 0) {
                <li
                  class="text-muted-foreground flex flex-col items-start gap-2 px-2 py-3 text-sm"
                  data-testid="document-picker-empty"
                >
                  <span>{{ 'payments.detail.docPicker.empty' | transloco }}</span>
                  <a
                    hlmBtn
                    variant="outline"
                    size="sm"
                    data-testid="document-picker-add"
                    routerLink="/documents"
                    [queryParams]="{ add: '1' }"
                    (click)="popover.close()"
                  >
                    {{ 'payments.detail.docPicker.add' | transloco }}
                  </a>
                </li>
              } @else {
                <li
                  class="text-muted-foreground px-2 py-3 text-sm"
                  data-testid="document-picker-no-match"
                >
                  {{ 'payments.detail.docPicker.noMatch' | transloco }}
                </li>
              }
            }
          </ul>
        </hlm-popover-content>
      </ng-template>
    </hlm-popover>
  `,
})
export class DocumentPicker {
  private readonly demo = inject(DemoStateService);

  /** The payment that needs a receipt. */
  readonly payment = input.required<Transaction>();
  /** The id of the document the person chose. */
  readonly picked = output<string>();

  /** The documents that fit the payment, best first; the ones the open business shows, so none before a bank is connected. */
  protected readonly candidates = computed(() =>
    documentCandidates(this.payment(), visibleDocuments(this.demo.documents(), this.demo.setup())),
  );
  protected readonly query = signal('');
  protected readonly matches = computed(() => matchDocuments(this.candidates(), this.query()));

  protected readonly day = docDay;
  protected readonly missingField = missingField;

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onState(state: 'open' | 'closed'): void {
    if (state === 'closed') this.query.set('');
  }

  protected choose(doc: Doc, popover: { close: () => void }): void {
    popover.close();
    this.picked.emit(doc.id);
  }
}
