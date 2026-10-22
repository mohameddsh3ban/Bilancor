import { BOTTOM_BAR_ITEMS, MENU_ITEMS, MORE_ITEMS } from './menu';

describe('menu', () => {
  it('lists the eight items in order', () => {
    expect(MENU_ITEMS.map((i) => i.id)).toEqual([
      'home',
      'payments',
      'documents',
      'invoices',
      'taxes',
      'reports',
      'settings',
      'help',
    ]);
  });

  it('Home, Payments and Documents are real pages; everything else opens coming soon', () => {
    for (const item of MENU_ITEMS) {
      const real: Record<string, string> = { home: '/', payments: '/payments', documents: '/documents' };
      expect(item.route).toBe(real[item.id] ?? `/soon/${item.id}`);
    }
  });

  it('menu Payments goes to /payments', () => {
    expect(MENU_ITEMS.find((i) => i.id === 'payments')?.route).toBe('/payments');
    expect(BOTTOM_BAR_ITEMS.find((i) => i.id === 'payments')?.route).toBe('/payments');
  });

  it('menu Documents goes to /documents', () => {
    expect(MENU_ITEMS.find((i) => i.id === 'documents')?.route).toBe('/documents');
  });

  it('bottom bar has the camera in the centre and a more slot', () => {
    expect(BOTTOM_BAR_ITEMS.map((i) => i.id)).toEqual(['home', 'payments', 'upload', 'invoices', 'more']);
    expect(BOTTOM_BAR_ITEMS[2].route).toBe('/soon/upload');
  });

  it('more lists the menu items that have no bottom bar slot', () => {
    expect(MORE_ITEMS.map((i) => i.id)).toEqual(['documents', 'taxes', 'reports', 'settings', 'help']);
  });
});
