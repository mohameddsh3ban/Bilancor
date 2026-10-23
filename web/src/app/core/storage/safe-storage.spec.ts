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

  it('forgets every value that starts with a prefix, and only those', () => {
    localStorage.clear();
    const storage = TestBed.inject(SafeStorage);
    storage.set('mockup.a.1', '1');
    storage.set('mockup.a.2', '2');
    storage.set('mockup.b', '3');
    storage.removeWithPrefix('mockup.a.');
    expect(storage.get('mockup.a.1')).toBeNull();
    expect(storage.get('mockup.a.2')).toBeNull();
    expect(storage.get('mockup.b')).toBe('3');
    expect(localStorage.getItem('mockup.a.1')).toBeNull();
    expect(localStorage.getItem('mockup.b')).toBe('3');
  });

  it('also forgets values an earlier visit left in localStorage', () => {
    localStorage.clear();
    localStorage.setItem('mockup.a.old', 'x');
    const storage = TestBed.inject(SafeStorage);
    expect(storage.get('mockup.a.old')).toBe('x');
    storage.removeWithPrefix('mockup.a.');
    expect(storage.get('mockup.a.old')).toBeNull();
  });

  it('forgets the memory copy when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = TestBed.inject(SafeStorage);
    storage.set('mockup.a.1', '1');
    expect(() => storage.removeWithPrefix('mockup.a.')).not.toThrow();
    expect(storage.get('mockup.a.1')).toBeNull();
  });
});
