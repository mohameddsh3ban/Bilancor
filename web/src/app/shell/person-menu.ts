import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { AccountService } from '../state/account.service';

/** The first letter of the first and of the last name, in capitals: "SW" for Sara Weber. */
function initialsOf(firstName: string, lastName: string): string {
  const first = (name: string): string => Array.from(name.trim())[0] ?? '';
  return `${first(firstName)}${first(lastName)}`.toUpperCase();
}

/**
 * The person menu at the end of the top bar: the person's initials, and under them their name and email, My account and
 * Sign out. Sign out goes to the sign-in page, which says so.
 */
@Component({
  selector: 'app-person-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmDropdownMenuImports, RouterLink, TranslocoPipe],
  template: `
    <button
      type="button"
      class="bg-primary text-primary-foreground focus-visible:ring-ring/50 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold outline-none focus-visible:ring-3"
      data-testid="person-menu"
      align="end"
      [hlmDropdownMenuTrigger]="menu"
      [attr.aria-label]="'shell.account' | transloco: { name: fullName() }"
    >
      <span aria-hidden="true">{{ initials() }}</span>
    </button>
    <ng-template #menu>
      <div hlmDropdownMenu class="w-64" data-testid="person-menu-panel">
        <div class="flex min-w-0 flex-col gap-0.5 px-2 py-1.5">
          <span class="truncate text-sm font-medium" data-testid="person-menu-name">
            {{ fullName() }}
          </span>
          <span class="text-muted-foreground truncate text-xs" data-testid="person-menu-email">
            <bdi dir="ltr">{{ person().email }}</bdi>
          </span>
        </div>
        <div hlmDropdownMenuSeparator></div>
        <a hlmDropdownMenuItem routerLink="/account" data-testid="person-menu-account">
          {{ 'shell.myAccount' | transloco }}
        </a>
        <button
          hlmDropdownMenuItem
          type="button"
          data-testid="person-menu-sign-out"
          (triggered)="signOut()"
        >
          {{ 'shell.signOut' | transloco }}
        </button>
      </div>
    </ng-template>
  `,
})
export class PersonMenu {
  private readonly accounts = inject(AccountService);
  private readonly router = inject(Router);

  protected readonly person = this.accounts.person;
  protected readonly fullName = computed(
    () => `${this.person().firstName} ${this.person().lastName}`,
  );
  protected readonly initials = computed(() =>
    initialsOf(this.person().firstName, this.person().lastName),
  );

  /** Signs out and opens the sign-in page, which says "You're signed out." */
  protected signOut(): void {
    this.accounts.signOut();
    void this.router.navigate(['/sign-in'], { queryParams: { signedOut: 1 } });
  }
}
