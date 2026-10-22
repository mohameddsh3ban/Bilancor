import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';
import { TranslocoPipe, translateSignal } from '@jsverse/transloco';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmTooltip } from '@spartan-ng/helm/tooltip';
import { LanguageService } from './language.service';

export type TermKey =
  | 'ustva'
  | 'euer'
  | 'kleinunternehmer'
  | 'skr03'
  | 'eingangsbeleg'
  | 'ausgangsbeleg'
  | 'freiberufler'
  | 'gewerbe'
  | 'dauerfristverlaengerung'
  | 'istVersteuerung'
  | 'sollVersteuerung'
  | 'steuernummer'
  | 'ustIdNr'
  | 'finanzamt';

/** The words of a German tax term as plain text: the translation, and the German original next to it (not in German). */
@Component({
  selector: 'app-term-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ label() }}@if (showGerman()) {
      (<bdi dir="ltr">{{ german() }}</bdi>)
    }`,
})
export class TermText {
  readonly key = input.required<TermKey>();

  private readonly language = inject(LanguageService);
  protected readonly label = translateSignal(computed(() => `terms.${this.key()}.label`));
  protected readonly german = translateSignal(computed(() => `terms.${this.key()}.de`));
  protected readonly showGerman = computed(() => this.language.lang() !== 'de');
}

/** A German tax term: translation plus the German original, explained on hover (tooltip) or tap (popover). */
@Component({
  selector: 'app-term',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmPopoverImports, HlmTooltip, TermText],
  template: `
    <hlm-popover (stateChanged)="open.set($event === 'open')">
      <button
        hlmPopoverTrigger
        [hlmTooltip]="explain()"
        [tooltipDisabled]="open()"
        class="cursor-help underline decoration-dotted underline-offset-4"
      >
        <app-term-text [key]="key()" />
      </button>
      <ng-template hlmPopoverPortal>
        <hlm-popover-content>{{ explain() }}</hlm-popover-content>
      </ng-template>
    </hlm-popover>
  `,
})
export class Term {
  readonly key = input.required<TermKey>();

  protected readonly open = signal(false);

  protected readonly explain = translateSignal(computed(() => `terms.${this.key()}.explain`));
}

/**
 * The explanation of a German tax term behind a small info button of its own ("What is Freelance work?"), for a place
 * where the words of the term must stay plain text, such as the label of an answer that the whole text chooses. It
 * explains on hover (tooltip) or tap (popover), like `<app-term>`. The button is 32 px wide and high.
 */
@Component({
  selector: 'app-term-info',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmPopoverImports, HlmTooltip, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideInfo })],
  host: { class: 'inline-flex' },
  template: `
    <hlm-popover (stateChanged)="open.set($event === 'open')">
      <button
        hlmPopoverTrigger
        [hlmTooltip]="explain()"
        [tooltipDisabled]="open()"
        class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-8 cursor-help items-center justify-center rounded-full focus-visible:ring-[3px] focus-visible:outline-none"
        [attr.aria-label]="'terms.whatIs' | transloco: { term: label() }"
      >
        <ng-icon name="lucideInfo" size="16" aria-hidden="true" />
      </button>
      <ng-template hlmPopoverPortal>
        <hlm-popover-content>{{ explain() }}</hlm-popover-content>
      </ng-template>
    </hlm-popover>
  `,
})
export class TermInfo {
  readonly key = input.required<TermKey>();

  protected readonly open = signal(false);

  protected readonly label = translateSignal(computed(() => `terms.${this.key()}.label`));
  protected readonly explain = translateSignal(computed(() => `terms.${this.key()}.explain`));
}
