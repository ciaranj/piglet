import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take, filter } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for loading to complete, then check auth
  return authService.checkSession().pipe(
    take(1),
    map(session => {
      if (!session.authenticated) {
        // Redirect to Entra login
        authService.loginWithEntra(window.location.pathname);
        return false;
      }

      if (!session.is_admin) {
        router.navigate(['/unauthorized']);
        return false;
      }

      return true;
    })
  );
};
