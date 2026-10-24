import { BOTTOM_BAR_ITEMS, MENU_ITEMS, MORE_ITEMS, UPLOAD_ITEM } from './menu';

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

  it('Home, Payments, Documents, Invoices, Taxes, Reports and Settings are real pages; everything else opens coming soon', () => {
    for (const item of MENU_ITEMS) {
      const real: Record<string, string> = {
        home: '/',
        payments: '/payments',
        documents: '/documents',
        invoices: '/invoices',
        taxes: '/taxes',
        reports: '/reports',
        settings: '/settings',
      };
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

  it('menu and bottom bar open /invoices', () => {
    expect(MENU_ITEMS.find((i) => i.id === 'invoices')?.route).toBe('/invoices');
    expect(BOTTOM_BAR_ITEMS.find((i) => i.id === 'invoices')?.route).toBe('/invoices');
  });

  it('menu and homepage open /taxes: the menu entry, also from the more sheet', () => {
    expect(MENU_ITEMS.find((i) => i.id === 'taxes')?.route).toBe('/taxes');
    expect(MORE_ITEMS.find((i) => i.id === 'taxes')?.route).toBe('/taxes');
  });

  it('the menu opens /reports, also from the more sheet', () => {
    expect(MENU_ITEMS.find((i) => i.id === 'reports')?.route).toBe('/reports');
    expect(MORE_ITEMS.find((i) => i.id === 'reports')?.route).toBe('/reports');
  });

  it('menu Settings goes to /settings, also from the more sheet', () => {
    expect(MENU_ITEMS.find((i) => i.id === 'settings')?.route).toBe('/settings');
    expect(MORE_ITEMS.find((i) => i.id === 'settings')?.route).toBe('/settings');
  });

  it('bottom bar has the camera in the centre and a more slot', () => {
    expect(BOTTOM_BAR_ITEMS.map((i) => i.id)).toEqual(['home', 'payments', 'upload', 'invoices', 'more']);
    expect(BOTTOM_BAR_ITEMS[2].route).toBe('/documents');
  });

  it('Upload receipt opens Documents with the Add menu open', () => {
    expect(UPLOAD_ITEM.route).toBe('/documents');
    expect(UPLOAD_ITEM.queryParams).toEqual({ add: '1' });
    expect(BOTTOM_BAR_ITEMS[2]).toBe(UPLOAD_ITEM);
  });

  it('more lists the menu items that have no bottom bar slot', () => {
    expect(MORE_ITEMS.map((i) => i.id)).toEqual(['documents', 'taxes', 'reports', 'settings', 'help']);
  });
});
