import { DEMO_TODAY } from '../data/demo-date';
import type { Account, AccountConnection } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { bankNotices, connectionStatus, maskIban } from './bank-connection';

const accountsOf = (businessId: string): Account[] => BUSINESSES.find((b) => b.id === businessId)!.accounts;
const qonto = accountsOf('weber-design').find((a) => a.id === 'wd-qonto')!;

/** The Weber Design Qonto account with its connection changed. */
function connection(change: Partial<AccountConnection>): Account {
  return { ...qonto, connection: { ...qonto.connection, ...change } };
}

describe('connectionStatus', () => {
  it('a consent that ends in 5 days is renewSoon with 5 days left', () => {
    expect(connectionStatus(connection({ consentUntil: '2026-10-27' }))).toEqual({ kind: 'renewSoon', daysLeft: 5 });
  });

  it('a consent that ends in 14 days is still renewSoon (the 14th day counts)', () => {
    expect(connectionStatus(connection({ consentUntil: '2026-11-05' }))).toEqual({ kind: 'renewSoon', daysLeft: 14 });
  });

  it('a consent that ends in 15 days is connected', () => {
    expect(connectionStatus(connection({ consentUntil: '2026-11-06' }))).toEqual({ kind: 'connected' });
  });

  it('a consent that ends today is renewSoon with 0 days left, not ended yet', () => {
    expect(connectionStatus(connection({ consentUntil: DEMO_TODAY }))).toEqual({ kind: 'renewSoon', daysLeft: 0 });
  });

  it('a consent that ended yesterday means sign in again', () => {
    expect(connectionStatus(connection({ consentUntil: '2026-10-21' }))).toEqual({ kind: 'signInAgain' });
  });

  it('a connection the bank reports as broken means sign in again, however long the consent still runs', () => {
    expect(connectionStatus(connection({ consentUntil: '2027-04-01', broken: true }))).toEqual({ kind: 'signInAgain' });
  });

  it('counts the days across a month and a year end from the day it is given, not the demo day', () => {
    const account = connection({ consentUntil: '2027-01-03' });
    expect(connectionStatus(account, '2026-12-30')).toEqual({ kind: 'renewSoon', daysLeft: 4 });
    expect(connectionStatus(account, '2026-12-20')).toEqual({ kind: 'renewSoon', daysLeft: 14 });
    expect(connectionStatus(account, '2026-12-19')).toEqual({ kind: 'connected' });
    expect(connectionStatus(account, '2027-01-04')).toEqual({ kind: 'signInAgain' });
  });

  it('a connected account with no consent date has nothing that ends', () => {
    expect(connectionStatus(connection({ consentUntil: null }))).toEqual({ kind: 'connected' });
  });

  it('a statement account is statement, and a cash box is cash, whatever else its connection says', () => {
    const sparkasse = accountsOf('cafe-linde').find((a) => a.id === 'cl-sparkasse')!;
    const cash = accountsOf('weber-design').find((a) => a.id === 'wd-cash')!;
    expect(connectionStatus(sparkasse)).toEqual({ kind: 'statement' });
    expect(connectionStatus(cash)).toEqual({ kind: 'cash' });
    const broken = { ...sparkasse, connection: { ...sparkasse.connection, broken: true, consentUntil: '2026-10-01' } };
    expect(connectionStatus(broken)).toEqual({ kind: 'statement' });
  });

  it('the sample accounts show every status the demo promises', () => {
    const status = (businessId: string, accountId: string) =>
      connectionStatus(accountsOf(businessId).find((a) => a.id === accountId)!);
    expect(status('weber-design', 'wd-qonto')).toEqual({ kind: 'renewSoon', daysLeft: 5 });
    expect(status('sara-yoga', 'sy-qonto')).toEqual({ kind: 'signInAgain' });
    expect(status('cafe-linde', 'cl-qonto')).toEqual({ kind: 'connected' });
    expect(status('cafe-linde', 'cl-sparkasse')).toEqual({ kind: 'statement' });
    expect(status('cafe-linde', 'cl-cash')).toEqual({ kind: 'cash' });
  });
});

describe('bankNotices', () => {
  it('Weber Design gets one notice: its Qonto connection expires in 5 days', () => {
    expect(bankNotices(accountsOf('weber-design'))).toEqual([
      {
        id: 'bank-expiry-wd-qonto',
        kind: 'bankExpiry',
        urgency: 2,
        blocking: false,
        params: { bank: 'Qonto', days: 5 },
        date: DEMO_TODAY,
      },
    ]);
  });

  it('Sara Weber Yoga gets one notice: its Qonto connection has ended', () => {
    expect(bankNotices(accountsOf('sara-yoga'))).toEqual([
      {
        id: 'bank-ended-sy-qonto',
        kind: 'bankEnded',
        urgency: 1,
        blocking: false,
        params: { bank: 'Qonto' },
        date: DEMO_TODAY,
      },
    ]);
  });

  it('Café Linde gets none: one connection with months left, a statement account and a cash box', () => {
    expect(bankNotices(accountsOf('cafe-linde'))).toEqual([]);
  });

  it('a broken connection with a long consent gets the "ended" notice', () => {
    const [notice] = bankNotices([connection({ consentUntil: '2027-04-01', broken: true })]);
    expect(notice).toMatchObject({ id: 'bank-ended-wd-qonto', kind: 'bankEnded', params: { bank: 'Qonto' } });
  });

  it('gives each account its own notice, with the bank name and days of that account', () => {
    const other: Account = { ...connection({ consentUntil: '2026-11-02' }), id: 'wd-other', name: 'N26' };
    const notices = bankNotices([qonto, other, accountsOf('weber-design')[1]]);
    expect(notices.map((n) => [n.id, n.params])).toEqual([
      ['bank-expiry-wd-qonto', { bank: 'Qonto', days: 5 }],
      ['bank-expiry-wd-other', { bank: 'N26', days: 11 }],
    ]);
  });

  it('counts the days from the day it is given and dates the notice that day', () => {
    const [notice] = bankNotices([qonto], '2026-10-20');
    expect(notice).toMatchObject({ kind: 'bankExpiry', params: { bank: 'Qonto', days: 7 }, date: '2026-10-20' });
  });

  it('no notice for no accounts, and the accounts it is given stay as they are', () => {
    expect(bankNotices([])).toEqual([]);
    const accounts = structuredClone(accountsOf('weber-design'));
    bankNotices(accounts);
    expect(accounts).toEqual(accountsOf('weber-design'));
  });
});

describe('maskIban', () => {
  it('keeps the first 4 and the last 4 characters', () => {
    expect(maskIban('DE89370400440532013000')).toBe('DE89 … 3000');
  });

  it('reads an IBAN that is written in groups the same way', () => {
    expect(maskIban('DE89 3704 0044 0532 0130 00')).toBe('DE89 … 3000');
  });

  it('masks every sample IBAN, so none of the middle shows', () => {
    for (const business of BUSINESSES) {
      for (const account of business.accounts) {
        if (account.iban === null) continue;
        const masked = maskIban(account.iban);
        expect(masked).toBe(`${account.iban.slice(0, 4)} … ${account.iban.slice(-4)}`);
        expect(masked.length).toBe(11);
      }
    }
  });
});
