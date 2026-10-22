import { ChangeDetectionStrategy, Component, inject, input, linkedSignal } from '@angular/core';
import type { Doc } from '../data/models';
import { docName } from '../domain/document-status';
import type { ReviewItem } from '../domain/review-queue';
import { DemoStateService } from '../state/demo-state.service';
import { ReviewCard } from './review-card';

/** A document waiting for the person's decision. */
export type DocumentItem = Extract<ReviewItem, { kind: 'document' }>;

/** The review card of a document: the frame with the document's basics. The questions and answers come next. */
@Component({
  selector: 'app-document-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReviewCard],
  host: { class: 'block' },
  template: `
    <app-review-card
      [kindKey]="'review.kind.' + item().problem"
      [amountCents]="doc()?.amountCents ?? null"
      [name]="doc() ? name(doc()!) : ''"
      [date]="doc()?.date ?? null"
    />
  `,
})
export class DocumentCard {
  private readonly demo = inject(DemoStateService);

  readonly item = input.required<DocumentItem>();

  /**
   * The document as it was last seen. An answer can take the document away ("Remove this one"), and the card is still on
   * screen with its tick for a moment after that, so it keeps showing what it knew.
   */
  protected readonly doc = linkedSignal<Doc | undefined, Doc | undefined>({
    source: () => this.demo.documents().find((d) => d.id === this.item().id),
    computation: (found, previous) => found ?? previous?.value,
  });

  protected readonly name = docName;
}
