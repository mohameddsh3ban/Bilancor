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
      { path: 'soon/:feature', component: ComingSoonPage },
    ],
  },
];
