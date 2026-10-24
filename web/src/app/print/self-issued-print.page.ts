import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { SelfIssuedPaper } from '../documents/self-issued-paper';
import { DemoStateService } from '../state/demo-state.service';
import { printOnceRendered } from './print-once';

/**
 * One self-issued receipt of the open business as a clean page for the browser's print dialog (which can also save a PDF): the paper
 * alone, in German, with nothing of the app around it. It sits outside the app shell and opens the print dialog once after it first
 * renders. A document that is not there (an unknown id, another business's, or one that is not a self-issued receipt) says so and does
 * not print.
 */
@Component({
  selector: 'app-self-issued-print-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, RouterLink, SelfIssuedPaper, TranslocoPipe],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  host: { class: 'mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8 print:p-0' },
  template: `
    <a
      class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium print:hidden"
      data-testid="print-back"
      [routerLink]="backLink()"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'print.back' | transloco }}
    </a>

    @if (doc(); as found) {
      <app-self-issued-paper [doc]="found" [business]="business()" />
    } @else {
      <p class="text-muted-foreground" role="status" data-testid="print-nothing">
        {{ 'print.nothing' | transloco }}
      </p>
    }
  `,
})
export class SelfIssuedPrintPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('docId'))), {
    initialValue: this.route.snapshot.paramMap.get('docId'),
  });

  protected readonly business = this.demo.business;

  /** The receipt to print; none when the id is unknown, another business's, or the document is not a self-issued receipt. */
  protected readonly doc = computed(
    () =>
      this.demo.documents().find((doc) => doc.id === this.id() && doc.selfIssued !== null) ?? null,
  );

  /** Back to the document, or to the list when there is no such receipt. */
  protected readonly backLink = computed(() => {
    const found = this.doc();
    return found ? ['/documents', found.id] : ['/documents'];
  });

  constructor() {
    printOnceRendered(() => this.doc() !== null);
  }
}
