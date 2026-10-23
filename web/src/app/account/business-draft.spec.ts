import {
  businessErrors,
  businessInput,
  emptyBusinessDraft,
  type BusinessDraft,
} from './business-draft';

describe('the business draft', () => {
  const filled: BusinessDraft = { name: 'Weber Design', kind: 'freelance', legalForm: 'sole' };

  it('starts with nothing answered', () => {
    expect(emptyBusinessDraft()).toEqual({ name: '', kind: null, legalForm: null });
  });

  it('names a translation key for each question left open', () => {
    expect(businessErrors(emptyBusinessDraft())).toEqual({
      name: 'auth.signUp.business.error.name',
      kind: 'auth.signUp.business.error.kind',
      legalForm: 'auth.signUp.business.error.legalForm',
    });
    expect(businessErrors({ ...filled, kind: null })).toEqual({
      kind: 'auth.signUp.business.error.kind',
    });
    expect(businessErrors(filled)).toEqual({});
  });

  it('counts a name of spaces as no name', () => {
    expect(businessErrors({ ...filled, name: '   ' })).toEqual({
      name: 'auth.signUp.business.error.name',
    });
  });

  it('turns a complete draft into what the demo state needs, without the spaces around the name', () => {
    expect(
      businessInput({ ...filled, name: '  Weber Design ', kind: 'trade', legalForm: 'gbr' }),
    ).toEqual({
      name: 'Weber Design',
      kind: 'trade',
      legalForm: 'gbr',
    });
  });

  it('gives nothing for a draft that still has an error', () => {
    expect(businessInput(emptyBusinessDraft())).toBeNull();
    expect(businessInput({ ...filled, legalForm: null })).toBeNull();
    expect(businessInput({ ...filled, name: ' ' })).toBeNull();
  });
});
