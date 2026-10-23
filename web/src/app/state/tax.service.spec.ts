import { TestBed } from '@angular/core/testing';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { currentVatReturn, type VatReturnView } from '../domain/vat-return';
import { DemoStateService } from './demo-state.service';
import { SEND_MS, TaxService } from './tax.service';

describe('TaxService', () => {
  let demo: DemoStateService;
  let tax: TaxService;

  const sample = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
  const returnsOf = (id: string) => demo.businesses.find((b) => b.id === id)!.vatReturns;
  /** The open business's current VAT return, which must be one with dates. */
  const viewOf = (): VatReturnView => {
    const current = currentVatReturn(demo.business());
    if (current?.kind !== 'return') throw new Error('no VAT return with a date');
    return current.view;
  };

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    demo = TestBed.inject(DemoStateService);
    tax = TestBed.inject(TaxService);
    demo.setBusiness('cafe-linde');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cafe Q3 is sent after SEND_MS and Q4 becomes current, inProgress, due 2027-01-10', async () => {
    const before = viewOf();
    expect(before).toMatchObject({
      period: { start: '2026-07-01', end: '2026-09-30' },
      state: 'overdue',
    });

    const result = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS);

    expect(await result).toEqual({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      sentOn: DEMO_TODAY,
      chargedCents: before.chargedCents,
      paidCents: before.paidCents,
      resultCents: before.resultCents,
      ticket: expect.stringMatching(/^ET-2026-1022-\d{5}$/),
      taxOffice: 'Hamburg-Altona',
    });
    expect(returnsOf('cafe-linde').at(-1)).toEqual(await result);
    expect(returnsOf('cafe-linde')).toHaveLength(sample('cafe-linde').vatReturns.length + 1);
    expect(viewOf()).toMatchObject({
      period: { start: '2026-10-01', end: '2026-12-31' },
      state: 'inProgress',
      dueDate: '2027-01-10',
    });
  });

  it('records no tax office when the tax number gives none', async () => {
    demo.saveTaxProfile({ ...demo.business().taxProfile, taxNumber: null });
    const result = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS);
    expect((await result)!.taxOffice).toBeNull();
  });

  it('records nothing before SEND_MS is over', async () => {
    void tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS - 1);
    expect(returnsOf('cafe-linde')).toHaveLength(sample('cafe-linde').vatReturns.length);
    expect(viewOf().period.start).toBe('2026-07-01');
  });

  it('sending is true while waiting', async () => {
    expect(tax.sending()).toBe(false);
    const result = tax.send();
    expect(tax.sending()).toBe(true);

    await vi.advanceTimersByTimeAsync(SEND_MS - 1);
    expect(tax.sending()).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(tax.sending()).toBe(false);
  });

  it('sendingFor names the business whose return is on its way, and is null before and after', async () => {
    expect(tax.sendingFor()).toBeNull();
    const result = tax.send();
    expect(tax.sendingFor()).toBe('cafe-linde');

    // Another business opening mid-wait changes nothing about whose return it is.
    demo.setBusiness('weber-design');
    expect(tax.sendingFor()).toBe('cafe-linde');
    expect(tax.sending()).toBe(true);

    await vi.advanceTimersByTimeAsync(SEND_MS);
    await result;
    expect(tax.sendingFor()).toBeNull();
    expect(tax.sending()).toBe(false);
  });

  it('a send that is dropped by a reset stops saying "Sending…" at once, not when its time is up', async () => {
    const dropped = tax.send();
    expect(tax.sendingOpenBusiness()).toBe(true);

    demo.resetData();
    expect(tax.sendingFor()).toBeNull();
    expect(tax.sending()).toBe(false);
    expect(tax.sendingOpenBusiness()).toBe(false);

    await vi.advanceTimersByTimeAsync(SEND_MS);
    expect(await dropped).toBeNull();
    expect(tax.sendingFor()).toBeNull();
  });

  it('a second send while sending returns null and sends nothing twice', async () => {
    const first = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS - 100);
    expect(await tax.send()).toBeNull();

    await vi.advanceTimersByTimeAsync(100);
    expect(await first).not.toBeNull();
    expect(returnsOf('cafe-linde')).toHaveLength(sample('cafe-linde').vatReturns.length + 1);
  });

  it("weber October can't be sent (in progress)", async () => {
    demo.setBusiness('weber-design');
    expect(viewOf()).toMatchObject({
      period: { start: '2026-10-01', end: '2026-10-31' },
      state: 'inProgress',
    });
    expect(tax.canSend(viewOf())).toBe(false);

    expect(await tax.send()).toBeNull();
    expect(tax.sending()).toBe(false);
    expect(returnsOf('weber-design')).toEqual(sample('weber-design').vatReturns);
  });

  it("a period with payments needing you can't be sent", async () => {
    demo.updateTransaction('cl-t16', (tx) => ({ ...tx, booking: null }));
    expect(viewOf()).toMatchObject({ state: 'overdue' });
    expect(viewOf().needsYouCount).toBeGreaterThan(0);
    expect(tax.canSend(viewOf())).toBe(false);

    expect(await tax.send()).toBeNull();
    expect(tax.sending()).toBe(false);
    expect(returnsOf('cafe-linde')).toEqual(sample('cafe-linde').vatReturns);
  });

  it('a business that files no VAT return with a date has nothing to send', async () => {
    demo.setBusiness('sara-yoga'); // a Kleinunternehmer
    expect(currentVatReturn(demo.business())).toBeNull();

    expect(await tax.send()).toBeNull();
    expect(tax.sending()).toBe(false);
  });

  it('canSend: a return that is ready or overdue with nothing needing you can be sent, an unfinished one cannot', () => {
    const view = viewOf();
    expect(view.needsYouCount).toBe(0);
    expect(tax.canSend({ ...view, state: 'overdue' })).toBe(true);
    expect(tax.canSend({ ...view, state: 'ready' })).toBe(true);
    expect(tax.canSend({ ...view, state: 'inProgress' })).toBe(false);
    expect(tax.canSend({ ...view, needsYouCount: 1 })).toBe(false);
  });

  it('reset during sending records nothing', async () => {
    const result = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS - 100);
    demo.resetData();
    await vi.advanceTimersByTimeAsync(100);

    expect(await result).toBeNull();
    expect(tax.sending()).toBe(false);
    expect(returnsOf('cafe-linde')).toEqual(sample('cafe-linde').vatReturns);
  });

  it('reset restores the unsent return', async () => {
    const before = viewOf();
    const result = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS);
    await result;
    expect(viewOf().period.start).toBe('2026-10-01');

    demo.resetData();
    demo.setBusiness('cafe-linde'); // Reset forgets which business was open
    expect(returnsOf('cafe-linde')).toEqual(sample('cafe-linde').vatReturns);
    expect(viewOf()).toEqual(before);
    expect(tax.canSend(viewOf())).toBe(true);
  });

  it('after a reset the same return can be sent again, with the same ticket', async () => {
    const first = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS);
    const firstTicket = (await first)!.ticket;

    demo.resetData();
    demo.setBusiness('cafe-linde'); // Reset forgets which business was open
    const second = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS);
    expect((await second)!.ticket).toBe(firstTicket);
  });

  it('a send dropped by a reset lets the next one go ahead at once, and the dropped one ending does not cut it short', async () => {
    const dropped = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS / 2);
    demo.resetData();
    demo.setBusiness('cafe-linde'); // Reset forgets which business was open

    const next = tax.send();
    expect(tax.sendingFor()).toBe('cafe-linde');

    // The dropped send's time is up: it records nothing, and the next one is still on its way.
    await vi.advanceTimersByTimeAsync(SEND_MS / 2);
    expect(await dropped).toBeNull();
    expect(tax.sendingFor()).toBe('cafe-linde');

    await vi.advanceTimersByTimeAsync(SEND_MS / 2);
    expect(await next).not.toBeNull();
    expect(tax.sendingFor()).toBeNull();
  });

  it('the ticket has the year and day it was sent and five digits that stay the same for the same business and period', async () => {
    const first = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS);
    expect((await first)!.ticket).toBe('ET-2026-1022-53717');
  });

  it('is recorded for the business it was sent for, even when another one is open by then', async () => {
    const result = tax.send();
    await vi.advanceTimersByTimeAsync(SEND_MS - 100);
    demo.setBusiness('weber-design');
    await vi.advanceTimersByTimeAsync(100);

    expect(await result).toMatchObject({ periodEnd: '2026-09-30' });
    expect(returnsOf('cafe-linde')).toHaveLength(sample('cafe-linde').vatReturns.length + 1);
    expect(returnsOf('weber-design')).toEqual(sample('weber-design').vatReturns);
  });
});
