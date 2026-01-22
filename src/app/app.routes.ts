import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  // Admin portal routes
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        redirectTo: 'sites',
        pathMatch: 'full'
      },
      {
        path: 'sites',
        loadComponent: () => import('./admin/sites-list/sites-list.component').then(m => m.SitesListComponent)
      },
      {
        path: 'sites/:id',
        loadComponent: () => import('./admin/site-detail/site-detail.component').then(m => m.SiteDetailComponent)
      },
      {
        path: 'admins',
        loadComponent: () => import('./admin/admins-list/admins-list.component').then(m => m.AdminsListComponent)
      }
    ]
  },

  // Auth routes
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
  },

  // Utility routes
  {
    path: 'unauthorized',
    loadComponent: () => import('./shared/components/unauthorized.component').then(m => m.UnauthorizedComponent)
  },

  // Default route - redirect to admin for the _pigsty app
  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full'
  },

  // Catch-all - redirect to admin
  {
    path: '**',
    redirectTo: 'admin'
  }
];
