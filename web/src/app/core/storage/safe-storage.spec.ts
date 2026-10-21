import { TestBed } from '@angular/core/testing';
import { SafeStorage } from './safe-storage';

describe('SafeStorage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('stores and reads values through localStorage', () => {
    localStorage.clear();
    const storage = TestBed.inject(SafeStorage);
    storage.set('a', '1');
    expect(storage.get('a')).toBe('1');
    expect(localStorage.getItem('a')).toBe('1');
  });

  it('returns null for a missing key', () => {
    localStorage.clear();
    expect(TestBed.inject(SafeStorage).get('missing')).toBeNull();
  });

  it('survives a throwing localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = TestBed.inject(SafeStorage);
    expect(() => storage.set('a', '1')).not.toThrow();
    expect(storage.get('a')).toBe('1');
  });
});
