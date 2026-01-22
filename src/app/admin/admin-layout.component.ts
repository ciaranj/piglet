import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-layout">
      <nav class="sidebar">
        <div class="logo">
          <h1>Piglet</h1>
          <span class="subtitle">Documentation Admin</span>
        </div>

        <ul class="nav-links">
          <li>
            <a routerLink="/admin/sites" routerLinkActive="active">
              <span class="icon">&#128196;</span>
              Sites
            </a>
          </li>
          <li>
            <a routerLink="/admin/admins" routerLinkActive="active">
              <span class="icon">&#128100;</span>
              Administrators
            </a>
          </li>
        </ul>

        <div class="user-section">
          @if (authService.user(); as user) {
            <div class="user-info">
              <strong>{{ user.display_name || 'Admin' }}</strong>
              <span class="email">{{ user.email }}</span>
            </div>
          }
          <button class="btn btn-logout" (click)="logout()">
            Logout
          </button>
        </div>
      </nav>

      <main class="content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .admin-layout {
      display: flex;
      min-height: 100vh;
    }

    .sidebar {
      width: 250px;
      background: #1a1a2e;
      color: white;
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
    }

    .logo {
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .logo h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .subtitle {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
    }

    .nav-links {
      list-style: none;
      padding: 1rem 0;
      margin: 0;
      flex: 1;
    }

    .nav-links a {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      transition: background 0.2s;
    }

    .nav-links a:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .nav-links a.active {
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border-left: 3px solid #4a9eff;
    }

    .icon {
      font-size: 1.25rem;
    }

    .user-section {
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .user-info {
      display: flex;
      flex-direction: column;
      margin-bottom: 1rem;
    }

    .user-info strong {
      font-size: 0.875rem;
    }

    .user-info .email {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-logout {
      width: 100%;
      padding: 0.5rem;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .btn-logout:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .content {
      flex: 1;
      margin-left: 250px;
      background: #f5f5f5;
      min-height: 100vh;
    }
  `]
})
export class AdminLayoutComponent {
  authService = inject(AuthService);

  logout() {
    this.authService.logout().subscribe(() => {
      window.location.href = '/';
    });
  }
}
