import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';

/**
 * The "‹ label" link that leads back to Help (`/help`): the chevron, which turns around in right-to-left text, and the
 * label the page puts in it ("Help", "All topics"). Help's pages share it, so the link looks and sizes the same on each
 * (44 px high, for a thumb). `testId` goes on the link itself.
 */
@Component({
  selector: 'app-help-back-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, RouterLink],
  viewProviders: [provideIcons({ lucideChevronLeft })],
  host: { class: 'block' },
  template: `
    <a
      routerLink="/help"
      class="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-medium"
      [attr.data-testid]="testId()"
    >
      <ng-icon name="lucideChevronLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      <ng-content />
    </a>
  `,
})
export class HelpBackLink {
  readonly testId = input.required<string>();
}
