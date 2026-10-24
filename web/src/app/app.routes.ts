import { Routes } from '@angular/router';
import { signedInGuard, signedOutGuard } from './account/signed-in.guard';

// Every route is lazy, so the first load holds only the router and the guards (the sample data comes with the pages).
// The sign-in pages sit outside the app shell and are for people who are not in; everything else needs a signed-in person.
export const routes: Routes = [
  {
    path: 'sign-in',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./account/sign-in.page').then((m) => m.SignInPage),
  },
  {
    path: 'sign-up',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./account/sign-up.page').then((m) => m.SignUpPage),
  },
  {
    path: 'forgot-password',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./account/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  // The invited person's side sits outside the shell too, but it needs a signed-in person: joining is a preview for whoever
  // sent the invitation (see JoinPage).
  {
    path: 'join/:businessId/:memberId',
    canActivate: [signedInGuard],
    loadComponent: () => import('./account/join.page').then((m) => m.JoinPage),
  },
  {
    path: '',
    canActivate: [signedInGuard],
    // The shell stays active while a person moves between its pages, so its own guard is asked only once: a link clicked
    // after Sign out or Reset demo (while the sign-in page loads) would otherwise keep a signed-out visitor inside.
    canActivateChild: [signedInGuard],
    loadComponent: () => import('./shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      // A fixed path under payments (payments/import) must be listed above payments, or "import" is taken for a payment's id.
      {
        path: 'payments/import',
        loadComponent: () =>
          import('./payments/statement-import.page').then((m) => m.StatementImportPage),
      },
      // Writing a self-issued receipt is a page of its own for one payment, so it is listed above payments, whose :id has no more to give.
      {
        path: 'payments/:id/self-issued',
        loadComponent: () => import('./payments/self-issued.page').then((m) => m.SelfIssuedPage),
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
      {
        path: 'review',
        loadComponent: () => import('./review/review.page').then((m) => m.ReviewPage),
      },
      {
        path: 'taxes',
        loadComponent: () => import('./taxes/taxes.page').then((m) => m.TaxesPage),
      },
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports.page').then((m) => m.ReportsPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'settings/tax',
        loadComponent: () =>
          import('./settings/tax-details.page').then((m) => m.TaxDetailsPage),
      },
      {
        path: 'settings/invoice',
        loadComponent: () =>
          import('./settings/invoice-details.page').then((m) => m.InvoiceDetailsPage),
      },
      {
        path: 'settings/bank/connect',
        loadComponent: () =>
          import('./settings/connect-bank.page').then((m) => m.ConnectBankPage),
      },
      {
        path: 'invoices',
        loadComponent: () => import('./invoices/invoices.page').then((m) => m.InvoicesPage),
      },
      // A fixed path under invoices (such as invoices/new) must be listed above invoices/:id, or "new" is taken for an id.
      {
        path: 'invoices/new',
        loadComponent: () => import('./invoices/invoice-form.page').then((m) => m.InvoiceFormPage),
      },
      {
        path: 'invoices/:id/edit',
        loadComponent: () => import('./invoices/invoice-form.page').then((m) => m.InvoiceFormPage),
      },
      {
        path: 'invoices/:id',
        loadComponent: () => import('./invoices/invoice.page').then((m) => m.InvoicePage),
      },
      {
        path: 'account',
        loadComponent: () => import('./account/my-account.page').then((m) => m.MyAccountPage),
      },
      {
        path: 'businesses/new',
        loadComponent: () =>
          import('./account/add-business.page').then((m) => m.AddBusinessPage),
      },
      // The Help page itself. Its other pages (German terms A–Z, Write to us and one answer) are routes of their own, with the fixed paths above help/:id.
      {
        path: 'help',
        loadComponent: () => import('./help/help.page').then((m) => m.HelpPage),
      },
      {
        path: 'soon/:feature',
        loadComponent: () => import('./shell/coming-soon.page').then((m) => m.ComingSoonPage),
      },
    ],
  },
  {
    path: 'print/payment/:id',
    canActivate: [signedInGuard],
    loadComponent: () => import('./print/payment-print.page').then((m) => m.PaymentPrintPage),
  },
  {
    path: 'print/month',
    canActivate: [signedInGuard],
    loadComponent: () => import('./print/month-print.page').then((m) => m.MonthPrintPage),
  },
  {
    path: 'print/vat-return/:periodStart',
    canActivate: [signedInGuard],
    loadComponent: () => import('./print/vat-receipt.page').then((m) => m.VatReceiptPage),
  },
  {
    path: 'print/export/:period',
    canActivate: [signedInGuard],
    loadComponent: () => import('./print/export-summary.page').then((m) => m.ExportSummaryPage),
  },
  {
    path: 'print/invoice/:id',
    canActivate: [signedInGuard],
    loadComponent: () => import('./print/invoice-print.page').then((m) => m.InvoicePrintPage),
  },
  {
    path: 'print/self-issued/:docId',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./print/self-issued-print.page').then((m) => m.SelfIssuedPrintPage),
  },
];
