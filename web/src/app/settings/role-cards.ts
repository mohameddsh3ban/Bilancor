import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { Term, TermText } from '../core/i18n/term';
import type { GrantedRole } from '../domain/people';
import { ChoiceCard } from './form-parts';

let nextRoleCardsId = 0;

/** The roles a person can be given, in the order the cards come: everything but the owner. */
const ROLES: readonly GrantedRole[] = ['full', 'receipts', 'advisor'];

/**
 * The three roles as cards to choose from, each with what the person can (✓) and can't (✕) do: Full access (e.g. a
 * partner), Receipts only (e.g. an assistant) and Tax advisor (Steuerberater:in, with its info button). Inviting
 * someone and changing what someone can do both use it. There is no role matrix and no custom role.
 *
 * `role` is the chosen one (two-way; null before a choice). With `readonly` it shows only the chosen role as a plain
 * card with no choice to make: the invited person reads what their role can do before they join.
 */
@Component({
  selector: 'app-role-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceCard, NgIcon, NgTemplateOutlet, Term, TermText, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck, lucideX })],
  host: { class: 'block' },
  template: `
    @if (readonly()) {
      @if (role(); as chosen) {
        <section
          class="border-input bg-background flex flex-col gap-1 rounded-lg border p-3 text-sm"
          data-testid="role-readonly"
          [attr.aria-labelledby]="uid + '-name'"
        >
          <p class="font-medium" [id]="uid + '-name'">
            @if (chosen === 'advisor') {
              <app-term key="steuerberater" />
            } @else {
              {{ 'roles.' + chosen + '.name' | transloco }}
            }
          </p>
          <ng-container
            [ngTemplateOutlet]="lines"
            [ngTemplateOutletContext]="{ $implicit: chosen }"
          />
        </section>
      }
    } @else {
      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium" [id]="uid + '-legend'">
          {{ 'people.roleCards.legend' | transloco }}
        </p>
        <div role="radiogroup" class="flex flex-col gap-2" [attr.aria-labelledby]="uid + '-legend'">
          @for (option of roles; track option) {
            <app-choice-card
              [name]="uid"
              [attr.data-testid]="'role-' + option"
              [checked]="role() === option"
              (changed)="role.set(option)"
            >
              @if (option === 'advisor') {
                <app-term-text key="steuerberater" />
              } @else {
                {{ 'roles.' + option + '.name' | transloco }}
                <span class="text-muted-foreground font-normal">
                  {{ 'roles.' + option + '.example' | transloco }}
                </span>
              }
              <span class="block font-normal">
                <ng-container
                  [ngTemplateOutlet]="lines"
                  [ngTemplateOutletContext]="{ $implicit: option }"
                />
              </span>
            </app-choice-card>
          }
        </div>
      </div>
    }

    <!-- What the role can do (✓) and can't (✕): the words "Can:" and "Can't:" are for screen readers, the signs are not read. -->
    <ng-template #lines let-option>
      <span class="mt-1 flex flex-col gap-1 text-xs font-normal">
        <span class="flex items-start gap-1.5" data-testid="role-can">
          <ng-icon
            name="lucideCheck"
            size="14"
            class="text-positive mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            <span class="sr-only">{{ 'people.roleCards.can' | transloco }}</span>
            {{ 'roles.' + option + '.can' | transloco }}
          </span>
        </span>
        <span class="flex items-start gap-1.5" data-testid="role-cant">
          <ng-icon
            name="lucideX"
            size="14"
            class="text-negative mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            <span class="sr-only">{{ 'people.roleCards.cant' | transloco }}</span>
            {{ 'roles.' + option + '.cant' | transloco }}
          </span>
        </span>
      </span>
    </ng-template>
  `,
})
export class RoleCards {
  /** The chosen role, or null before one is chosen. */
  readonly role = model<GrantedRole | null>(null);
  /** Shows only the chosen role, as a plain card to read. */
  readonly readonly = input(false);

  protected readonly roles = ROLES;
  protected readonly uid = `role-cards-${nextRoleCardsId++}`;
}
