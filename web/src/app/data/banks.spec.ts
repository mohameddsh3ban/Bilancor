import { BANKS, FOUND_ACCOUNTS, GERMAN_STATES, SAMPLE_BANKS, TAX_OFFICES, banksOf, foundAccountsOf } from './banks';
import { newBusinessAccount } from './new-business-sample';
import { BUSINESSES } from './sample-data';

describe('BANKS', () => {
  it('lists the twelve common banks, each with a lower-case slug as its id', () => {
    expect(BANKS.map((b) => b.name)).toEqual([
      'Sparkasse',
      'Volksbank',
      'ING',
      'DKB',
      'N26',
      'Qonto',
      'Kontist',
      'Deutsche Bank',
      'Commerzbank',
      'Postbank',
      'HypoVereinsbank',
      'Revolut',
    ]);
    for (const bank of BANKS) expect(bank.id, bank.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(BANKS.map((b) => b.id)).size).toBe(BANKS.length);
  });
});

describe('GERMAN_STATES', () => {
  const state = (id: string) => GERMAN_STATES.find((s) => s.id === id)!;

  it('lists all sixteen federal states once', () => {
    expect(GERMAN_STATES).toHaveLength(16);
    expect(new Set(GERMAN_STATES.map((s) => s.id)).size).toBe(16);
    for (const s of GERMAN_STATES) expect(s.name.length, s.id).toBeGreaterThan(0);
  });

  it('has a tax number pattern for at least Berlin, Bayern, Hamburg, Nordrhein-Westfalen and Bremen', () => {
    for (const id of ['berlin', 'bayern', 'hamburg', 'nordrhein-westfalen', 'bremen']) {
      expect(state(id).taxNumberPattern, id).toBeInstanceOf(RegExp);
    }
  });

  it("Berlin's pattern takes 27/123/45678 and nothing shorter or unseparated", () => {
    const pattern = state('berlin').taxNumberPattern!;
    expect(pattern.test('27/123/45678')).toBe(true);
    expect(pattern.test('27/12/45678')).toBe(false);
    expect(pattern.test('2712345678')).toBe(false);
  });

  it("each covered state's pattern takes a number in its own format", () => {
    expect(state('bayern').taxNumberPattern!.test('143/123/45678')).toBe(true);
    expect(state('hamburg').taxNumberPattern!.test('41/234/56789')).toBe(true);
    expect(state('nordrhein-westfalen').taxNumberPattern!.test('133/4567/8901')).toBe(true);
    expect(state('bremen').taxNumberPattern!.test('60 123 45678')).toBe(true);
  });
});

describe('TAX_OFFICES', () => {
  it('every TAX_OFFICES state has a pattern', () => {
    const states = new Set(TAX_OFFICES.map((o) => o.state));
    for (const id of states) {
      const found = GERMAN_STATES.find((s) => s.id === id);
      expect(found, id).toBeDefined();
      expect(found!.taxNumberPattern, id).not.toBeNull();
    }
  });

  it('covers Berlin, Bayern, Hamburg, Nordrhein-Westfalen and Bremen with a few offices each', () => {
    for (const id of ['berlin', 'bayern', 'hamburg', 'nordrhein-westfalen', 'bremen']) {
      expect(TAX_OFFICES.filter((o) => o.state === id).length, id).toBeGreaterThanOrEqual(2);
    }
  });

  it('Berlin 27 is Friedrichshain-Kreuzberg', () => {
    expect(TAX_OFFICES.find((o) => o.state === 'berlin' && o.prefix === '27')?.name).toBe(
      'Berlin Friedrichshain-Kreuzberg',
    );
  });

  it('a prefix is digits only and appears once per state', () => {
    for (const o of TAX_OFFICES) expect(o.prefix, o.name).toMatch(/^\d+$/);
    const keys = TAX_OFFICES.map((o) => `${o.state}:${o.prefix}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('SAMPLE_BANKS', () => {
  it('maps each sample business to the banks it uses', () => {
    expect(SAMPLE_BANKS).toEqual({
      'weber-design': ['qonto'],
      'sara-yoga': ['qonto'],
      'cafe-linde': ['qonto', 'sparkasse'],
    });
  });

  it('only names banks from BANKS', () => {
    const ids = BANKS.map((b) => b.id);
    for (const bankIds of Object.values(SAMPLE_BANKS)) {
      for (const id of bankIds) expect(ids).toContain(id);
    }
  });
});

describe('FOUND_ACCOUNTS', () => {
  it("FOUND_ACCOUNTS lists each business's sample accounts", () => {
    for (const b of BUSINESSES) {
      expect(Object.keys(FOUND_ACCOUNTS[b.id]).sort(), b.id).toEqual(
        [...SAMPLE_BANKS[b.id]].sort(),
      );
      for (const bankId of SAMPLE_BANKS[b.id]) {
        const bankName = BANKS.find((x) => x.id === bankId)!.name;
        const sample = b.accounts.filter((a) => a.name === bankName);
        expect(sample.length, `${b.id} ${bankId}`).toBeGreaterThan(0);
        for (const account of sample)
          expect(FOUND_ACCOUNTS[b.id][bankId], `${b.id} ${bankId}`).toContainEqual(account);
      }
    }
  });

  it("every bank account of a business is found at exactly one of the business's banks", () => {
    for (const b of BUSINESSES) {
      for (const account of b.accounts.filter((a) => a.kind === 'bank')) {
        const where = SAMPLE_BANKS[b.id].filter((bankId) =>
          FOUND_ACCOUNTS[b.id][bankId].some((a) => a.id === account.id),
        );
        expect(where, account.id).toHaveLength(1);
      }
    }
  });

  it("the business's first bank also has a savings account and a credit card, with an IBAN and no payments", () => {
    for (const b of BUSINESSES) {
      const first = FOUND_ACCOUNTS[b.id][SAMPLE_BANKS[b.id][0]];
      const savings = first.filter((a) => a.product === 'savings');
      const cards = first.filter((a) => a.product === 'card');
      expect(savings, b.id).toHaveLength(1);
      expect(cards, b.id).toHaveLength(1);
      for (const extra of [...savings, ...cards]) {
        expect(extra.kind).toBe('bank');
        expect(extra.iban, extra.id).toMatch(/^DE\d{20}$/);
        expect(Number.isInteger(extra.balanceCents), extra.id).toBe(true);
        expect(
          b.transactions.some((t) => t.accountId === extra.id),
          extra.id,
        ).toBe(false);
        expect(
          b.accounts.map((a) => a.id),
          extra.id,
        ).not.toContain(extra.id);
      }
    }
  });

  it('a later bank of the business finds only its sample account', () => {
    expect(FOUND_ACCOUNTS['cafe-linde']['sparkasse'].map((a) => a.id)).toEqual(['cl-sparkasse']);
  });

  it('the found accounts are not connected yet: a savings account or card starts without a consent or a fetch', () => {
    for (const b of BUSINESSES) {
      for (const list of Object.values(FOUND_ACCOUNTS[b.id])) {
        for (const a of list.filter((x) => x.product === 'savings' || x.product === 'card')) {
          expect(a.connection, a.id).toEqual({
            kind: 'statement',
            consentUntil: null,
            lastFetched: null,
            fetchFrom: null,
            broken: false,
          });
        }
      }
    }
  });

  it('every account id across the found accounts and the businesses is unique', () => {
    const ids = [
      ...BUSINESSES.flatMap((b) => b.accounts.map((a) => a.id)),
      ...BUSINESSES.flatMap((b) =>
        Object.values(FOUND_ACCOUNTS[b.id]).flatMap((list) =>
          list.filter((a) => a.product === 'savings' || a.product === 'card').map((a) => a.id),
        ),
      ),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('banksOf', () => {
  it("is the sample business's own banks, in the order SAMPLE_BANKS has them", () => {
    expect(banksOf('weber-design')).toEqual(['qonto']);
    expect(banksOf('cafe-linde')).toEqual(['qonto', 'sparkasse']);
  });

  it('is null for a business made during the visit: any bank is its bank', () => {
    expect(banksOf('new-1')).toBeNull();
    expect(banksOf('new-14')).toBeNull();
  });

  it('is empty for an id that is neither', () => {
    expect(banksOf('nowhere')).toEqual([]);
  });
});

describe('foundAccountsOf', () => {
  it('is FOUND_ACCOUNTS for a sample business: its own accounts at its own banks, none anywhere else', () => {
    expect(foundAccountsOf('weber-design', 'qonto')).toBe(FOUND_ACCOUNTS['weber-design']['qonto']);
    expect(foundAccountsOf('cafe-linde', 'sparkasse').map((a) => a.id)).toEqual(['cl-sparkasse']);
    expect(foundAccountsOf('weber-design', 'commerzbank')).toEqual([]);
  });

  it('is one business account named after the bank for a business made during the visit, whichever bank it is', () => {
    for (const bank of BANKS) {
      expect(foundAccountsOf('new-2', bank.id), bank.id).toEqual([newBusinessAccount('new-2', bank.name)]);
    }
    expect(foundAccountsOf('new-2', 'commerzbank')[0]).toMatchObject({
      id: 'new-2-main',
      name: 'Commerzbank',
      product: 'business',
      kind: 'bank',
    });
  });

  it('finds the account under the id of the business, so each business has its own', () => {
    expect(foundAccountsOf('new-2', 'qonto')[0].id).toBe('new-2-main');
    expect(foundAccountsOf('new-7', 'qonto')[0].id).toBe('new-7-main');
  });

  it('finds nothing at a bank that is not in the list, and nothing for an id that is neither', () => {
    expect(foundAccountsOf('new-2', 'nowhere')).toEqual([]);
    expect(foundAccountsOf('nowhere', 'qonto')).toEqual([]);
  });
});
