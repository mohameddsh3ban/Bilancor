import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideFileText } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { AppMonthPipe } from '../core/format/month.pipe';
import { DocMonthGroup, docDay } from '../domain/document-search';
import { DocumentStatusChip } from './document-status-chip';

/**
 * Phone layout of the documents: one card per month, one row per document.
 * Hidden from `lg` (the table takes over), or from `2xl` while a document is open beside the list.
 */
@Component({
  selector: 'app-document-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppDatePipe,
    AppMonthPipe,
    DocumentStatusChip,
    MoneyPipe,
    NgIcon,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideChevronRight, lucideFileText })],
  host: { class: 'flex flex-col gap-4', '[class]': 'hiddenFrom()' },
  template: `
    @for (group of groups(); track group.month) {
      <section
        class="bg-card border-border overflow-hidden rounded-xl border"
        data-testid="document-month-group"
      >
        <header class="bg-muted/50 px-4 py-2">
          <h2 class="font-semibold" data-testid="document-month-title">
            {{ group.month | appMonth }}
          </h2>
        </header>
        <ul>
          @for (doc of group.docs; track doc.id) {
            <li class="border-border border-t first:border-t-0">
              <a
                class="hover:bg-muted flex items-start gap-3 px-4 py-2.5"
                data-testid="document-row"
                [class.bg-muted]="doc.id === selectedId()"
                [attr.aria-current]="doc.id === selectedId() ? 'true' : null"
                [routerLink]="['/documents', doc.id]"
              >
                <span
                  class="bg-muted text-muted-foreground flex h-12 w-10 shrink-0 items-center justify-center rounded-md border"
                  aria-hidden="true"
                >
                  <ng-icon name="lucideFileText" size="18" />
                </span>
                <span class="flex min-w-0 flex-1 flex-col gap-1">
                  <span class="flex items-baseline justify-between gap-3">
                    <span
                      class="min-w-0 truncate font-medium"
                      dir="auto"
                      data-testid="document-name"
                    >
                      @if (doc.name) {
                        {{ doc.name }}
                      } @else {
                        <bdi dir="ltr">{{ doc.fileName }}</bdi>
                      }
                    </span>
                    <bdi dir="ltr" class="shrink-0 font-medium">
                      <span data-testid="document-amount">
                        @if (doc.amountCents !== null) {
                          {{ doc.amountCents | money }}
                        } @else {
                          —
                        }
                      </span>
                    </bdi>
                  </span>
                  <span class="text-muted-foreground text-xs" data-testid="document-meta">
                    @if (doc.direction) {
                      {{ 'documents.direction.' + doc.direction | transloco }} ·
                    }
                    @if (doc.direction === 'sent' && doc.invoiceNo) {
                      <bdi dir="ltr">{{ doc.invoiceNo }}</bdi>
                    } @else {
                      {{ day(doc) | appDate }}
                    }
                  </span>
                  <app-document-status-chip class="self-start" [doc]="doc" />
                </span>
                <ng-icon
                  name="lucideChevronRight"
                  size="16"
                  class="text-muted-foreground mt-4 shrink-0 rtl:rotate-180"
                  aria-hidden="true"
                />
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class DocumentList {
  readonly groups = input.required<readonly DocMonthGroup[]>();
  readonly selectedId = input<string | null>(null);
  /** A document is open beside the list, so the table gets less room and gives way to this list for longer. */
  readonly panelOpen = input(false);

  protected readonly day = docDay;
  protected readonly hiddenFrom = computed(() => (this.panelOpen() ? '2xl:hidden' : 'lg:hidden'));
}
