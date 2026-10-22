import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { translateSignal } from '@jsverse/transloco';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmTooltip } from '@spartan-ng/helm/tooltip';
import { LanguageService } from './language.service';

export type TermKey =
  | 'ustva'
  | 'euer'
  | 'kleinunternehmer'
  | 'skr03'
  | 'eingangsbeleg'
  | 'ausgangsbeleg';

/** A German tax term: translation plus the German original, explained on hover (tooltip) or tap (popover). */
@Component({
  selector: 'app-term',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmPopoverImports, HlmTooltip],
  template: `
    <hlm-popover (stateChanged)="open.set($event === 'open')">
      <button
        hlmPopoverTrigger
        [hlmTooltip]="explain()"
        [tooltipDisabled]="open()"
        class="cursor-help underline decoration-dotted underline-offset-4"
      >
        {{ label() }}@if (showGerman()) {
          (<bdi dir="ltr">{{ german() }}</bdi>)
        }
      </button>
      <ng-template hlmPopoverPortal>
        <hlm-popover-content>{{ explain() }}</hlm-popover-content>
      </ng-template>
    </hlm-popover>
  `,
})
export class Term {
  readonly key = input.required<TermKey>();

  private readonly language = inject(LanguageService);
  protected readonly open = signal(false);

  protected readonly label = translateSignal(computed(() => `terms.${this.key()}.label`));
  protected readonly german = translateSignal(computed(() => `terms.${this.key()}.de`));
  protected readonly explain = translateSignal(computed(() => `terms.${this.key()}.explain`));
  protected readonly showGerman = computed(() => this.language.lang() !== 'de');
}
