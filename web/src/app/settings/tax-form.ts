import type { BusinessKind, TaxProfile, VatPeriod } from '../data/models';
import { findTaxOffice, isVatId } from '../domain/tax-details';

/** The financial year that starts on 1 January. */
const CALENDAR_YEAR = '01-01';

/** How many days each month has. February stops at 28: a year cannot start on a day most years do not have. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** What "Your tax details" holds while it is filled in: every question as answered or typed so far. */
export interface TaxDraft {
  businessKind: BusinessKind | null;
  /** Yes (true) or No, a Kleinunternehmer (false); null until answered. */
  chargesVat: boolean | null;
  vatPeriod: VatPeriod | null;
  permanentExtension: boolean;
  vatBasis: 'ist' | 'soll' | null;
  /** A `GERMAN_STATES` id; empty until chosen. */
  taxState: string;
  taxNumber: string;
  vatId: string;
  /** The financial year is not the calendar year: `fiscalDay` and `fiscalMonth` hold the day it starts, as typed. */
  ownFiscalYear: boolean;
  fiscalDay: string;
  fiscalMonth: string;
}

/** The questions an error can belong to. The state and the number are two fields of one question. */
export type TaxQuestion = 'kind' | 'vat' | 'period' | 'basis' | 'state' | 'number' | 'vatId' | 'year';
/** The translation key of the message for each question that cannot be saved as it stands. */
export type TaxErrors = Partial<Record<TaxQuestion, string>>;

/** The form before anything is answered: no choice made for the person, the calendar year. */
export function emptyDraft(): TaxDraft {
  return {
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
  };
}

/** The form showing saved answers. */
export function draftOf(profile: TaxProfile): TaxDraft {
  const ownFiscalYear = profile.fiscalYearStart !== CALENDAR_YEAR;
  const [month, day] = profile.fiscalYearStart.split('-');
  return {
    businessKind: profile.businessKind,
    chargesVat: !profile.kleinunternehmer,
    vatPeriod: profile.vatPeriod,
    permanentExtension: profile.permanentExtension,
    vatBasis: profile.vatBasis,
    taxState: profile.taxState ?? '',
    taxNumber: profile.taxNumber ?? '',
    vatId: profile.vatId ?? '',
    ownFiscalYear,
    fiscalDay: ownFiscalYear ? String(Number(day)) : '',
    fiscalMonth: ownFiscalYear ? String(Number(month)) : '',
  };
}

/** The day a financial year starts, typed as a day and a month, as 'MM-DD'; null unless it is a real day of that month. */
export function fiscalYearStartOf(day: string, month: string): string | null {
  const dayText = day.trim();
  const monthText = month.trim();
  if (!/^\d{1,2}$/.test(dayText) || !/^\d{1,2}$/.test(monthText)) return null;
  const dayNumber = Number(dayText);
  const monthNumber = Number(monthText);
  if (monthNumber < 1 || monthNumber > 12) return null;
  if (dayNumber < 1 || dayNumber > DAYS_IN_MONTH[monthNumber - 1]) return null;
  return `${String(monthNumber).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
}

/** The tax office of the number typed, as soon as it is a number the chosen state writes and the table knows; else null. */
export function taxOfficeOf(draft: TaxDraft): string | null {
  return draft.taxState === '' ? null : findTaxOffice(draft.taxState, draft.taxNumber);
}

/**
 * What can be saved from the form: the tax profile, or the questions that are not answered properly. Every visible
 * question must be answered, the tax number must be one the state writes and the table knows, and a VAT ID, when filled
 * in, must be DE and nine digits (it is stored upper-cased without spaces). A business that answered No keeps no VAT
 * answers, whatever the hidden fields still hold.
 */
export function validateDraft(draft: TaxDraft): { profile: TaxProfile } | { errors: TaxErrors } {
  const errors: TaxErrors = {};

  if (draft.businessKind === null) errors.kind = 'taxDetails.kind.error';
  if (draft.chargesVat === null) errors.vat = 'taxDetails.vat.error';
  if (draft.chargesVat === true) {
    if (draft.vatPeriod === null) errors.period = 'taxDetails.period.error';
    if (draft.vatBasis === null) errors.basis = 'taxDetails.basis.error';
  }

  const taxNumber = draft.taxNumber.trim();
  if (draft.taxState === '') errors.state = 'taxDetails.number.errorState';
  if (taxNumber === '') errors.number = 'taxDetails.number.errorEmpty';
  else if (draft.taxState !== '' && findTaxOffice(draft.taxState, taxNumber) === null) {
    errors.number = 'taxDetails.number.errorUnknown';
  }

  const vatId = draft.vatId.replace(/\s/g, '').toUpperCase();
  if (vatId !== '' && !isVatId(vatId)) errors.vatId = 'taxDetails.vatId.error';

  let fiscalYearStart = CALENDAR_YEAR;
  if (draft.ownFiscalYear) {
    const start = fiscalYearStartOf(draft.fiscalDay, draft.fiscalMonth);
    if (start === null) errors.year = 'taxDetails.year.error';
    else fiscalYearStart = start;
  }

  if (Object.keys(errors).length > 0 || draft.businessKind === null) return { errors };
  const chargesVat = draft.chargesVat === true;
  return {
    profile: {
      businessKind: draft.businessKind,
      kleinunternehmer: !chargesVat,
      vatPeriod: chargesVat ? draft.vatPeriod : null,
      permanentExtension: chargesVat && draft.permanentExtension,
      vatBasis: chargesVat ? draft.vatBasis : null,
      taxState: draft.taxState,
      taxNumber,
      vatId: vatId === '' ? null : vatId,
      fiscalYearStart,
    },
  };
}
