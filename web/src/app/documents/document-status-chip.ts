import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { formatDate } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { Doc, DocStatus } from '../data/models';
import { docStatus } from '../domain/document-status';

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
 * an overdue one says since when. The pill may wrap onto a second line rather than leave the space it sits in.
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
      {{ 'documents.status.' + key() | transloco: { date: dueText() } }}
    </span>
  `,
})
export class DocumentStatusChip {
  private readonly language = inject(LanguageService);

  readonly doc = input.required<Doc>();

  private readonly status = computed(() => docStatus(this.doc()));
  /** The text key under `documents.status`: a waiting document with a due date has a text of its own. */
  protected readonly key = computed(() => {
    const status = this.status();
    return status === 'waiting' && this.doc().dueDate !== null ? 'waitingDue' : status;
  });
  /** The due date as the person reads it, for the two statuses that mention it. */
  protected readonly dueText = computed(() => {
    const due = this.doc().dueDate;
    return due === null ? '' : formatDate(due, this.language.lang());
  });
  protected readonly chipClasses = computed(() => CHIP_CLASSES[this.status()]);
}
