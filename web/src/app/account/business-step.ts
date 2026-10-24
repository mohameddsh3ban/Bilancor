import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TermText } from '../core/i18n/term';
import { ChoiceCard, FieldError, INPUT_CLASS } from '../settings/form-parts';
import type { BusinessDraft, BusinessQuestion } from './business-draft';

let nextStepId = 0;

/**
 * The questions about a business, the same in sign-up (its step 2, after the person's name) and in Add a business: the
 * business's name, what kind of work it is and whether it is just one person or partners. Each German term has its
 * explanation behind an info button, and a line says a GmbH can't sign up yet (only a sole trader or a GbR can).
 *
 * What is answered belongs to the page: it passes the `draft` (two-way) and the `errors` to show, a translation key for
 * each question that needs an answer, and the step only draws them.
 */
@Component({
  selector: 'app-business-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceCard, FieldError, TermText, TranslocoPipe],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <div class="flex flex-col gap-1">
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted-foreground">{{ 'auth.signUp.business.name' | transloco }}</span>
        <input
          type="text"
          dir="auto"
          autocomplete="organization"
          data-testid="business-name"
          [class]="inputClass"
          [value]="draft().name"
          [attr.aria-invalid]="errors().name ? 'true' : null"
          [attr.aria-describedby]="errors().name ? uid + '-error-name' : null"
          (input)="setName($event)"
        />
      </label>
      @if (errors().name; as key) {
        <p [appFieldError]="key" [id]="uid + '-error-name'" data-testid="error-business-name"></p>
      }
    </div>

    <div class="flex flex-col gap-2">
      <p class="text-sm font-medium" [id]="uid + '-kind'">
        {{ 'auth.signUp.business.kind' | transloco }}
      </p>
      <div
        role="radiogroup"
        class="grid gap-2 sm:grid-cols-2"
        [attr.aria-labelledby]="uid + '-kind'"
        [attr.aria-invalid]="errors().kind ? 'true' : null"
        [attr.aria-describedby]="errors().kind ? uid + '-error-kind' : null"
      >
        <app-choice-card
          name="kind"
          data-testid="kind-freelance"
          [checked]="draft().kind === 'freelance'"
          (changed)="set({ kind: 'freelance' })"
        >
          <app-term-text key="freiberufler" />
        </app-choice-card>
        <app-choice-card
          name="kind"
          data-testid="kind-trade"
          [checked]="draft().kind === 'trade'"
          (changed)="set({ kind: 'trade' })"
        >
          <app-term-text key="gewerbe" />
        </app-choice-card>
      </div>
      @if (errors().kind; as key) {
        <p [appFieldError]="key" [id]="uid + '-error-kind'" data-testid="error-kind"></p>
      }
    </div>

    <div class="flex flex-col gap-2">
      <p class="text-sm font-medium" [id]="uid + '-legal-form'">
        {{ 'auth.signUp.business.legalForm' | transloco }}
      </p>
      <div
        role="radiogroup"
        class="grid gap-2 sm:grid-cols-2"
        [attr.aria-labelledby]="uid + '-legal-form'"
        [attr.aria-invalid]="errors().legalForm ? 'true' : null"
        [attr.aria-describedby]="errors().legalForm ? uid + '-error-legal-form' : null"
      >
        <app-choice-card
          name="legalForm"
          data-testid="form-sole"
          [checked]="draft().legalForm === 'sole'"
          (changed)="set({ legalForm: 'sole' })"
        >
          {{ 'auth.signUp.business.sole' | transloco }}
          <span class="block font-normal"><app-term-text key="einzelunternehmen" /></span>
        </app-choice-card>
        <app-choice-card
          name="legalForm"
          data-testid="form-gbr"
          [checked]="draft().legalForm === 'gbr'"
          (changed)="set({ legalForm: 'gbr' })"
        >
          {{ 'auth.signUp.business.partners' | transloco }}
          <span class="block font-normal"><app-term-text key="gbr" /></span>
        </app-choice-card>
      </div>
      @if (errors().legalForm; as key) {
        <p
          [appFieldError]="key"
          [id]="uid + '-error-legal-form'"
          data-testid="error-legal-form"
        ></p>
      }
      <p class="text-muted-foreground text-sm" data-testid="no-gmbh">
        {{ 'auth.signUp.business.noGmbh' | transloco }}
      </p>
    </div>
  `,
})
export class BusinessStep {
  /** The answers so far; the step changes them as the person answers. */
  readonly draft = model.required<BusinessDraft>();
  /** The message (a translation key) to show under each question that needs an answer. */
  readonly errors = input<Partial<Record<BusinessQuestion, string>>>({});

  protected readonly inputClass = INPUT_CLASS;
  protected readonly uid = `business-step-${nextStepId++}`;

  protected setName(event: Event): void {
    this.set({ name: (event.target as HTMLInputElement).value });
  }

  protected set(change: Partial<BusinessDraft>): void {
    this.draft.update((draft) => ({ ...draft, ...change }));
  }
}
