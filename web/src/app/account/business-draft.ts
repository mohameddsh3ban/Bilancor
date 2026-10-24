import type { BusinessKind } from '../data/models';
import type { NewBusinessInput } from '../data/new-business-sample';

/** The business questions of sign-up and Add a business, as they stand while the person answers: the name, and the two choices not made yet are null. */
export interface BusinessDraft {
  name: string;
  kind: BusinessKind | null;
  legalForm: 'sole' | 'gbr' | null;
}

export type BusinessQuestion = keyof BusinessDraft;

export function emptyBusinessDraft(): BusinessDraft {
  return { name: '', kind: null, legalForm: null };
}

/** The translation key of the message for each question that has no answer yet; a question that is answered has none. */
export function businessErrors(draft: BusinessDraft): Partial<Record<BusinessQuestion, string>> {
  const errors: Partial<Record<BusinessQuestion, string>> = {};
  if (!draft.name.trim()) errors.name = 'auth.signUp.business.error.name';
  if (draft.kind === null) errors.kind = 'auth.signUp.business.error.kind';
  if (draft.legalForm === null) errors.legalForm = 'auth.signUp.business.error.legalForm';
  return errors;
}

/** What the demo state makes a business from, or null while a question is still open. */
export function businessInput(draft: BusinessDraft): NewBusinessInput | null {
  const { kind, legalForm } = draft;
  const name = draft.name.trim();
  if (!name || kind === null || legalForm === null) return null;
  return { name, kind, legalForm };
}
