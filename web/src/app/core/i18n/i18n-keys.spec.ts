import en from '../../../../public/i18n/en.json';
import de from '../../../../public/i18n/de.json';
import ar from '../../../../public/i18n/ar.json';
import { TERM_KEYS } from './term-keys';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('translation files', () => {
  const enKeys = flatten(en).sort();

  it('every en key exists in de and ar', () => {
    expect(flatten(de).sort()).toEqual(enKeys);
    expect(flatten(ar).sort()).toEqual(enKeys);
  });

  it('the kind label above a review card is a short state, never a question (the card asks its own)', () => {
    const files = { en, de, ar };
    for (const [lang, file] of Object.entries(files)) {
      for (const [problem, label] of Object.entries(file.review.kind)) {
        expect(label, `${lang} review.kind.${problem}`).not.toMatch(/[?؟]/);
      }
    }
  });

  it('has a history text for tax changes, connecting and renewing a bank, and adding a cash box', () => {
    for (const key of ['taxChanged', 'bankConnected', 'bankRenewed', 'cashAdded']) {
      expect(enKeys).toContain(`history.${key}`);
    }
    expect(en.history.bankConnected).toContain('{{account}}');
    expect(en.history.bankConnected).toContain('{{bank}}');
    expect(en.history.bankRenewed).toContain('{{bank}}');
  });

  it('has a history text for every change to people and support access, naming who did it', () => {
    const keys = [
      'personInvited',
      'invitationCancelled',
      'personJoined',
      'roleChanged',
      'personRemoved',
      'personLeft',
      'ownerChanged',
      'supportOn',
      'supportOff',
    ];
    for (const lang of [en, de, ar]) {
      const history = lang.history as Record<string, string>;
      for (const key of keys) expect(history[key], key).toMatch(/\{\{(by|name)\}\}/);
    }
    expect(en.history.personInvited).toContain('{{email}}');
    expect(en.history.personInvited).toContain('{{role}}');
    expect(en.history.supportOn).toContain('{{until}}');
  });

  it('has a history text for a payment marked as paid with own money and for adding the Own money account, as for the cash box', () => {
    for (const lang of [en, de, ar]) {
      expect(lang.history.paidWithOwnMoney).toBeTruthy();
      expect(lang.history.ownMoneyAdded).toBeTruthy();
      expect(lang.history.paidWithOwnMoney).not.toBe(lang.history.paidInCash);
    }
    expect(en.history.paidWithOwnMoney).toBe('You marked it as paid with your own money');
    expect(de.history.paidWithOwnMoney).toBe('Du hast sie als mit eigenem Geld bezahlt markiert');
  });

  it('has a history text for a closed month, naming the month and who closed it, and one for a month its VAT return closed', () => {
    for (const lang of [en, de, ar]) {
      expect(lang.history.monthClosed).toContain('{{month}}');
      expect(lang.history.monthClosed).toContain('{{by}}');
      // No person behind it, so no {{by}}.
      expect(lang.history.monthClosedByReturn).toContain('{{month}}');
      expect(lang.history.monthClosedByReturn).not.toContain('{{by}}');
    }
  });

  it('has a history text for a self-issued receipt (its number) and for the VAT it takes off the payment', () => {
    for (const lang of [en, de, ar]) {
      expect(lang.history.selfIssued).toContain('{{number}}');
      expect(lang.history.vatRemovedSelfIssued).toBeTruthy();
    }
    expect(en.history.vatRemovedSelfIssued).toBe('VAT removed: self-issued receipt');
  });

  it('has a name for every role, and what the three roles that can be given can and can not do', () => {
    for (const lang of [en, de, ar]) {
      const roles = lang.roles as Record<string, Record<string, string>>;
      for (const role of ['owner', 'full', 'receipts', 'advisor']) {
        expect(roles[role]['name'], role).toBeTruthy();
      }
      for (const role of ['full', 'receipts', 'advisor']) {
        expect(roles[role]['can'], role).toBeTruthy();
        expect(roles[role]['cant'], role).toBeTruthy();
      }
    }
  });

  it('has the German tax terms with label, de and explain', () => {
    for (const term of TERM_KEYS) {
      for (const part of ['label', 'de', 'explain']) {
        expect(enKeys).toContain(`terms.${term}.${part}`);
      }
    }
  });
});
