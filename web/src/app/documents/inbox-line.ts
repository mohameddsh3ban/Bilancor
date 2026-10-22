import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CopyButton } from './copy-button';

/** "Or forward receipts to <address>" with a Copy button. */
@Component({
  selector: 'app-inbox-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CopyButton, TranslocoPipe],
  host: {
    class: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm',
    'data-testid': 'inbox-line',
  },
  template: `
    <p class="text-muted-foreground min-w-0">
      {{ 'documents.inbox.text' | transloco }}
      <bdi
        dir="ltr"
        class="text-foreground font-medium break-all select-all"
        data-testid="inbox-email"
        >{{ email() }}</bdi
      >
    </p>
    <app-copy-button [text]="email()" />
  `,
})
export class InboxLine {
  readonly email = input.required<string>();
}
