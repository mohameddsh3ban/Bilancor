import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert, lucideX } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { NoticeService } from '../../state/notice.service';

/** The notices that need action: the two most urgent, a dismiss for the non-blocking ones, and "+N more". */
@Component({
  selector: 'app-notices-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmCardImports, NgIcon, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideTriangleAlert, lucideX })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="notices-card">
      <ul class="flex flex-col gap-3 px-(--card-spacing)">
        @for (notice of notices.shown(); track notice.id) {
          <li class="flex items-center gap-2" [attr.data-testid]="'notice-' + notice.id">
            <ng-icon
              name="lucideTriangleAlert"
              size="18"
              aria-hidden="true"
              [class]="notice.blocking ? 'text-negative shrink-0' : 'text-warning shrink-0'"
            />
            <p class="min-w-0 flex-1 text-sm">
              {{ 'notice.' + notice.kind + '.text' | transloco: notice.params }}
            </p>
            <a
              hlmBtn
              size="sm"
              variant="outline"
              class="shrink-0"
              [routerLink]="['/soon', notice.kind]"
              [attr.data-testid]="'notice-action-' + notice.id"
            >
              {{ 'notice.' + notice.kind + '.action' | transloco }}
            </a>
            @if (!notice.blocking) {
              <button
                hlmBtn
                size="icon-sm"
                variant="ghost"
                class="shrink-0"
                type="button"
                [attr.aria-label]="'home.notices.dismiss' | transloco"
                [attr.data-testid]="'notice-dismiss-' + notice.id"
                (click)="notices.dismiss(notice.id)"
              >
                <ng-icon name="lucideX" size="16" aria-hidden="true" />
              </button>
            }
          </li>
        }
      </ul>
      @if (notices.overflow().length > 0) {
        <button
          hlmBtn
          variant="link"
          size="sm"
          type="button"
          class="self-start px-(--card-spacing)"
          data-testid="notices-more"
          (click)="notices.bellOpen.set(true)"
        >
          {{ 'home.notices.more' | transloco: { count: notices.overflow().length } }}
        </button>
      }
    </section>
  `,
})
export class NoticesCard {
  protected readonly notices = inject(NoticeService);
}
