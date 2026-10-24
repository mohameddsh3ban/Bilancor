import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { DialogCard } from '../core/layout/dialog-card';
import type { Role } from '../data/models';
import { isolateText } from '../payments/payment-history';
import { focusAfterRender } from '../settings/form-helpers';
import { DemoStateService } from '../state/demo-state.service';

/** What a row of the list shows about one business of the person. */
interface Row {
  id: string;
  name: string;
  role: Role | null;
  /** Leave is offered: not for an owner (who hands the business over first), and not for the person's last business. */
  canLeave: boolean;
  /** The person's last business, which they can't leave: it says so where Leave would be. */
  onlyOne: boolean;
}

/**
 * My account › Your businesses: each business of the signed-in person with their role in it as a word. **Leave** is for
 * every business they don't own: it asks first, and then the business is gone from this list and from the switcher (if it
 * was the open one, another opens). An owner has no Leave: they hand the business to someone else in People with access
 * first, and a line under the list says so. A person always keeps at least one business.
 *
 * Leaving says "You left …" in a line under the list, and the cursor goes there, since the button it was on is gone.
 */
@Component({
  selector: 'app-businesses-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogCard, HlmButton, HlmCardImports, HlmDialogImports, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck })],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="businesses-card">
      <header hlmCardHeader>
        <h2 hlmCardTitle tabindex="-1" class="outline-none" data-testid="businesses-title">
          {{ 'account.businesses.title' | transloco }}
        </h2>
      </header>
      <div hlmCardContent class="flex flex-col gap-4">
        <ul class="flex flex-col">
          @for (row of rows(); track row.id) {
            <li
              class="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-3 first:border-t-0 first:pt-0 last:pb-0"
              [attr.data-testid]="'business-row-' + row.id"
            >
              <p
                class="min-w-0 flex-1 basis-40 font-medium [overflow-wrap:anywhere]"
                [attr.data-testid]="'business-name-' + row.id"
              >
                <bdi>{{ row.name }}</bdi>
              </p>
              @if (row.role; as role) {
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  [class]="
                    role === 'owner'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  "
                  [attr.data-testid]="'business-role-' + row.id"
                >
                  {{ 'roles.' + role + '.name' | transloco }}
                </span>
              }
              @if (row.canLeave) {
                <button
                  hlmBtn
                  type="button"
                  variant="outline"
                  size="sm"
                  class="min-h-10 shrink-0"
                  [attr.data-testid]="'business-leave-' + row.id"
                  [attr.aria-label]="
                    'account.businesses.leaveLabel' | transloco: { business: row.name }
                  "
                  (click)="ask(row)"
                >
                  {{ 'account.businesses.leave' | transloco }}
                </button>
              } @else if (row.onlyOne) {
                <p
                  class="text-muted-foreground basis-full text-xs"
                  [attr.data-testid]="'business-only-' + row.id"
                >
                  {{ 'account.businesses.onlyOne' | transloco }}
                </p>
              }
            </li>
          }
        </ul>

        @if (ownsOne()) {
          <p class="text-muted-foreground text-sm" data-testid="businesses-owner-note">
            {{ 'account.businesses.ownerNote' | transloco }}
          </p>
        }

        <div role="status">
          @if (left(); as name) {
            <p
              class="text-positive flex items-center gap-1 text-sm outline-none"
              tabindex="-1"
              data-testid="businesses-left"
            >
              <ng-icon name="lucideCheck" size="16" aria-hidden="true" />
              {{ 'account.businesses.left' | transloco: { business: isolate(name) } }}
            </p>
          }
        </div>
      </div>
    </section>

    <!-- The pop-up shows through the overlay: nothing of it belongs in the card. -->
    <div hidden>
      <hlm-dialog
        [state]="dialogOpen() ? 'open' : 'closed'"
        autoFocus="dialog"
        (stateChanged)="onDialogState($event)"
      >
        <hlm-dialog-content
          *hlmDialogPortal
          appDialogCard
          data-testid="leave-dialog"
          [closeLabel]="'account.close' | transloco"
        >
          @if (target(); as t) {
            <hlm-dialog-header class="pe-8">
              <h2
                hlmDialogTitle
                class="text-lg leading-snug font-semibold"
                data-testid="leave-title"
              >
                {{ 'account.businesses.dialog.title' | transloco: { business: isolate(t.name) } }}
              </h2>
            </hlm-dialog-header>

            <p data-testid="leave-body">{{ 'account.businesses.dialog.body' | transloco }}</p>

            <hlm-dialog-footer>
              <button
                hlmBtn
                type="button"
                variant="outline"
                class="min-h-10"
                data-testid="leave-cancel"
                (click)="cancel(t)"
              >
                {{ 'account.cancel' | transloco }}
              </button>
              <button
                hlmBtn
                type="button"
                variant="destructive"
                class="min-h-10"
                data-testid="leave-confirm"
                (click)="confirm(t)"
              >
                {{ 'account.businesses.leave' | transloco }}
              </button>
            </hlm-dialog-footer>
          }
        </hlm-dialog-content>
      </hlm-dialog>
    </div>
  `,
})
export class BusinessesCard {
  private readonly demo = inject(DemoStateService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly isolate = isolateText;

  protected readonly rows = computed<Row[]>(() => {
    const all = this.demo.businesses;
    return all.map((business) => {
      const role = this.demo.roleIn(business.id);
      const mayLeave = role !== null && role !== 'owner';
      return {
        id: business.id,
        name: business.name,
        role,
        canLeave: mayLeave && all.length > 1,
        onlyOne: mayLeave && all.length === 1,
      };
    });
  });
  protected readonly ownsOne = computed(() => this.rows().some((row) => row.role === 'owner'));

  protected readonly dialogOpen = signal(false);
  /** The business the pop-up asks about; kept while it fades out, so the question never changes in front of the eyes. */
  protected readonly target = signal<Row | null>(null);
  /** The name of the business the person left last, for the line that says so. */
  protected readonly left = signal<string | null>(null);

  protected ask(row: Row): void {
    this.target.set(row);
    this.dialogOpen.set(true);
  }

  protected confirm(target: Row): void {
    this.demo.leaveBusiness(target.id);
    this.dialogOpen.set(false);
    // The state refuses what it must not allow; only what really happened is said.
    if (this.demo.roleIn(target.id) !== null) {
      this.focus(`business-leave-${target.id}`);
      return;
    }
    this.left.set(target.name);
    // The Leave button the cursor was on is gone with its row: it goes to the line that says what happened.
    this.focus('businesses-left');
  }

  protected cancel(target: Row): void {
    this.dialogOpen.set(false);
    this.focus(`business-leave-${target.id}`);
  }

  /** The cross, Escape and a tap outside close the pop-up by themselves; it follows. */
  protected onDialogState(state: 'open' | 'closed'): void {
    const target = this.target();
    if (state === 'closed' && this.dialogOpen() && target) this.cancel(target);
  }

  private focus(testId: string): void {
    focusAfterRender(this.injector, this.host, `[data-testid="${testId}"]`);
  }
}
