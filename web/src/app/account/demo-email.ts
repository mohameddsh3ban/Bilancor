import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import type { Lang } from '../data/models';

/** The look of a demo help box: dashed, in the warning colour. Every demo help in the sign-in pages is one. */
export const DEMO_BOX =
  'border-warning flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm';

let nextEmailId = 0;

/**
 * An email the demo cannot send, shown on the page instead: who it is to, its subject and text, and the button the email
 * would hold. The texts are passed in already translated, in the language of the person it is to (which is not always
 * the page's: `mailLang` then marks them with their own language and direction), and the button tells the page it was
 * pressed (`act`).
 */
@Component({
  selector: 'app-demo-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section [class]="box" role="group" data-testid="demo-email" [attr.aria-labelledby]="labelId">
      <p class="text-warning text-xs font-semibold" data-testid="demo-email-label" [id]="labelId">
        {{ 'auth.demo.shown' | transloco }}
      </p>
      @if (to(); as address) {
        <p class="text-muted-foreground text-xs" data-testid="demo-email-to">
          {{ 'auth.demo.to' | transloco }} <bdi dir="ltr">{{ address }}</bdi>
        </p>
      }
      <div
        class="flex flex-col gap-2"
        data-testid="demo-email-text"
        [attr.lang]="mailLang()"
        [attr.dir]="mailDir()"
      >
        <p class="font-medium" data-testid="demo-email-subject">{{ subject() }}</p>
        <p class="text-muted-foreground" data-testid="demo-email-body">{{ body() }}</p>
        <button
          hlmBtn
          type="button"
          class="self-start"
          data-testid="demo-email-action"
          (click)="act.emit()"
        >
          {{ action() }}
        </button>
      </div>
    </section>
  `,
})
export class DemoEmail {
  readonly subject = input.required<string>();
  readonly body = input.required<string>();
  /** The button's text. */
  readonly action = input.required<string>();
  /** The address the email is to, or null for none. */
  readonly to = input<string | null>(null);
  /** The language the subject, text and button are written in, when it is not the page's: null leaves them as the page's. */
  readonly mailLang = input<Lang | null>(null);
  /** The button was pressed. */
  readonly act = output<void>();

  protected readonly box = DEMO_BOX;
  protected readonly mailDir = computed(() => {
    const lang = this.mailLang();
    return lang === null ? null : lang === 'ar' ? 'rtl' : 'ltr';
  });
  protected readonly labelId = `demo-email-${nextEmailId++}`;
}
