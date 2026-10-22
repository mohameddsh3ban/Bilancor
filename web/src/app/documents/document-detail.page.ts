import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { Doc } from '../data/models';
import { visibleDocuments } from '../domain/document-status';
import { DemoStateService } from '../state/demo-state.service';

/**
 * One document of the open business. For now only its name and a way back: the full view comes with the document
 * details. Below `lg` it is a page of its own; from `lg` it is the panel beside the list.
 * When the document is not there (another business opened, an unknown id) it goes back to the list.
 */
@Component({
  selector: 'app-document-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideArrowLeft })],
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
        class="bg-card border-border flex flex-col gap-2 rounded-xl border p-4"
        data-testid="document-detail"
      >
        <h1
          class="text-lg font-medium wrap-break-word"
          dir="auto"
          data-testid="document-detail-name"
        >
          @if (doc.name) {
            {{ doc.name }}
          } @else {
            <bdi dir="ltr">{{ doc.fileName }}</bdi>
          }
        </h1>
      </article>
    }
  `,
})
export class DocumentDetailPage {
  private readonly demo = inject(DemoStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  /** The open document; none when its id is unknown, belongs to another business, or is not shown yet in this setup state. */
  protected readonly doc = computed<Doc | null>(
    () =>
      visibleDocuments(this.demo.documents(), this.demo.setup()).find((d) => d.id === this.id()) ??
      null,
  );

  constructor() {
    effect(() => {
      if (this.doc() === null) {
        untracked(() => void this.router.navigateByUrl('/documents', { replaceUrl: true }));
      }
    });
  }
}
