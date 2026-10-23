import type { InvoiceProfile } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import {
  draftOf,
  isIban,
  nextNumberFor,
  normalizeIban,
  patternError,
  termKey,
  validateDraft,
  type InvoiceDraft,
} from './invoice-form';

const PROFILE: InvoiceProfile = {
  name: 'Weber Design',
  street: 'Lindenstr. 5',
  postcode: '10969',
  city: 'Berlin',
  email: 'weber-design@invoices.example',
  iban: 'DE08100101010482913650',
  numberPattern: 'RE-{YYYY}-{NNN}',
  paymentTermDays: 14,
  language: 'de',
};

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!;

function saved(draft: InvoiceDraft) {
  const result = validateDraft(draft, PROFILE);
  if (!('profile' in result)) throw new Error(`not saved: ${JSON.stringify(result.errors)}`);
  return result.profile;
}

describe('normalizeIban', () => {
  it('takes the spaces away and upper-cases', () => {
    expect(normalizeIban(' de08 1001 0101 0482 9136 50 ')).toBe('DE08100101010482913650');
    expect(normalizeIban('de08 1001')).toBe('DE081001');
  });
});

describe('isIban', () => {
  it('accepts a German IBAN, written with spaces or without', () => {
    expect(isIban('DE08100101010482913650')).toBe(true);
    expect(isIban('DE08 1001 0101 0482 9136 50')).toBe(true);
    expect(isIban('de08 1001 0101 0482 9136 50')).toBe(true);
  });

  it('accepts the shape of another country', () => {
    expect(isIban('GB82 WEST 1234 5698 7654 32')).toBe(true);
    expect(isIban('NL91ABNA0417164300')).toBe(true);
  });

  it('refuses what is not shaped like an IBAN', () => {
    expect(isIban('')).toBe(false);
    expect(isIban('DE')).toBe(false);
    expect(isIban('12345678901234567890')).toBe(false);
    expect(isIban('DE0810010101048291365')).toBe(false); // a German IBAN has 22 characters
    expect(isIban('DE081001010104829136501')).toBe(false);
    expect(isIban('DE08 1001 0101 0482 9136 5X')).toBe(false); // a German IBAN is digits only
    expect(isIban('DE08-1001-0101-0482-9136-50')).toBe(false);
    expect(isIban('NL91ABNA0417164300ABNA0417164300XYZ')).toBe(false); // longer than 34
  });
});

describe('patternError', () => {
  it('needs the running number {NNN}; the year {YYYY} is up to you', () => {
    expect(patternError('RE-{YYYY}-{NNN}')).toBeNull();
    expect(patternError('R{YYYY}/{NNN}.x')).toBeNull();
    expect(patternError('{NNN}')).toBeNull();
    expect(patternError('RE-{NNN}')).toBeNull();
  });

  it('says the number is missing when there is no {NNN}, and for an empty pattern', () => {
    expect(patternError('RE-{YYYY}')).toBe('invoiceDetails.pattern.errorNumber');
    expect(patternError('RE-2026')).toBe('invoiceDetails.pattern.errorNumber');
    expect(patternError('RE-{YYYY}-{NNN')).toBe('invoiceDetails.pattern.errorNumber');
    expect(patternError('')).toBe('invoiceDetails.pattern.errorNumber');
    expect(patternError('   ')).toBe('invoiceDetails.pattern.errorNumber');
  });

  it('says so when something else sits in curly brackets', () => {
    expect(patternError('RE-{YY}-{NNN}')).toBe('invoiceDetails.pattern.errorBraces');
    expect(patternError('{NNN}-{x}')).toBe('invoiceDetails.pattern.errorBraces');
    expect(patternError('{NNN}}')).toBe('invoiceDetails.pattern.errorBraces');
  });
});

describe('termKey', () => {
  it('names the terms of the choice, and any other term in general', () => {
    expect(termKey(7)).toBe('invoiceDetails.term.d7');
    expect(termKey(14)).toBe('invoiceDetails.term.d14');
    expect(termKey(30)).toBe('invoiceDetails.term.d30');
    expect(termKey(21)).toBe('invoiceDetails.term.other');
  });
});

describe('nextNumberFor', () => {
  it('is the next number of the demo year in the saved pattern', () => {
    expect(nextNumberFor(weber)).toBe('RE-2026-045');
  });

  it('can use another pattern, as typed', () => {
    expect(nextNumberFor(weber, 'R{YYYY}/{NNN}.x')).toBe('R2026/001.x');
  });
});

describe('draftOf', () => {
  it('shows the saved details, the IBAN in groups of four', () => {
    expect(draftOf(PROFILE)).toEqual({
      name: 'Weber Design',
      street: 'Lindenstr. 5',
      postcode: '10969',
      city: 'Berlin',
      iban: 'DE08 1001 0101 0482 9136 50',
      numberPattern: 'RE-{YYYY}-{NNN}',
      paymentTermDays: 14,
      language: 'de',
    });
  });

  it('shows no IBAN as an empty field', () => {
    expect(draftOf({ ...PROFILE, iban: null }).iban).toBe('');
  });
});

describe('validateDraft', () => {
  it('saves what is shown as it is, with the sender email of the business', () => {
    expect(saved(draftOf(PROFILE))).toEqual(PROFILE);
  });

  it('trims the text, and stores the IBAN without spaces, upper-cased', () => {
    const profile = saved({
      ...draftOf(PROFILE),
      name: '  Weber Studio ',
      street: ' Lindenstr. 7',
      postcode: ' 10969 ',
      city: 'Berlin ',
      iban: ' de08 1001 0101 0482 9136 50 ',
      numberPattern: ' RE-{YYYY}-{NNN} ',
    });
    expect(profile).toMatchObject({
      name: 'Weber Studio',
      street: 'Lindenstr. 7',
      postcode: '10969',
      city: 'Berlin',
      iban: 'DE08100101010482913650',
      numberPattern: 'RE-{YYYY}-{NNN}',
    });
  });

  it('stores no IBAN when the field is empty or only spaces', () => {
    expect(saved({ ...draftOf(PROFILE), iban: '' }).iban).toBeNull();
    expect(saved({ ...draftOf(PROFILE), iban: '   ' }).iban).toBeNull();
  });

  it('refuses an IBAN that is not shaped like one', () => {
    const result = validateDraft({ ...draftOf(PROFILE), iban: 'DE08 1001' }, PROFILE);
    expect(result).toEqual({ errors: { iban: 'invoiceDetails.iban.error' } });
  });

  it('refuses a pattern without {NNN}', () => {
    const result = validateDraft({ ...draftOf(PROFILE), numberPattern: 'RE-{YYYY}' }, PROFILE);
    expect(result).toEqual({ errors: { pattern: 'invoiceDetails.pattern.errorNumber' } });
  });

  it('names every problem at once', () => {
    const result = validateDraft({ ...draftOf(PROFILE), iban: 'x', numberPattern: '' }, PROFILE);
    expect(result).toEqual({
      errors: { iban: 'invoiceDetails.iban.error', pattern: 'invoiceDetails.pattern.errorNumber' },
    });
  });

  it('lets the name and address stay empty: the invoice checklist says what is missing', () => {
    const profile = saved({ ...draftOf(PROFILE), name: '', street: ' ', postcode: '', city: '' });
    expect(profile).toMatchObject({ name: '', street: '', postcode: '', city: '' });
  });

  it('keeps the term and the language as chosen', () => {
    expect(saved({ ...draftOf(PROFILE), paymentTermDays: 30, language: 'en' })).toMatchObject({
      paymentTermDays: 30,
      language: 'en',
    });
  });
});
