import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

/** A list of questions, each one a link to its answer (`/help/<id>`): the questions of a page or of a topic. */
@Component({
  selector: 'app-help-questions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, RouterLink, TranslocoPipe],
  viewProviders: [provideIcons({ lucideChevronRight })],
  host: { class: 'block' },
  template: `
    <ul class="flex flex-col">
      @for (id of ids(); track id) {
        <li class="border-border border-t first:border-t-0">
          <a
            class="hover:bg-muted flex min-h-11 items-center justify-between gap-3 py-2.5"
            [routerLink]="['/help', id]"
            [attr.data-testid]="testId()"
          >
            <span class="min-w-0">{{ 'help.answers.' + id + '.q' | transloco }}</span>
            <ng-icon
              name="lucideChevronRight"
              size="16"
              class="text-muted-foreground shrink-0 rtl:rotate-180"
              aria-hidden="true"
            />
          </a>
        </li>
      }
    </ul>
  `,
})
export class HelpQuestions {
  /** The answers to list, as ids of `HELP_ANSWERS`, in the order to show them. */
  readonly ids = input.required<readonly string[]>();
  /** The `data-testid` of each question's link. */
  readonly testId = input('help-question');
}
