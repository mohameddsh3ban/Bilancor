import { Injectable, computed, inject, signal } from '@angular/core';
import { DEMO_TODAY } from '../data/demo-date';
import type { SentVatReturn } from '../data/models';
import { profileTaxOffice } from '../domain/tax-details';
import { currentVatReturn, type VatReturnView } from '../domain/vat-return';
import { DemoStateService } from './demo-state.service';

/** How long sending a VAT return to the tax office (ELSTER) takes, as far as the demo is concerned. */
export const SEND_MS = 1500;

/** Five digits taken from a text: the same text always gives the same digits (FNV-1a, 32 bits). */
function fiveDigits(text: string): string {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return String(hash % 100000).padStart(5, '0');
}

/** The transfer ticket the tax office gives a sent return: `ET-<year>-<month and day sent>-<five digits of business and period>`. */
function ticketFor(businessId: string, periodStart: string, sentOn: string): string {
  return `ET-${sentOn.slice(0, 4)}-${sentOn.slice(5, 7)}${sentOn.slice(8, 10)}-${fiveDigits(`${businessId}:${periodStart}`)}`;
}

/** A return on its way: the business it is for, and the data generation it started in (a reset ends it). */
interface OnItsWay {
  businessId: string;
  generation: number;
}

/** Simulates sending the current VAT return of the open business to the tax office: it takes `SEND_MS`, then the return counts as sent. */
@Injectable({ providedIn: 'root' })
export class TaxService {
  private readonly demo = inject(DemoStateService);

  private readonly onItsWay = signal<OnItsWay | null>(null);
  /** The business whose return is on its way to the tax office, or null. Reset demo drops the send: it is null from then, not only when the time is up. */
  readonly sendingFor = computed(() => {
    const way = this.onItsWay();
    return way !== null && way.generation === this.demo.dataGeneration() ? way.businessId : null;
  });
  /** A return, of whichever business, is on its way: no other can be sent until it has arrived. */
  readonly sending = computed(() => this.sendingFor() !== null);
  /** The return on its way is the open business's, so only its screens say "Sending…". */
  readonly sendingOpenBusiness = computed(() => this.sendingFor() === this.demo.business().id);

  /** A return can be sent once its period is over and every payment in it is booked; one still in progress, or with payments waiting for the person, cannot. */
  canSend(view: VatReturnView): boolean {
    return view.state !== 'inProgress' && view.needsYouCount === 0;
  }

  /**
   * Sends the current VAT return of the open business. After `SEND_MS` it is recorded as sent, with the figures it had
   * when it was sent, today's date and a ticket, and resolves with it; the business's current return is then the next period.
   * It is recorded for the business it was sent for, whichever is open by then.
   *
   * Resolves null, and sends nothing, when there is no return with a date to send, it cannot be sent (see `canSend`), or
   * another return is on its way (a second tap changes nothing). Also null when Reset demo came in meanwhile: the data
   * it speaks of is gone.
   */
  send(): Promise<SentVatReturn | null> {
    const business = this.demo.business();
    const current = currentVatReturn(business);
    if (this.sending() || current?.kind !== 'return' || !this.canSend(current.view))
      return Promise.resolve(null);

    const { period, chargedCents, paidCents, resultCents } = current.view;
    const generation = this.demo.dataGeneration();
    const sent: SentVatReturn = {
      periodStart: period.start,
      periodEnd: period.end,
      sentOn: DEMO_TODAY,
      chargedCents,
      paidCents,
      resultCents,
      ticket: ticketFor(business.id, period.start, DEMO_TODAY),
      taxOffice: profileTaxOffice(business.taxProfile),
    };
    const way: OnItsWay = { businessId: business.id, generation };
    this.onItsWay.set(way);
    return new Promise((resolve) => {
      setTimeout(() => {
        // Only its own mark: after a reset another send may be on its way by now.
        if (this.onItsWay() === way) this.onItsWay.set(null);
        if (this.demo.dataGeneration() !== generation) return resolve(null);
        this.demo.recordSentReturn(sent, business.id);
        resolve(sent);
      }, SEND_MS);
    });
  }
}
