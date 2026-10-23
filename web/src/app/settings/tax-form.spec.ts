import { GERMAN_STATES } from '../data/banks';
import type { TaxProfile } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import {
  demoKnowsState,
  demoStateNames,
  draftOf,
  emptyDraft,
  fiscalYearStartOf,
  taxOfficeOf,
  validateDraft,
  type TaxDraft,
} from './tax-form';

/** Text without the isolates that keep a name's direction. */
const plain = (text: string) => text.replace(/[\u2066-\u2069]/g, '');

const profileOf = (id: string): TaxProfile => BUSINESSES.find((b) => b.id === id)!.taxProfile;
const weber = profileOf('weber-design');
const sara = profileOf('sara-yoga');
const cafe = profileOf('cafe-linde');

/** A draft that answers everything: weber-design's answers. */
const filled = (): TaxDraft => draftOf(weber);
const errorsOf = (draft: TaxDraft) => {
  const result = validateDraft(draft);
  return 'errors' in result ? result.errors : null;
};
const profileFrom = (draft: TaxDraft) => {
  const result = validateDraft(draft);
  if (!('profile' in result)) throw new Error('expected a profile, got ' + JSON.stringify(result.errors));
  return result.profile;
};

describe('emptyDraft', () => {
  it('has no answer to any question, and the calendar year', () => {
    expect(emptyDraft()).toEqual({
      businessKind: null,
      chargesVat: null,
      vatPeriod: null,
      permanentExtension: false,
      vatBasis: null,
      taxState: '',
      taxNumber: '',
      vatId: '',
      ownFiscalYear: false,
      fiscalDay: '',
      fiscalMonth: '',
    });
  });
});

describe('draftOf', () => {
  it('copies the saved answers into the fields', () => {
    expect(draftOf(weber)).toEqual({
      businessKind: 'freelance',
      chargesVat: true,
      vatPeriod: 'monthly',
      permanentExtension: false,
      vatBasis: 'ist',
      taxState: 'berlin',
      taxNumber: '27/123/45678',
      vatId: '',
      ownFiscalYear: false,
      fiscalDay: '',
      fiscalMonth: '',
    });
  });

  it('a Kleinunternehmer charges no VAT and has no VAT answers', () => {
    const draft = draftOf(sara);
    expect(draft.chargesVat).toBe(false);
    expect(draft.vatPeriod).toBeNull();
    expect(draft.vatBasis).toBeNull();
  });

  it('shows a trade, a VAT ID and a financial year that is not the calendar year', () => {
    const draft = draftOf({ ...cafe, vatId: 'DE123456789', fiscalYearStart: '07-01' });
    expect(draft.businessKind).toBe('trade');
    expect(draft.vatId).toBe('DE123456789');
    expect(draft).toMatchObject({ ownFiscalYear: true, fiscalDay: '1', fiscalMonth: '7' });
  });
});

describe('validateDraft', () => {
  it('turns every sample business back into its own profile', () => {
    for (const profile of [weber, sara, cafe]) expect(profileFrom(draftOf(profile))).toEqual(profile);
  });

  it('names every question that is not answered, and nothing else', () => {
    expect(errorsOf(emptyDraft())).toEqual({
      kind: 'taxDetails.kind.error',
      vat: 'taxDetails.vat.error',
      state: 'taxDetails.number.errorState',
      number: 'taxDetails.number.errorEmpty',
    });
  });

  it('asks for the return period and Ist/Soll only after Yes', () => {
    const yes = { ...filled(), vatPeriod: null, vatBasis: null };
    expect(errorsOf(yes)).toEqual({
      period: 'taxDetails.period.error',
      basis: 'taxDetails.basis.error',
    });
    expect(errorsOf({ ...yes, chargesVat: false })).toBeNull();
  });

  it('answering No stores no VAT answers, even when the fields still hold some', () => {
    const profile = profileFrom({ ...filled(), chargesVat: false, permanentExtension: true });
    expect(profile).toMatchObject({
      kleinunternehmer: true,
      vatPeriod: null,
      permanentExtension: false,
      vatBasis: null,
    });
  });

  it('answering Yes stores the period, the extension and Ist/Soll', () => {
    const profile = profileFrom({ ...filled(), vatPeriod: 'quarterly', permanentExtension: true, vatBasis: 'soll' });
    expect(profile).toMatchObject({
      kleinunternehmer: false,
      vatPeriod: 'quarterly',
      permanentExtension: true,
      vatBasis: 'soll',
    });
  });

  it('needs a federal state before it can check the number', () => {
    expect(errorsOf({ ...filled(), taxState: '' })).toEqual({ state: 'taxDetails.number.errorState' });
  });

  it('does not find a tax office for a number that is not in the table or not written as the state writes it', () => {
    expect(errorsOf({ ...filled(), taxNumber: '99/999/99999' })).toEqual({ number: 'taxDetails.number.errorUnknown' });
    expect(errorsOf({ ...filled(), taxNumber: '27123456780' })).toEqual({ number: 'taxDetails.number.errorUnknown' });
  });

  it('says it is the demo, not the number, for a state the demo knows no tax offices for', () => {
    const demoMessage = { number: 'taxDetails.number.demoNote' };
    expect(errorsOf({ ...filled(), taxState: 'hessen' })).toEqual(demoMessage);
    expect(errorsOf({ ...filled(), taxState: 'hessen', taxNumber: '' })).toEqual(demoMessage);
    // A state the demo knows keeps asking to check the number.
    expect(errorsOf({ ...filled(), taxState: 'bayern' })).toEqual({ number: 'taxDetails.number.errorUnknown' });
    expect(errorsOf({ ...filled(), taxNumber: '' })).toEqual({ number: 'taxDetails.number.errorEmpty' });
  });

  it('keeps the number without the spaces around it', () => {
    expect(profileFrom({ ...filled(), taxNumber: '  27/123/45678 ' }).taxNumber).toBe('27/123/45678');
  });

  it('stores a VAT ID upper-cased and without spaces, and none as null', () => {
    expect(profileFrom({ ...filled(), vatId: ' de 123 456 789 ' }).vatId).toBe('DE123456789');
    expect(profileFrom({ ...filled(), vatId: '' }).vatId).toBeNull();
    expect(profileFrom({ ...filled(), vatId: '   ' }).vatId).toBeNull();
  });

  it('refuses a VAT ID that is not DE and nine digits', () => {
    for (const vatId of ['DE12345678', 'DE1234567890', 'AT123456789', '123456789', 'DEABCDEFGHI']) {
      expect(errorsOf({ ...filled(), vatId }), vatId).toEqual({ vatId: 'taxDetails.vatId.error' });
    }
  });

  it('the calendar year is 01-01; a financial year of its own is MM-DD', () => {
    expect(profileFrom(filled()).fiscalYearStart).toBe('01-01');
    const own = { ...filled(), ownFiscalYear: true, fiscalDay: '1', fiscalMonth: '7' };
    expect(profileFrom(own).fiscalYearStart).toBe('07-01');
    expect(profileFrom({ ...own, fiscalDay: '15', fiscalMonth: '10' }).fiscalYearStart).toBe('10-15');
    expect(profileFrom({ ...own, fiscalDay: ' 01 ', fiscalMonth: '07' }).fiscalYearStart).toBe('07-01');
  });

  it('a day and month typed for an own year are ignored while the calendar year is chosen', () => {
    expect(profileFrom({ ...filled(), ownFiscalYear: false, fiscalDay: '99', fiscalMonth: '99' }).fiscalYearStart).toBe('01-01');
  });

  it('refuses an own financial year with no day or month, or one that is not a real date', () => {
    const own = { ...filled(), ownFiscalYear: true };
    const notReal = [['', ''], ['1', ''], ['', '7'], ['0', '7'], ['32', '1'], ['1', '13'], ['1', '0'], ['31', '4'], ['x', '7'], ['1.5', '7'], ['-1', '7']];
    for (const [fiscalDay, fiscalMonth] of notReal) {
      expect(errorsOf({ ...own, fiscalDay, fiscalMonth }), fiscalDay + '.' + fiscalMonth).toEqual({ year: 'taxDetails.year.error' });
    }
  });

  it('collects the errors of several questions at once', () => {
    const errors = errorsOf({ ...filled(), vatPeriod: null, taxNumber: '1/2/3', vatId: 'x' });
    expect(Object.keys(errors!).sort()).toEqual(['number', 'period', 'vatId']);
  });
});

describe('fiscalYearStartOf', () => {
  it('is the real day of the month, as MM-DD, or null', () => {
    expect(fiscalYearStartOf('1', '7')).toBe('07-01');
    expect(fiscalYearStartOf('30', '4')).toBe('04-30');
    expect(fiscalYearStartOf('28', '2')).toBe('02-28');
    expect(fiscalYearStartOf('31', '12')).toBe('12-31');
    expect(fiscalYearStartOf('31', '4')).toBeNull();
    // A start on 29 February would not exist in most years.
    expect(fiscalYearStartOf('29', '2')).toBeNull();
  });
});

describe('demoKnowsState', () => {
  it('is true for the states that have a tax-number format, false for the others and for none', () => {
    for (const state of GERMAN_STATES) {
      expect(demoKnowsState(state.id), state.id).toBe(state.taxNumberPattern !== null);
    }
    expect(demoKnowsState('berlin')).toBe(true);
    expect(demoKnowsState('hessen')).toBe(false);
    expect(demoKnowsState('')).toBe(false);
    expect(demoKnowsState('atlantis')).toBe(false);
  });
});

describe('demoStateNames', () => {
  it('lists the states with a tax-number format, in the language of the page', () => {
    expect(plain(demoStateNames('en'))).toBe('Bayern, Berlin, Bremen, Hamburg and Nordrhein-Westfalen');
    expect(plain(demoStateNames('de'))).toBe('Bayern, Berlin, Bremen, Hamburg und Nordrhein-Westfalen');
    expect(plain(demoStateNames('ar'))).toContain('Nordrhein-Westfalen');
  });

  it('follows GERMAN_STATES, and keeps each name in its own direction', () => {
    const names = GERMAN_STATES.filter((state) => state.taxNumberPattern !== null).map((state) => state.name);
    for (const name of names) expect(demoStateNames('ar')).toContain('\u2068' + name + '\u2069');
  });
});

describe('taxOfficeOf', () => {
  it('is the office of a valid number, and null while the state or the number is missing or not found', () => {
    expect(taxOfficeOf({ ...emptyDraft(), taxState: 'berlin', taxNumber: '27/123/45678' })).toBe(
      'Berlin Friedrichshain-Kreuzberg',
    );
    expect(taxOfficeOf({ ...emptyDraft(), taxState: 'berlin', taxNumber: '27/123' })).toBeNull();
    expect(taxOfficeOf({ ...emptyDraft(), taxState: '', taxNumber: '27/123/45678' })).toBeNull();
    expect(taxOfficeOf({ ...emptyDraft(), taxState: 'berlin', taxNumber: '' })).toBeNull();
  });
});
