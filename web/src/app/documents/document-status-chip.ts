import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { Doc, DocStatus } from '../data/models';
import { docStatus } from '../domain/document-status';
import { invoiceDocNote } from '../domain/invoices';
import { isolateText } from '../payments/payment-history';
import { DemoStateService } from '../state/demo-state.service';

const CHIP_CLASSES: Record<DocStatus, string> = {
  reading: 'bg-muted text-muted-foreground italic',
  duplicate: 'bg-warning/10 text-warning',
  direction: 'bg-warning/10 text-warning',
  checkAmount: 'bg-warning/10 text-warning',
  checkDate: 'bg-warning/10 text-warning',
  checkName: 'bg-warning/10 text-warning',
  waiting: 'bg-muted text-muted-foreground',
  overdue: 'bg-negative/10 text-negative',
  done: 'bg-positive/10 text-positive',
};

/**
 * A document's status as a coloured word (never only an icon). A waiting document with a due date says when,
 * an overdue one says since when. The document of an invoice written in Invoices adds what is special about it: what is
 * left of a partly paid invoice, "Cancelled", or the number a cancellation invoice cancels. The pill may wrap onto a
 * second line rather than leave the space it sits in.
 */
@Component({
  selector: 'app-document-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'inline-block max-w-full min-w-0' },
  template: `
    <span
      class="inline-block max-w-full rounded-full px-2 py-0.5 text-start text-xs font-medium"
      data-testid="doc-status"
      [class]="chipClasses()"
    >
      {{ 'documents.status.' + key() | transloco: params() }}
    </span>
  `,
})
export class DocumentStatusChip {
  private readonly demo = inject(DemoStateService);
  private readonly language = inject(LanguageService);

  readonly doc = input.required<Doc>();

  private readonly status = computed(() => docStatus(this.doc()));
  private readonly note = computed(() => invoiceDocNote(this.doc(), this.demo.business()));
  /** The text key under `documents.status`: a waiting document with a due date has a text of its own, and so has the document of an invoice with a note. */
  protected readonly key = computed(() => {
    const status = this.status();
    const note = this.note();
    if (status === 'done' && note?.kind === 'cancelled') return 'doneCancelled';
    if (status === 'done' && note?.kind === 'cancellation') return 'cancellationOf';
    if (note?.kind === 'left' && status === 'waiting') return 'waitingLeft';
    if (note?.kind === 'left' && status === 'overdue') return 'overdueLeft';
    return status === 'waiting' && this.doc().dueDate !== null ? 'waitingDue' : status;
  });
  /** The blanks of the texts: the due date as the person reads it, what is left (an amount keeps its own left-to-right order inside an Arabic sentence), and the number of the invoice a cancellation invoice cancels. */
  protected readonly params = computed(() => {
    const due = this.doc().dueDate;
    const note = this.note();
    const lang = this.language.lang();
    return {
      date: due === null ? '' : formatDate(due, lang),
      left: note?.kind === 'left' ? `⁦${formatMoney(note.leftCents, lang)}⁩` : '',
      number: note?.kind === 'cancellation' ? isolateText(note.number) : '',
    };
  });
  protected readonly chipClasses = computed(() => CHIP_CLASSES[this.status()]);
}
