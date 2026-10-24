import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { DEMO_BOX } from '../account/demo-email';
import { Term } from '../core/i18n/term';
import { DEMO_TODAY } from '../data/demo-date';
import { auditFileName } from '../domain/exports';
import { DemoStateService } from '../state/demo-state.service';

/**
 * "For a tax audit": the tax office may ask for the books in a set format (GDPdU), and the card says to ask the tax advisor
 * first. Its button shows what the download would be: no file is made in the demo, so a dashed box names the file, for the
 * year of today. The box goes when another business opens.
 */
@Component({
  selector: 'app-audit-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmCardImports, Term, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section hlmCard size="sm" data-testid="audit-card">
      <header hlmCardHeader>
        <h2 hlmCardTitle data-testid="audit-title">
          {{ 'reports.audit.title' | transloco }}
          <span class="text-muted-foreground block text-xs font-normal"
            ><app-term key="gdpdu"
          /></span>
        </h2>
      </header>
      <div hlmCardContent class="flex flex-col gap-3">
        <p class="text-muted-foreground" data-testid="audit-text">
          {{ 'reports.audit.body' | transloco }}
        </p>
        <button
          hlmBtn
          type="button"
          variant="outline"
          class="min-h-10 self-start"
          data-testid="audit-download"
          (click)="shown.set(true)"
        >
          {{ 'reports.audit.download' | transloco }}
        </button>
        <div aria-live="polite">
          @if (shown()) {
            <div
              [class]="demoBox"
              role="group"
              aria-labelledby="audit-demo-label"
              data-testid="audit-demo"
            >
              <p class="text-warning text-xs font-semibold" id="audit-demo-label">
                {{ 'reports.demo.label' | transloco }}
              </p>
              <p>
                {{ 'reports.demo.noFile' | transloco }}
                <bdi dir="ltr" class="font-medium break-all" data-testid="audit-file">{{
                  fileName()
                }}</bdi>
              </p>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class AuditCard {
  private readonly demo = inject(DemoStateService);

  protected readonly demoBox = DEMO_BOX;

  /** The made-up name of the audit export of this year, for the open business. */
  protected readonly fileName = computed(() =>
    auditFileName(this.demo.business().id, Number(DEMO_TODAY.slice(0, 4))),
  );

  private readonly businessId = computed(() => this.demo.business().id);

  /** Whether the download was asked for; it starts over when another business opens. */
  protected readonly shown = linkedSignal<string, boolean>({
    source: this.businessId,
    computation: () => false,
  });
}
