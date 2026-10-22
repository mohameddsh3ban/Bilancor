import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideLoaderCircle,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { DemoStateService } from '../state/demo-state.service';
import { UploadService } from '../state/upload.service';

/** The line about the last drop of files: how many are being read, or how many were added and need the person. */
type Line = { kind: 'reading'; count: number } | { kind: 'added'; count: number; needsYou: number };

/**
 * What the last drop of files came to, at the top of the list: "Reading N documents…" while they are read, then
 * "N documents added · M need you" (or "· all sorted"), and one line for each file that was not added, with the
 * reason. Its element is a polite live region, so a screen reader hears the change without being moved. The cross
 * removes it.
 */
@Component({
  selector: 'app-upload-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, NgIcon, TranslocoPipe],
  viewProviders: [
    provideIcons({ lucideCircleAlert, lucideCircleCheck, lucideLoaderCircle, lucideX }),
  ],
  // The element itself stays when there is nothing to say (a live region must be there before its words are), so
  // when it is empty it takes back the page's one gap, which it would double.
  host: { class: 'block empty:-mb-4', 'aria-live': 'polite' },
  template: `
    @if (view(); as view) {
      <div
        class="bg-card border-border flex items-start gap-3 rounded-lg border p-3 text-sm"
        data-testid="upload-message"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          @if (view.line; as line) {
            <p class="flex items-center gap-2 font-medium" data-testid="upload-line">
              @if (line.kind === 'reading') {
                <ng-icon
                  name="lucideLoaderCircle"
                  size="18"
                  class="text-primary shrink-0 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {{
                  (line.count === 1
                    ? 'documents.upload.reading.one'
                    : 'documents.upload.reading.many'
                  ) | transloco: { count: line.count }
                }}
              } @else {
                <ng-icon
                  name="lucideCircleCheck"
                  size="18"
                  class="text-positive shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {{
                    (line.count === 1
                      ? 'documents.upload.added.one'
                      : 'documents.upload.added.many'
                    ) | transloco: { count: line.count }
                  }}
                  ·
                  @if (line.needsYou === 0) {
                    {{ 'documents.upload.allSorted' | transloco }}
                  } @else {
                    {{
                      (line.needsYou === 1
                        ? 'documents.upload.needsYou.one'
                        : 'documents.upload.needsYou.many'
                      ) | transloco: { count: line.needsYou }
                    }}
                  }
                </span>
              }
            </p>
          }
          @if (view.refused.length > 0) {
            <div class="flex items-start gap-2">
              <ng-icon
                name="lucideCircleAlert"
                size="18"
                class="text-warning mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div class="flex min-w-0 flex-col gap-1">
                <p class="font-medium" data-testid="upload-refused-title">
                  {{ 'documents.upload.refusedTitle' | transloco }}
                </p>
                <ul class="text-muted-foreground flex flex-col gap-0.5">
                  @for (file of view.refused; track $index) {
                    <li data-testid="upload-refused">
                      <bdi dir="ltr" class="text-foreground break-all">{{ file.name }}</bdi>
                      —
                      {{ 'documents.upload.refused.' + file.reason | transloco }}
                    </li>
                  }
                </ul>
              </div>
            </div>
          }
        </div>
        <button
          hlmBtn
          variant="ghost"
          size="icon"
          type="button"
          class="-m-1 shrink-0"
          data-testid="upload-dismiss"
          [attr.aria-label]="'documents.upload.dismiss' | transloco"
          (click)="upload.clearSummary()"
        >
          <ng-icon name="lucideX" size="16" aria-hidden="true" />
        </button>
      </div>
    }
  `,
})
export class UploadMessage {
  protected readonly upload = inject(UploadService);
  private readonly demo = inject(DemoStateService);

  /** How many documents of the open business are still being read. */
  private readonly reading = computed(
    () => this.demo.documents().filter((doc) => doc.reading).length,
  );

  /**
   * What to say. While anything is being read the count of the documents being read comes from the documents
   * themselves, as the summary only knows the final numbers once the whole drop is read. Nothing says "0 documents
   * added": a drop of which every file was refused only lists them.
   */
  protected readonly view = computed(() => {
    const summary = this.upload.summary();
    if (summary === null) return null;
    const reading = this.reading();
    let line: Line | null = null;
    if (reading > 0) line = { kind: 'reading', count: reading };
    else if (summary.added > 0) {
      line = { kind: 'added', count: summary.added, needsYou: summary.needsYou };
    }
    if (line === null && summary.refused.length === 0) return null;
    return { line, refused: summary.refused };
  });
}
