import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

@Component({
    selector: 'app-admins-list',
    imports: [FormsModule],
    template: `
    <div class="admins-list">
      <header class="page-header">
        <h1>Global Administrators</h1>
        <p class="description">
          Global administrators can manage all documentation sites and other administrators.
        </p>
      </header>

      <div class="card">
        <ul class="admin-list">
          @for (admin of adminService.admins(); track admin.id) {
            <li>
              <div class="admin-info">
                <strong>{{ admin.display_name || 'No name' }}</strong>
                <span class="email">{{ admin.email }}</span>
                @if (admin.id === authService.user()?.id) {
                  <span class="badge">You</span>
                }
              </div>
              <div class="admin-actions">
                @if (admin.id !== authService.user()?.id) {
                  <button
                    class="btn btn-danger btn-small"
                    (click)="confirmRemove(admin)"
                  >
                    Remove
                  </button>
                }
              </div>
            </li>
          } @empty {
            <li class="empty">No administrators configured.</li>
          }
        </ul>

        <div class="add-admin">
          <h3>Add Administrator</h3>
          <div class="add-form">
            <input
              type="email"
              [(ngModel)]="newAdminEmail"
              placeholder="admin@example.com"
              (keyup.enter)="addAdmin()"
            />
            <button
              class="btn btn-primary"
              (click)="addAdmin()"
              [disabled]="!newAdminEmail || adding()"
            >
              {{ adding() ? 'Adding...' : 'Add Admin' }}
            </button>
          </div>
          @if (addError()) {
            <div class="error-message">{{ addError() }}</div>
          }
        </div>
      </div>

      @if (adminToRemove) {
        <div class="dialog-overlay" (click)="adminToRemove = null">
          <div class="dialog" (click)="$event.stopPropagation()">
            <h2>Remove Administrator</h2>
            <p>
              Are you sure you want to remove
              <strong>{{ adminToRemove.display_name || adminToRemove.email }}</strong>
              as a global administrator?
            </p>
            <div class="dialog-actions">
              <button class="btn btn-secondary" (click)="adminToRemove = null">
                Cancel
              </button>
              <button
                class="btn btn-danger"
                (click)="removeAdmin()"
                [disabled]="removing()"
              >
                {{ removing() ? 'Removing...' : 'Remove' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
    styles: [`
    .admins-list {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-header h1 {
      margin: 0;
      font-size: 1.75rem;
    }

    .description {
      color: #666;
      margin-top: 0.5rem;
    }

    .card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
    }

    .admin-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .admin-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .admin-list li:last-child {
      border-bottom: none;
    }

    .admin-list li.empty {
      color: #666;
      font-style: italic;
      justify-content: center;
    }

    .admin-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .admin-info .email {
      color: #666;
      font-size: 0.875rem;
    }

    .badge {
      display: inline-block;
      font-size: 0.75rem;
      padding: 0.125rem 0.5rem;
      background: #e3f2fd;
      color: #1565c0;
      border-radius: 4px;
      width: fit-content;
    }

    .add-admin {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e0e0e0;
    }

    .add-admin h3 {
      margin: 0 0 1rem 0;
      font-size: 1rem;
    }

    .add-form {
      display: flex;
      gap: 0.5rem;
    }

    .add-form input {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
    }

    .error-message {
      color: #d32f2f;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .btn-primary {
      background: #1976d2;
      color: white;
    }

    .btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .btn-danger {
      background: #d32f2f;
      color: white;
    }

    .btn-small {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .dialog {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      width: 100%;
      max-width: 400px;
    }

    .dialog h2 {
      margin: 0 0 1rem 0;
    }

    .dialog-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }
  `]
})
export class AdminsListComponent implements OnInit {
  adminService = inject(AdminService);
  authService = inject(AuthService);

  newAdminEmail = '';
  adminToRemove: User | null = null;

  adding = signal(false);
  removing = signal(false);
  addError = signal<string | null>(null);

  ngOnInit() {
    this.adminService.loadAdmins().subscribe();
  }

  addAdmin() {
    if (!this.newAdminEmail) return;

    this.adding.set(true);
    this.addError.set(null);

    this.adminService.addAdmin(this.newAdminEmail).subscribe({
      next: () => {
        this.newAdminEmail = '';
        this.adding.set(false);
      },
      error: (err) => {
        this.addError.set(err.error?.error || 'Failed to add administrator');
        this.adding.set(false);
      }
    });
  }

  confirmRemove(admin: User) {
    this.adminToRemove = admin;
  }

  removeAdmin() {
    if (!this.adminToRemove) return;

    this.removing.set(true);

    this.adminService.removeAdmin(this.adminToRemove.id).subscribe({
      next: () => {
        this.adminToRemove = null;
        this.removing.set(false);
      },
      error: (err) => {
        alert(err.error?.error || 'Failed to remove administrator');
        this.removing.set(false);
      }
    });
  }
}
