import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { focusAfterRender } from '../settings/form-helpers';
import { DemoStateService } from '../state/demo-state.service';
import {
  businessErrors,
  businessInput,
  emptyBusinessDraft,
  type BusinessDraft,
} from './business-draft';
import { BusinessStep } from './business-step';
import { PriceBox } from './price-box';
import { TermsCheck } from './terms-check';

/**
 * Add a business (`/businesses/new`), inside the app shell for a signed-in person: the price of one more business, the
 * same business questions as sign-up's second step, and the terms. Add the business makes it with the person as its
 * owner, as a new client, and opens it on the homepage. Nothing is made until every question is answered and the terms are
 * ticked.
 */
@Component({
  selector: 'app-add-business-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BusinessStep,
    HlmButton,
    HlmCardImports,
    NgIcon,
    PriceBox,
    RouterLink,
    TermsCheck,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  host: { class: 'mx-auto flex w-full max-w-2xl flex-col gap-4' },
  template: `
    <a
      class="text-primary inline-flex items-center gap-1 self-start text-sm font-medium"
      routerLink="/"
      data-testid="back-link"
    >
      <ng-icon name="lucideArrowLeft" size="16" class="rtl:rotate-180" aria-hidden="true" />
      {{ 'auth.addBusiness.back' | transloco }}
    </a>

    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold" data-testid="add-business-title">
        {{ 'auth.addBusiness.title' | transloco }}
      </h1>
      <p class="text-muted-foreground text-sm">{{ 'auth.addBusiness.intro' | transloco }}</p>
    </header>

    <form
      class="flex flex-col gap-4"
      novalidate
      data-testid="add-business-form"
      (submit)="add($event)"
    >
      <app-price-box [perBusiness]="true" />

      <section hlmCard size="sm">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'auth.addBusiness.about' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-4">
          <app-business-step [(draft)]="draft" [errors]="shownErrors()" />
        </div>
      </section>

      <section hlmCard size="sm">
        <header hlmCardHeader>
          <h2 hlmCardTitle>{{ 'auth.addBusiness.terms' | transloco }}</h2>
        </header>
        <div hlmCardContent class="flex flex-col gap-4">
          <app-terms-check [(accepted)]="accepted" [error]="termsError()" />
        </div>
      </section>

      <button
        hlmBtn
        size="lg"
        type="submit"
        class="w-full sm:w-auto sm:self-start"
        data-testid="add-business-submit"
      >
        {{ 'auth.addBusiness.submit' | transloco }}
      </button>
    </form>
  `,
})
export class AddBusinessPage {
  private readonly demo = inject(DemoStateService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly draft = signal<BusinessDraft>(emptyBusinessDraft());
  protected readonly accepted = signal(false);
  /** Whether Add the business was pressed: the messages show from then on, and go as each answer is given. */
  private readonly tried = signal(false);
  protected readonly shownErrors = computed(() =>
    this.tried() ? businessErrors(this.draft()) : {},
  );
  protected readonly termsError = computed(() =>
    this.tried() && !this.accepted() ? 'auth.terms.error' : null,
  );
  /** Set when the business starts being made, so a second tap before the page has gone makes no second business. */
  private adding = false;

  protected add(event: Event): void {
    event.preventDefault();
    if (this.adding) return;
    this.tried.set(true);
    const input = businessInput(this.draft());
    if (input === null) {
      // The first question with a message: the text field, or the first answer of a group of cards.
      focusAfterRender(
        this.injector,
        this.host,
        'input[aria-invalid="true"], [aria-invalid="true"] input',
      );
      return;
    }
    if (!this.accepted()) {
      focusAfterRender(this.injector, this.host, '[data-testid="terms-accept"] input');
      return;
    }
    this.adding = true;
    const person = this.demo.person;
    const id = this.demo.createBusiness(
      { personId: person.id, name: `${person.firstName} ${person.lastName}`, email: person.email },
      input,
    );
    this.demo.setBusiness(id);
    void this.router.navigateByUrl('/');
  }
}
