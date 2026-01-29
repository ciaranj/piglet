import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const globalAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.checkSession().pipe(
    take(1),
    map(session => {
      if (!session.authenticated) {
        authService.loginWithEntra(window.location.pathname);
        return false;
      }

      if (!session.is_global_admin) {
        router.navigate(['/unauthorized']);
        return false;
      }

      return true;
    })
  );
};
