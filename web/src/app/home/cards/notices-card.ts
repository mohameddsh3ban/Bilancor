import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert, lucideX } from '@ng-icons/lucide';
import { Params, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { Notice, NoticeKind } from '../../data/models';
import { noticeTextKey } from '../../domain/notices';
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
              {{ textKey(notice) | transloco: notice.params }}
            </p>
            <a
              hlmBtn
              size="sm"
              variant="outline"
              class="shrink-0"
              [routerLink]="link(notice)"
              [queryParams]="queryParams(notice)"
              [fragment]="fragment(notice.kind)"
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
  protected readonly textKey = noticeTextKey;

  /**
   * Fixing unreadable receipts happens in Documents, renewing a bank connection in Settings (at its Bank accounts card),
   * the revenue limit's details on Taxes (its tracker) and reminding a customer on the invoice itself (see `queryParams`);
   * reviewing the bank-connection provider's new terms is not built yet.
   */
  protected link(notice: Notice): string[] {
    switch (notice.kind) {
      case 'unreadable':
        return ['/documents'];
      case 'revenueLimit':
        return ['/taxes'];
      case 'bankExpiry':
      case 'bankEnded':
        return ['/settings'];
      case 'invoiceOverdue':
        return ['/invoices', String(notice.params['id'])];
      default:
        return ['/soon', notice.kind];
    }
  }

  /** The invoice of an overdue notice opens its reminder (`?remind=1`), ready to send. */
  protected queryParams(notice: Notice): Params | undefined {
    return notice.kind === 'invoiceOverdue' ? { remind: 1 } : undefined;
  }

  /** The place on the page a notice's action opens: the Bank accounts card of Settings for the two bank notices. */
  protected fragment(kind: NoticeKind): string | undefined {
    return kind === 'bankExpiry' || kind === 'bankEnded' ? 'bank-accounts' : undefined;
  }
}
