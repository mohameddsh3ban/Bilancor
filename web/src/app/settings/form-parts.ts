import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

let nextChoiceId = 0;

/**
 * One answer as a card that can be tapped anywhere: a radio button (one answer of a group `name`) or a checkbox. The
 * text is projected and may hold `<app-term>`; its button sits above the invisible input, so tapping a term opens its
 * explanation and does not choose the answer. `hint` is a smaller line under the text.
 * What is chosen belongs to the parent: it passes `checked` and listens to `changed`.
 */
@Component({
  selector: 'app-choice-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideCheck })],
  host: { class: 'block' },
  template: `
    <div
      class="has-focus-visible:ring-ring/50 relative flex h-full min-h-12 items-start gap-3 rounded-lg border p-3 text-sm has-focus-visible:ring-[3px]"
      [class]="checked() ? 'border-primary bg-primary/5' : 'border-input bg-background'"
    >
      <input
        class="absolute inset-0 size-full cursor-pointer opacity-0"
        [type]="type()"
        [name]="name()"
        [checked]="checked()"
        [attr.aria-labelledby]="uid + '-label'"
        [attr.aria-describedby]="hint() ? uid + '-hint' : null"
        (change)="changed.emit($any($event.target).checked)"
      />
      <span
        class="mt-0.5 flex size-4 shrink-0 items-center justify-center border"
        aria-hidden="true"
        [class]="
          (type() === 'radio' ? 'rounded-full ' : 'rounded-sm ') +
          (checked() ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background')
        "
      >
        @if (checked()) {
          @if (type() === 'radio') {
            <span class="bg-primary-foreground size-1.5 rounded-full"></span>
          } @else {
            <ng-icon name="lucideCheck" size="12" />
          }
        }
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span [id]="uid + '-label'" class="font-medium [&_button]:relative [&_button]:z-10 [&_button]:text-start">
          <ng-content />
        </span>
        @if (hint(); as text) {
          <span [id]="uid + '-hint'" class="text-muted-foreground text-xs">{{ text }}</span>
        }
      </span>
    </div>
  `,
})
export class ChoiceCard {
  readonly type = input<'radio' | 'checkbox'>('radio');
  readonly name = input.required<string>();
  readonly checked = input.required<boolean>();
  readonly hint = input<string>();
  /** The person chose the answer (radio) or ticked / unticked it (checkbox, with its new state). */
  readonly changed = output<boolean>();

  protected readonly uid = `choice-${nextChoiceId++}`;
}

/** The message under a field that cannot be saved as it stands; `appFieldError` is the translation key of the message, with its parameters. */
@Component({
  selector: 'p[appFieldError]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { role: 'alert', class: 'text-negative text-sm' },
  template: `{{ appFieldError() | transloco: appFieldErrorParams() }}`,
})
export class FieldError {
  readonly appFieldError = input.required<string>();
  readonly appFieldErrorParams = input<Record<string, string>>({});
}

/** "Not sure? It's in your letter from the tax office (Fragebogen zur steuerlichen Erfassung)." */
@Component({
  selector: 'p[appNotSure]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'text-muted-foreground text-xs' },
  // The German name sits in one left-to-right block with its brackets, so it keeps its shape inside an Arabic sentence.
  template: `{{ 'taxDetails.hint.text' | transloco }}
    <bdi dir="ltr">({{ 'taxDetails.hint.form' | transloco }})</bdi
    >.`,
})
export class NotSureHint {}
