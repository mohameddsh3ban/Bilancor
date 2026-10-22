import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { AppMonthPipe } from '../core/format/month.pipe';
import { DocMonthGroup, docDay } from '../domain/document-search';
import { DocumentStatusChip } from './document-status-chip';

/**
 * Computer layout of the documents: one table, a header row per month.
 * The whole row opens the document (stretched link on the name).
 * Shown from `lg`, or from `2xl` while a document is open beside the table.
 */
@Component({
  selector: 'app-document-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, AppMonthPipe, DocumentStatusChip, MoneyPipe, RouterLink, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <div
      class="bg-card border-border overflow-hidden rounded-xl border"
      [class]="panelOpen() ? 'hidden 2xl:block' : 'hidden lg:block'"
    >
      <table class="w-full table-fixed text-sm" data-testid="document-table">
        <colgroup>
          <col class="w-24" />
          <col />
          <col class="w-24" />
          <col class="w-60" />
          <col class="w-28" />
        </colgroup>
        <thead>
          <tr class="text-muted-foreground border-border border-b text-xs">
            <th scope="col" class="py-2 ps-4 pe-3 text-start font-medium">
              {{ 'documents.col.date' | transloco }}
            </th>
            <th scope="col" class="py-2 pe-3 text-start font-medium">
              {{ 'documents.col.name' | transloco }}
            </th>
            <th scope="col" class="py-2 pe-3 text-start font-medium">
              {{ 'documents.col.type' | transloco }}
            </th>
            <th scope="col" class="py-2 pe-3 text-start font-medium">
              {{ 'documents.col.status' | transloco }}
            </th>
            <th scope="col" class="py-2 pe-4 text-end font-medium">
              {{ 'documents.col.amount' | transloco }}
            </th>
          </tr>
        </thead>
        @for (group of groups(); track group.month) {
          <tbody data-testid="document-table-month-group">
            <tr class="bg-muted/50">
              <th scope="colgroup" colspan="5" class="px-4 py-2 text-start">
                <span class="font-semibold" data-testid="document-table-month-title">{{
                  group.month | appMonth
                }}</span>
              </th>
            </tr>
            @for (doc of group.docs; track doc.id) {
              <tr
                class="border-border hover:bg-muted relative border-t"
                data-testid="document-table-row"
                [class.bg-muted]="doc.id === selectedId()"
                [attr.aria-current]="doc.id === selectedId() ? 'true' : null"
              >
                <td class="py-2.5 ps-4 pe-3 whitespace-nowrap">{{ day(doc) | appDate }}</td>
                <td class="py-2.5 pe-3">
                  <a
                    class="block font-medium after:absolute after:inset-0 hover:underline"
                    data-testid="document-table-name"
                    [routerLink]="['/documents', doc.id]"
                  >
                    <span class="inline-block max-w-full truncate align-bottom" dir="auto">
                      @if (doc.name) {
                        {{ doc.name }}
                      } @else {
                        <bdi dir="ltr">{{ doc.fileName }}</bdi>
                      }
                    </span>
                  </a>
                </td>
                <td class="py-2.5 pe-3">
                  <span class="block truncate" data-testid="document-table-type">
                    @if (doc.direction) {
                      {{ 'documents.direction.' + doc.direction | transloco }}
                    } @else {
                      —
                    }
                  </span>
                </td>
                <td class="py-2.5 pe-3">
                  <app-document-status-chip [doc]="doc" />
                </td>
                <td class="py-2.5 pe-4 text-end">
                  <bdi dir="ltr" class="font-medium">
                    <span data-testid="document-table-amount">
                      @if (doc.amountCents !== null) {
                        {{ doc.amountCents | money }}
                      } @else {
                        —
                      }
                    </span>
                  </bdi>
                </td>
              </tr>
            }
          </tbody>
        }
      </table>
    </div>
  `,
})
export class DocumentTable {
  readonly groups = input.required<readonly DocMonthGroup[]>();
  readonly selectedId = input<string | null>(null);
  /** A document is open beside the table, so the table shows only from `2xl` where it has room. */
  readonly panelOpen = input(false);

  protected readonly day = docDay;
}
