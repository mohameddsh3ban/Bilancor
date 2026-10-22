import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';

/** How long "Copied" stays on the button. */
const COPIED_MS = 2000;
/** How long the hint stays when copying did not work: long enough to read it and select the address. */
const FAILED_MS = 4000;

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * A Copy button that puts `text` on the clipboard. It says "Copied" only once the clipboard has taken the text; where
 * there is no clipboard (a demo opened over plain http) or it refuses, it says so and tells the person to select the
 * text instead. The words are announced through a status element of their own, not through the button.
 */
@Component({
  selector: 'app-copy-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck, lucideCopy })],
  host: { class: 'inline-flex flex-wrap items-center gap-x-2 gap-y-1' },
  template: `
    <button
      hlmBtn
      variant="outline"
      size="sm"
      type="button"
      data-testid="copy-button"
      (click)="copy()"
    >
      <ng-icon
        [name]="state() === 'copied' ? 'lucideCheck' : 'lucideCopy'"
        size="14"
        aria-hidden="true"
      />
      {{ (state() === 'copied' ? 'documents.inbox.copied' : 'documents.inbox.copy') | transloco }}
    </button>
    <span
      role="status"
      data-testid="copy-status"
      [class]="state() === 'failed' ? 'text-muted-foreground text-xs' : 'sr-only'"
    >
      @switch (state()) {
        @case ('copied') {
          {{ 'documents.inbox.copied' | transloco }}
        }
        @case ('failed') {
          {{ 'documents.inbox.copyFailed' | transloco }}
        }
      }
    </span>
  `,
})
export class CopyButton {
  /** What goes on the clipboard. */
  readonly text = input.required<string>();

  protected readonly state = signal<CopyState>('idle');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.timer);
    });
  }

  protected async copy(): Promise<void> {
    const copied = await this.write(this.text());
    if (this.destroyed) return;
    this.state.set(copied ? 'copied' : 'failed');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.state.set('idle'), copied ? COPIED_MS : FAILED_MS);
  }

  /** Whether the clipboard took the text: false where there is no clipboard, and when it refuses. */
  private async write(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}
