import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { BusinessesCard } from './businesses-card';
import { DevicesCard } from './devices-card';
import { LanguageCard } from './language-card';
import { SigningInCard } from './signing-in-card';
import { YouCard } from './you-card';

/**
 * My account (`/account`), inside the app shell: everything that belongs to the person rather than to a business, in five
 * cards: You (name, email), Language, Signing in (password, two-step login, backup codes), Where you're signed in (devices)
 * and Your businesses (with Leave). It shows the signed-in person; the person menu in the top bar opens it.
 */
@Component({
  selector: 'app-my-account-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BusinessesCard, DevicesCard, LanguageCard, SigningInCard, TranslocoPipe, YouCard],
  host: { class: 'mx-auto flex w-full max-w-2xl flex-col gap-4' },
  template: `
    <h1 class="text-2xl font-semibold" data-testid="account-title">
      {{ 'account.title' | transloco }}
    </h1>

    <app-you-card />
    <app-language-card />
    <app-signing-in-card />
    <app-devices-card />
    <app-businesses-card />
  `,
})
export class MyAccountPage {}
