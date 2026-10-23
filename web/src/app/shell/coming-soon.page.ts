import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, translateSignal } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { map } from 'rxjs';

/** Every feature a link can point at; each has a `soon.<feature>` title. Anything else shows `soon.default`. */
const FEATURES: readonly string[] = [
  'home',
  'payments',
  'invoices',
  'reports',
  'help',
  'more',
  'terms',
  'unreadable',
  'revenueLimit',
  'receipt',
  'account',
  'photo',
  'selfReceipt',
  'cashPayment',
  'statementImport',
];

/** Where every link to a page that is not designed yet lands. */
@Component({
  selector: 'app-coming-soon-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, RouterLink, TranslocoPipe],
  template: `
    <section class="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 class="text-2xl font-semibold">{{ title() }}</h1>
      <p class="text-muted-foreground">{{ 'comingSoon.body' | transloco }}</p>
      <a hlmBtn variant="outline" routerLink="/">{{ 'comingSoon.back' | transloco }}</a>
    </section>
  `,
})
export class ComingSoonPage {
  private readonly feature = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('feature') ?? '')),
    { initialValue: '' },
  );

  protected readonly title = translateSignal(
    computed(() => `soon.${FEATURES.includes(this.feature()) ? this.feature() : 'default'}`),
  );
}
