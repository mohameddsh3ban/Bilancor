import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { AppDatePipe } from '../core/format/date.pipe';
import { formatDate } from '../core/format/format';
import { MoneyPipe } from '../core/format/money.pipe';
import { LanguageService } from '../core/i18n/language.service';
import { Doc, DocDirection, DocStatus } from '../data/models';
import { keepDuplicate, setDirection } from '../domain/document-actions';
import { newestFirst } from '../domain/document-search';
import { docStatus } from '../domain/document-status';
import { DemoStateService } from '../state/demo-state.service';

/**
 * The documents that need the person: one card each, newest first, with what is wrong in a sentence and its fix.
 * A duplicate is kept or removed, a direction is answered, and a field that could not be read is typed in on the
 * document itself. Fixing a card takes it out of the box (or turns it into its next problem); the box goes when empty.
 */
@Component({
  selector: 'app-needs-you-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, HlmButton, MoneyPipe, RouterLink, TranslocoPipe],
  host: { class: 'block' },
  template: `
    @if (sorted().length > 0) {
      <section
        class="border-warning/30 bg-warning/5 flex flex-col gap-3 rounded-xl border p-3"
        data-testid="needs-you-box"
        aria-labelledby="needs-you-title"
      >
        <h2
          id="needs-you-title"
          class="text-warning px-1 text-sm font-semibold"
          data-testid="needs-you-title"
        >
          {{ 'documents.needsYou.title' | transloco: { count: sorted().length } }}
        </h2>
        <ul class="flex flex-col gap-3">
          @for (doc of sorted(); track doc.id) {
            @let status = statusOf(doc);
            <li
              class="bg-card border-border flex flex-col gap-3 rounded-lg border p-3"
              data-testid="needs-card"
            >
              <div class="flex min-w-0 flex-col gap-0.5">
                <span
                  class="truncate font-medium"
                  dir="auto"
                  data-testid="needs-name"
                  [id]="'needs-name-' + doc.id"
                >
                  @if (doc.name) {
                    {{ doc.name }}
                  } @else {
                    <bdi dir="ltr">{{ doc.fileName }}</bdi>
                  }
                </span>
                @if (doc.date || doc.amountCents !== null) {
                  <span class="text-muted-foreground text-xs" data-testid="needs-meta">
                    @if (doc.date) {
                      {{ doc.date | appDate }}
                    }
                    @if (doc.date && doc.amountCents !== null) {
                      ·
                    }
                    @if (doc.amountCents !== null) {
                      <bdi dir="ltr">{{ doc.amountCents | money }}</bdi>
                    }
                  </span>
                }
              </div>
              <p class="text-sm" data-testid="needs-sentence">
                {{ sentenceKey(doc, status) | transloco: { date: originalDate(doc) } }}
              </p>
              <div class="flex flex-wrap gap-2">
                @switch (status) {
                  @case ('duplicate') {
                    <button
                      hlmBtn
                      variant="outline"
                      size="sm"
                      type="button"
                      data-testid="keep-both"
                      [attr.aria-describedby]="'needs-name-' + doc.id"
                      (click)="keepBoth(doc)"
                    >
                      {{ 'documents.needsYou.fix.keepBoth' | transloco }}
                    </button>
                    @if (doc.paymentId === null) {
                      <button
                        hlmBtn
                        variant="outline"
                        size="sm"
                        type="button"
                        data-testid="remove-doc"
                        [attr.aria-describedby]="'needs-name-' + doc.id"
                        (click)="remove(doc)"
                      >
                        {{ 'documents.needsYou.fix.remove' | transloco }}
                      </button>
                    }
                  }
                  @case ('direction') {
                    <button
                      hlmBtn
                      variant="outline"
                      size="sm"
                      type="button"
                      data-testid="direction-received"
                      [attr.aria-describedby]="'needs-name-' + doc.id"
                      (click)="answer(doc, 'received')"
                    >
                      {{ 'documents.direction.received' | transloco }}
                    </button>
                    <button
                      hlmBtn
                      variant="outline"
                      size="sm"
                      type="button"
                      data-testid="direction-sent"
                      [attr.aria-describedby]="'needs-name-' + doc.id"
                      (click)="answer(doc, 'sent')"
                    >
                      {{ 'documents.direction.sent' | transloco }}
                    </button>
                  }
                  @default {
                    <a
                      hlmBtn
                      size="sm"
                      data-testid="type-it-in"
                      [attr.aria-describedby]="'needs-name-' + doc.id"
                      [routerLink]="['/documents', doc.id]"
                    >
                      {{ 'documents.needsYou.fix.typeItIn' | transloco }}
                    </a>
                  }
                }
              </div>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class NeedsYouBox {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  /** The documents that need the person, in any order. */
  readonly docs = input.required<readonly Doc[]>();

  protected readonly sorted = computed(() => newestFirst(this.docs()));
  private readonly byId = computed(() => new Map(this.demo.documents().map((d) => [d.id, d])));

  protected readonly statusOf = docStatus;

  /** The text key of the sentence: a duplicate of a document that is gone cannot say when that one was added. */
  protected sentenceKey(doc: Doc, status: DocStatus): string {
    return status === 'duplicate' && this.original(doc) === undefined
      ? 'documents.needsYou.duplicateUnknown'
      : `documents.needsYou.${status}`;
  }

  /** When the document this one looks like was added, as the person reads it (empty when there is none). */
  protected originalDate(doc: Doc): string {
    const original = this.original(doc);
    return original === undefined ? '' : formatDate(original.addedOn, this.language.lang());
  }

  // Each action changes the document only while it still applies, so a double tap never writes a second history line.

  protected keepBoth(doc: Doc): void {
    this.demo.updateDocument(doc.id, (d) => (d.duplicateOf !== null ? keepDuplicate(d) : d));
  }

  protected remove(doc: Doc): void {
    this.demo.removeDocument(doc.id);
  }

  protected answer(doc: Doc, direction: DocDirection): void {
    this.demo.updateDocument(doc.id, (d) =>
      d.direction === null ? setDirection(d, direction) : d,
    );
  }

  private original(doc: Doc): Doc | undefined {
    return doc.duplicateOf === null ? undefined : this.byId().get(doc.duplicateOf);
  }
}
