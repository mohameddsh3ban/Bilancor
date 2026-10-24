import {
  lucideBell,
  lucideCamera,
  lucideChartColumn,
  lucideChevronDown,
  lucideCheck,
  lucideCircleQuestionMark,
  lucideCreditCard,
  lucideEllipsis,
  lucideFileText,
  lucideHouse,
  lucideLandmark,
  lucidePlus,
  lucideReceipt,
  lucideSettings,
} from '@ng-icons/lucide';

export type MenuId =
  | 'home'
  | 'payments'
  | 'documents'
  | 'invoices'
  | 'taxes'
  | 'reports'
  | 'settings'
  | 'help';

export interface MenuItem {
  id: MenuId;
  route: string;
  icon: string;
}

/** The main menu, in display order. Home, Payments, Documents, Invoices, Taxes and Settings are real pages; the rest open "coming soon". */
export const MENU_ITEMS: MenuItem[] = [
  { id: 'home', route: '/', icon: 'lucideHouse' },
  { id: 'payments', route: '/payments', icon: 'lucideCreditCard' },
  { id: 'documents', route: '/documents', icon: 'lucideFileText' },
  { id: 'invoices', route: '/invoices', icon: 'lucideReceipt' },
  { id: 'taxes', route: '/taxes', icon: 'lucideLandmark' },
  { id: 'reports', route: '/soon/reports', icon: 'lucideChartColumn' },
  { id: 'settings', route: '/settings', icon: 'lucideSettings' },
  { id: 'help', route: '/soon/help', icon: 'lucideCircleQuestionMark' },
];

export type BottomBarId = MenuId | 'upload' | 'more';

export interface BottomBarItem {
  id: BottomBarId;
  /** `null` for "more", which opens a menu instead of navigating. */
  route: string | null;
  /** Query parameters the link carries, if any. */
  queryParams?: Record<string, string>;
  icon: string;
}

const menuItem = (id: MenuId): MenuItem => MENU_ITEMS.find((i) => i.id === id)!;

/** "Upload receipt" opens Documents with the Add choices open (`?add=1`; the page removes it again). */
export const UPLOAD_ITEM = {
  id: 'upload',
  route: '/documents',
  queryParams: { add: '1' },
  icon: 'lucideCamera',
} as const;

/** Phone bottom bar: the camera button sits raised in the centre, "more" holds the rest of the menu. */
export const BOTTOM_BAR_ITEMS: BottomBarItem[] = [
  menuItem('home'),
  menuItem('payments'),
  UPLOAD_ITEM,
  menuItem('invoices'),
  { id: 'more', route: null, icon: 'lucideEllipsis' },
];

/** Menu entries that have no slot in the bottom bar; listed in its "more" sheet. */
export const MORE_ITEMS: MenuItem[] = MENU_ITEMS.filter(
  (item) => !BOTTOM_BAR_ITEMS.some((slot) => slot.id === item.id),
);

/** Every icon the shell uses, for `provideIcons` in each component's `viewProviders`. */
export const SHELL_ICONS = {
  lucideBell,
  lucideCamera,
  lucideChartColumn,
  lucideCheck,
  lucideChevronDown,
  lucideCircleQuestionMark,
  lucideCreditCard,
  lucideEllipsis,
  lucideFileText,
  lucideHouse,
  lucideLandmark,
  lucidePlus,
  lucideReceipt,
  lucideSettings,
};
