import { Routes } from '@angular/router';
import { AppShell } from './shell/app-shell';
import { ComingSoonPage } from './shell/coming-soon.page';

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'payments',
        loadComponent: () => import('./payments/payments.page').then((m) => m.PaymentsPage),
        children: [
          {
            path: ':id',
            loadComponent: () =>
              import('./payments/payment-detail.page').then((m) => m.PaymentDetailPage),
          },
        ],
      },
      {
        path: 'documents',
        loadComponent: () => import('./documents/documents.page').then((m) => m.DocumentsPage),
        children: [
          {
            path: ':id',
            loadComponent: () =>
              import('./documents/document-detail.page').then((m) => m.DocumentDetailPage),
          },
        ],
      },
      { path: 'soon/:feature', component: ComingSoonPage },
    ],
  },
  {
    path: 'print/payment/:id',
    loadComponent: () => import('./print/payment-print.page').then((m) => m.PaymentPrintPage),
  },
  {
    path: 'print/month',
    loadComponent: () => import('./print/month-print.page').then((m) => m.MonthPrintPage),
  },
];
