import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  imports: [RouterOutlet, RouterLink, RouterLinkActive]
})
export class AdminLayoutComponent {
  authService = inject(AuthService);

  logout() {
    this.authService.logout().subscribe(() => {
      window.location.href = '/';
    });
  }
}
