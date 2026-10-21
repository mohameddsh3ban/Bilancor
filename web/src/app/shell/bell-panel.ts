import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { formatDate } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { NoticeService } from '../state/notice.service';
import { SHELL_ICONS } from './menu';

/** The notifications bell: unread count badge, and a popover with the business's notice history. */
@Component({
  selector: 'app-bell-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmBadge, HlmButton, HlmPopoverImports, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons(SHELL_ICONS)],
  template: `
    <hlm-popover
      align="end"
      [state]="notices.bellOpen() ? 'open' : 'closed'"
      (stateChanged)="notices.bellOpen.set($event === 'open')"
    >
      <button
        hlmPopoverTrigger
        hlmBtn
        variant="ghost"
        size="icon"
        class="relative"
        data-testid="bell"
        [attr.aria-label]="'shell.notifications' | transloco"
      >
        <ng-icon name="lucideBell" size="20" aria-hidden="true" />
        @if (notices.unreadCount() > 0) {
          <span
            hlmBadge
            variant="default"
            data-testid="bell-badge"
            class="absolute -end-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px]"
          >
            {{ notices.unreadCount() }}
          </span>
        }
      </button>
      <ng-template hlmPopoverPortal>
        <hlm-popover-content class="max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
          <h2 class="font-medium">{{ 'shell.notifications' | transloco }}</h2>
          @if (notices.history().length === 0) {
            <p class="text-muted-foreground">{{ 'shell.noNotifications' | transloco }}</p>
          } @else {
            <ul class="flex flex-col gap-3">
              @for (notice of notices.history(); track notice.id) {
                <li class="flex flex-col gap-0.5">
                  <span class="text-muted-foreground text-xs">{{ date(notice.date) }}</span>
                  <span>{{ 'notice.' + notice.kind + '.text' | transloco: notice.params }}</span>
                </li>
              }
            </ul>
          }
        </hlm-popover-content>
      </ng-template>
    </hlm-popover>
  `,
})
export class BellPanel {
  protected readonly notices = inject(NoticeService);
  private readonly language = inject(LanguageService);

  protected date(iso: string): string {
    return formatDate(iso, this.language.lang());
  }
}
