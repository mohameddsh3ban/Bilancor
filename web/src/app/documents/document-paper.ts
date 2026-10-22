import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { Doc } from '../data/models';

/**
 * The scan of a document, as a drawn placeholder page: the name at the top, the invoice number and date beside it,
 * the total at the bottom, grey bars for the text in between. What reading could not find shows a `?` inside a
 * dashed warning outline, so the person sees on the page itself what the fix box under it asks for.
 * While the document is still being read nothing is known to be missing yet, so there are no marks: the page is
 * blank with a Reading… note. It is a picture of values that the header and "What we read" already say in words, so it
 * is hidden from screen readers.
 */
@Component({
  selector: 'app-document-paper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, MoneyPipe, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <div class="bg-muted/50 rounded-lg p-3" aria-hidden="true">
      <div
        class="bg-card border-border mx-auto flex w-full max-w-xs flex-col gap-4 rounded-md border p-3 shadow-xs"
        data-testid="document-paper"
      >
        @if (doc().reading) {
          <div class="flex flex-col gap-2 py-2">
            <span class="bg-muted h-1.5 w-3/5 rounded-full"></span>
            <span class="bg-muted h-1.5 w-full rounded-full"></span>
            <span class="bg-muted h-1.5 w-11/12 rounded-full"></span>
            <span class="bg-muted h-1.5 w-4/5 rounded-full"></span>
          </div>
          <p
            class="text-muted-foreground border-border border-t pt-3 text-sm italic"
            data-testid="paper-reading"
          >
            {{ 'documents.status.reading' | transloco }}
          </p>
        } @else {
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <span class="block text-sm font-semibold" data-testid="paper-name">
                <span class="inline-block max-w-full truncate align-bottom" dir="auto">
                  @if (doc().name) {
                    {{ doc().name }}
                  } @else {
                    <span [class]="markClass" data-testid="paper-missing" data-field="name">?</span>
                  }
                </span>
              </span>
              <span class="bg-muted h-1.5 w-24 rounded-full"></span>
              <span class="bg-muted h-1.5 w-16 rounded-full"></span>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1 text-xs">
              <span class="flex items-baseline gap-1">
                <span class="text-muted-foreground">{{
                  'documents.detail.paper.invoiceNo' | transloco
                }}</span>
                <bdi dir="ltr" class="font-medium">
                  <span data-testid="paper-invoice">{{ doc().invoiceNo || '—' }}</span>
                </bdi>
              </span>
              <span class="flex items-baseline gap-1">
                <span class="text-muted-foreground">{{
                  'documents.detail.paper.date' | transloco
                }}</span>
                <span class="font-medium" data-testid="paper-date">
                  @if (doc().date; as date) {
                    {{ date | appDate: { year: true } }}
                  } @else {
                    <span [class]="markClass" data-testid="paper-missing" data-field="date">?</span>
                  }
                </span>
              </span>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="bg-muted h-1.5 w-full rounded-full"></span>
            <span class="bg-muted h-1.5 w-11/12 rounded-full"></span>
            <span class="bg-muted h-1.5 w-4/5 rounded-full"></span>
            <span class="bg-muted h-1.5 w-2/3 rounded-full"></span>
          </div>

          <div class="border-border flex items-center justify-between gap-3 border-t pt-3">
            <span class="text-muted-foreground text-xs">{{
              'documents.detail.paper.total' | transloco
            }}</span>
            <bdi dir="ltr" class="text-base font-semibold">
              <span data-testid="paper-total">
                @let amount = doc().amountCents;
                @if (amount !== null) {
                  {{ amount | money }}
                } @else {
                  <span [class]="markClass" data-testid="paper-missing" data-field="amount">?</span>
                }
              </span>
            </bdi>
          </div>
        }
      </div>
    </div>
  `,
})
export class DocumentPaper {
  readonly doc = input.required<Doc>();

  /** The mark for a spot that could not be read: the outline is drawn inside the box, so nothing clips it. */
  protected readonly markClass =
    'text-warning outline-warning inline-block rounded-sm px-2 font-semibold outline-2 -outline-offset-2 outline-dashed';
}
