import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { OFFICE } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Transaction } from '../data/models';
import { SELF_ISSUED_NOTE_CENTS, type SelfIssuedInput } from '../domain/self-issued';
import { DemoStateService } from '../state/demo-state.service';
import { SelfIssuedForm } from './self-issued-form';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

describe('SelfIssuedForm', () => {
  let demo: DemoStateService;
  let fixture: ComponentFixture<SelfIssuedForm>;
  let el: HTMLElement;
  let created: SelfIssuedInput[];
  let cancelled: number;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const payment = (id: string): Transaction =>
    demo.business().transactions.find((tx) => tx.id === id)!;

  /** The form for a payment (the APCOA Parking payment unless another is given), with what it tells the page collected. */
  function show(tx: Transaction = payment('wd-t20')): void {
    created = [];
    cancelled = 0;
    fixture = TestBed.createComponent(SelfIssuedForm);
    fixture.componentRef.setInput('payment', tx);
    fixture.componentInstance.created.subscribe((input) => created.push(input));
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const input = (testId: string) =>
    el.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
  /** The radio button or checkbox inside a choice card. */
  const box = (testId: string) => q(testId)!.querySelector<HTMLInputElement>('input')!;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function type(testId: string, value: string): Promise<void> {
    input(testId).value = value;
    input(testId).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function choose(testId: string): Promise<void> {
    box(testId).click();
    await settle();
  }

  async function create(): Promise<void> {
    q('form-create')!.click();
    await settle();
  }

  it('the form prefills what it was for, and shows the payment as it is', () => {
    show();
    expect(text(q('form-title'))).toBe('Self-issued receipt (Eigenbeleg)');
    expect(text(q('form-payee'))).toBe('APCOA Parking');
    expect(text(q('form-date'))).toBe(formatDate('2026-10-20', 'en', { year: true }));
    expect(text(q('form-amount'))).toBe(formatMoney(-650, 'en', { signed: true }));
    expect(q('form-amount')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    // The prefill is German, like the receipt it lands on: the booking's German name and the reference.
    expect(input('form-purpose').value).toBe('Reisekosten Unternehmer: Parkhaus Zentrum, Automat');
    expect(Array.from(q('form-paid-to')!.children).map(text)).toEqual(['Paid to', 'APCOA Parking']);
    // Nothing is chosen or ticked yet.
    for (const id of [
      'reason-lost',
      'reason-machine',
      'reason-tip',
      'reason-sellerNone',
      'reason-other',
    ]) {
      expect(box(id).checked, id).toBe(false);
    }
    expect(box('form-confirm').checked).toBe(false);
  });

  it('prefills the reference alone for a payment that has no category yet', () => {
    show({ ...payment('wd-t20'), booking: null });
    expect(input('form-purpose').value).toBe('Parkhaus Zentrum, Automat');
  });

  it('asks the five reasons, and "Something else…" opens a text field', async () => {
    show();
    expect(
      ['reason-lost', 'reason-machine', 'reason-tip', 'reason-sellerNone', 'reason-other'].map(
        (id) => text(q(id)),
      ),
    ).toEqual([
      'It got lost',
      'The machine gave none',
      'It was a tip',
      'The seller gave none',
      'Something else…',
    ]);
    expect(q('form-reason-text')).toBeNull();
    await choose('reason-other');
    expect(q('form-reason-text')).not.toBeNull();
    await choose('reason-tip');
    expect(q('form-reason-text')).toBeNull();
  });

  it('the form needs a reason, a purpose, a reason text for other, and the tick', async () => {
    show();

    // Nothing chosen and ticked: the reason and the tick are asked for; the purpose is filled in.
    await create();
    expect(created).toEqual([]);
    expect(q('form-error-reason')).not.toBeNull();
    expect(q('form-error-purpose')).toBeNull();
    expect(text(q('form-error-confirm'))).toBe('Tick the box to confirm.');

    await choose('reason-other');
    await create();
    expect(created).toEqual([]);
    expect(q('form-error-reason')).toBeNull();
    expect(text(q('form-error-reason-text'))).toBe('Say what happened.');
    expect(input('form-reason-text').getAttribute('aria-invalid')).toBe('true');

    await type('form-reason-text', '   ');
    await create();
    expect(created).toEqual([]);
    expect(q('form-error-reason-text')).not.toBeNull();

    await type('form-reason-text', 'The ticket got wet');
    await type('form-purpose', '  ');
    await create();
    expect(created).toEqual([]);
    expect(text(q('form-error-purpose'))).toBe('Say what the money was for.');
    expect(input('form-purpose').getAttribute('aria-invalid')).toBe('true');

    await type('form-purpose', 'Parking at the client meeting');
    await create();
    expect(created).toEqual([]);
    expect(q('form-error-confirm')).not.toBeNull();

    await choose('form-confirm');
    await create();
    expect(created).toEqual([
      {
        purpose: 'Parking at the client meeting',
        reason: 'other',
        reasonText: 'The ticket got wet',
        address: null,
      },
    ]);
  });

  it('a message goes as soon as its field is changed', async () => {
    show();
    await type('form-purpose', '');
    await create();
    expect(q('form-error-purpose')).not.toBeNull();
    expect(q('form-error-reason')).not.toBeNull();
    expect(q('form-error-confirm')).not.toBeNull();

    await type('form-purpose', 'Parking');
    expect(q('form-error-purpose')).toBeNull();
    await choose('reason-lost');
    expect(q('form-error-reason')).toBeNull();
    await choose('form-confirm');
    expect(q('form-error-confirm')).toBeNull();
  });

  it('create sends what was filled in, with the reason text only for "something else"', async () => {
    show();
    await choose('reason-other');
    await type('form-reason-text', 'The ticket got wet');
    await choose('reason-machine'); // changing the answer drops the text again
    await type('form-purpose', '  Parking at the client meeting ');
    await choose('form-confirm');
    await create();
    expect(created).toEqual([
      {
        purpose: 'Parking at the client meeting',
        reason: 'machine',
        reasonText: null,
        address: null,
      },
    ]);
    expect(cancelled).toBe(0);
  });

  it('the tick names the person and today', () => {
    show();
    const label = text(q('form-confirm'));
    expect(label).toBe(
      `I confirm this is true · Sara Weber, ${formatDate(DEMO_TODAY, 'en', { year: true })}`,
    );
    expect(q('form-confirm')!.querySelector('bdi[dir="ltr"]')!.textContent).toBe(
      formatDate(DEMO_TODAY, 'en', { year: true }),
    );
  });

  it('Cancel leaves everything as it was', async () => {
    show();
    const before = demo.business();
    await type('form-purpose', 'Something');
    q('form-cancel')!.click();
    await settle();
    expect(cancelled).toBe(1);
    expect(created).toEqual([]);
    expect(demo.business()).toBe(before);
  });

  describe('the notes', () => {
    const noVat = () => text(q('note-no-vat'));
    const large = () => text(q('note-large'));

    it('notes: no VAT shown when the booking has VAT; the above-€150 note only above 150', () => {
      // APCOA: 19 % VAT, 6,50 €: the VAT note, and not the other.
      show();
      expect(noVat()).toBe(
        "No VAT can be claimed back with a self-issued receipt, so this payment's VAT won't count.",
      );
      expect(q('note-large')).toBeNull();

      // A booking with no VAT: no VAT note.
      show({ ...payment('wd-t20'), booking: { ...payment('wd-t20').booking!, vatRate: 0 } });
      expect(q('note-no-vat')).toBeNull();

      // No category yet: nothing to claim, no VAT note.
      show({ ...payment('wd-t20'), booking: null });
      expect(q('note-no-vat')).toBeNull();
    });

    it('the larger-amount note is for amounts above 150 € only: 150,00 € has none, 150,01 € has it', () => {
      expect(SELF_ISSUED_NOTE_CENTS).toBe(15000);
      show({ ...payment('wd-t20'), amountCents: -15000 });
      expect(q('note-large')).toBeNull();
      expect(q('form-address')).toBeNull();

      show({ ...payment('wd-t20'), amountCents: -15001 });
      expect(large()).toBe(
        'For larger amounts, ask the seller for a copy first; tax offices question larger self-issued receipts more often.',
      );
      // It is a note, not a block: the form still creates.
      expect(q('form-create')!.hasAttribute('disabled')).toBe(false);
    });

    it('a business that charges no VAT (a Kleinunternehmer) gets no VAT note', () => {
      demo.setBusiness('sara-yoga');
      const tx = demo.business().transactions.find((t) => t.amountCents < 0)!;
      expect(demo.business().taxProfile.kleinunternehmer).toBe(true);
      show({ ...tx, booking: OFFICE }); // a category with 19 % VAT
      expect(q('note-no-vat')).toBeNull();
    });
  });

  describe('the address', () => {
    it('is asked, optionally, only above 150 €, and sent when typed', async () => {
      show({ ...payment('wd-t20'), amountCents: -20000 });
      expect(text(q('form-address-label'))).toBe('Address (optional)');
      await type('form-address', '  Parkstraße 1, 10115 Berlin ');
      await choose('reason-lost');
      await choose('form-confirm');
      await create();
      expect(created).toEqual([
        {
          purpose: 'Reisekosten Unternehmer: Parkhaus Zentrum, Automat',
          reason: 'lost',
          reasonText: null,
          address: 'Parkstraße 1, 10115 Berlin',
        },
      ]);
    });

    it('can be left empty', async () => {
      show({ ...payment('wd-t20'), amountCents: -20000 });
      await choose('reason-lost');
      await choose('form-confirm');
      await create();
      expect(created[0].address).toBeNull();
    });

    it('is not asked at or below 150 €', () => {
      show();
      expect(q('form-address')).toBeNull();
    });
  });

  describe('languages', () => {
    it('has no missing translation in German and Arabic, and no English left over', async () => {
      for (const lang of ['de', 'ar'] as const) {
        TestBed.inject(LanguageService).setLang(lang);
        show({ ...payment('wd-t20'), amountCents: -20000 });
        await choose('reason-other');
        await create();
        const words = text(el);
        expect(words, lang).not.toContain('selfIssued.');
        expect(words, lang).not.toContain('terms.');
        expect(words, lang).not.toContain(en.selfIssued.reason.label);
        expect(words, lang).not.toContain(en.selfIssued.create);
      }
    });

    it('German: the German words, and the term once', () => {
      TestBed.inject(LanguageService).setLang('de');
      show();
      expect(text(q('form-title'))).toBe('Eigenbeleg');
      expect(text(q('reason-lost'))).toBe(de.selfIssued.reason.lost);
      expect(text(q('form-create'))).toBe(de.selfIssued.create);
      expect(text(q('form-confirm'))).toBe(
        `${de.selfIssued.confirm.text} · Sara Weber, ${formatDate(DEMO_TODAY, 'de', { year: true })}`,
      );
    });

    it('Arabic: the amount and the date stay left to right', () => {
      TestBed.inject(LanguageService).setLang('ar');
      show();
      expect(document.documentElement.dir).toBe('rtl');
      expect(q('form-amount')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      expect(q('form-date')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      expect(q('form-confirm')!.querySelector('bdi[dir="ltr"]')).not.toBeNull();
      expect(input('form-purpose').getAttribute('dir')).toBe('auto');
    });
  });

  it('shows its own title unless the page gives one (a pop-up gives its own)', () => {
    show();
    expect(q('form-title')!.tagName).toBe('H1');
  });
});
