import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileUp } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { isComputerScreen } from '../core/layout/computer-screen';
import { UploadService } from '../state/upload.service';

/**
 * Dropping files anywhere on the page adds them. While files are dragged over the page (from `lg`; a phone has
 * no dragging) a dashed overlay covers it: "Drop to add N files". It listens to the whole document, so it has
 * nothing to wrap; a drag that carries no files (selected text, say) is left alone.
 */
@Component({
  selector: 'app-drop-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideFileUp })],
  host: {
    '(document:dragenter)': 'onEnter($event)',
    '(document:dragover)': 'onOver($event)',
    '(document:dragleave)': 'onLeave()',
    '(document:drop)': 'onDrop($event)',
    '(document:keydown.escape)': 'hide()',
  },
  template: `
    @if (count() > 0) {
      <div
        class="bg-background/90 pointer-events-none fixed inset-0 z-50 p-4 backdrop-blur-sm"
        data-testid="drop-overlay"
      >
        <div
          class="border-primary flex size-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center"
        >
          <ng-icon name="lucideFileUp" size="40" class="text-primary" aria-hidden="true" />
          <p class="text-xl font-semibold" data-testid="drop-title">
            {{
              (count() === 1 ? 'documents.drop.one' : 'documents.drop.many')
                | transloco: { count: count() }
            }}
          </p>
          <p class="text-muted-foreground">{{ 'documents.drop.hint' | transloco }}</p>
        </div>
      </div>
    }
  `,
})
export class DropOverlay {
  private readonly upload = inject(UploadService);
  private readonly document = inject(DOCUMENT);

  /** How many files are being dragged over the page; 0 while the overlay is hidden. */
  protected readonly count = signal(0);
  /**
   * How many elements the drag has entered and not left yet. Moving across the page enters one element before it
   * leaves the last, so the drag has left the page only when this is back at 0.
   */
  private depth = 0;

  protected onEnter(event: DragEvent): void {
    if (!this.takes(event)) return;
    event.preventDefault();
    this.depth++;
    this.count.set(Math.max(1, event.dataTransfer?.items?.length ?? 0));
  }

  /** The browser only allows a drop where a dragover was cancelled. */
  protected onOver(event: DragEvent): void {
    if (!this.takes(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  protected onLeave(): void {
    this.depth = Math.max(0, this.depth - 1);
    if (this.depth === 0) this.count.set(0);
  }

  protected onDrop(event: DragEvent): void {
    if (!this.takes(event)) return;
    event.preventDefault(); // the browser would open the file instead
    this.hide();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) this.upload.add(files, 'file');
  }

  protected hide(): void {
    this.depth = 0;
    this.count.set(0);
  }

  /** Whether this drag is files from a computer screen: nothing else is ours to take. */
  private takes(event: DragEvent): boolean {
    return (
      isComputerScreen(this.document) &&
      Array.from(event.dataTransfer?.types ?? []).includes('Files')
    );
  }
}
