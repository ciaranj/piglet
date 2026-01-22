import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SitesService } from '../../services/sites.service';
import { Site, AuthType } from '../../models/site.model';

@Component({
  selector: 'app-sites-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="sites-list">
      <header class="page-header">
        <h1>Documentation Sites</h1>
        <button class="btn btn-primary" (click)="showCreateDialog = true">
          + New Site
        </button>
      </header>

      @if (sitesService.loading()) {
        <div class="loading">Loading sites...</div>
      } @else {
        <div class="sites-grid">
          @for (site of sitesService.sites(); track site.id) {
            <div class="site-card">
              <div class="site-header">
                <h2>{{ site.name }}</h2>
                <a [href]="site.path" target="_blank" class="site-path">{{ site.path }}</a>
              </div>
              <div class="site-auth">
                @for (config of site.auth_configs; track config.id) {
                  @if (config.enabled) {
                    <span class="auth-badge" [class]="config.auth_type">
                      {{ formatAuthType(config.auth_type) }}
                    </span>
                  }
                }
              </div>
              <div class="site-actions">
                <a [routerLink]="['/admin/sites', site.id]" class="btn btn-secondary">
                  Manage
                </a>
                <button class="btn btn-danger" (click)="confirmDelete(site)">
                  Delete
                </button>
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <p>No documentation sites yet.</p>
              <button class="btn btn-primary" (click)="showCreateDialog = true">
                Create your first site
              </button>
            </div>
          }
        </div>
      }

      @if (showCreateDialog) {
        <div class="dialog-overlay" (click)="showCreateDialog = false">
          <div class="dialog" (click)="$event.stopPropagation()">
            <h2>Create New Site</h2>
            <form (ngSubmit)="createSite()">
              <div class="form-group">
                <label for="name">Site Name</label>
                <input
                  id="name"
                  type="text"
                  [(ngModel)]="newSite.name"
                  name="name"
                  required
                  placeholder="My Documentation"
                />
              </div>
              <div class="form-group">
                <label for="path">URL Path</label>
                <input
                  id="path"
                  type="text"
                  [(ngModel)]="newSite.path"
                  name="path"
                  required
                  placeholder="/docs"
                  pattern="^/[a-zA-Z0-9/_.-]*$"
                />
                <small>Must start with /. Example: /help, /docs/v2</small>
              </div>
              <div class="form-group">
                <label>Initial Authentication</label>
                <select [(ngModel)]="newSite.authType" name="authType">
                  <option value="anonymous">Anonymous (Public)</option>
                  <option value="google">Google Sign-In</option>
                  <option value="microsoft">Microsoft Sign-In</option>
                  <option value="email">Email Verification</option>
                </select>
              </div>
              <div class="dialog-actions">
                <button type="button" class="btn btn-secondary" (click)="showCreateDialog = false">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary" [disabled]="creating()">
                  {{ creating() ? 'Creating...' : 'Create Site' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (siteToDelete) {
        <div class="dialog-overlay" (click)="siteToDelete = null">
          <div class="dialog dialog-danger" (click)="$event.stopPropagation()">
            <h2>Delete Site</h2>
            <p>Are you sure you want to delete <strong>{{ siteToDelete.name }}</strong>?</p>
            <p class="warning">This will permanently remove all uploaded content.</p>
            <div class="dialog-actions">
              <button class="btn btn-secondary" (click)="siteToDelete = null">Cancel</button>
              <button class="btn btn-danger" (click)="deleteSite()" [disabled]="deleting()">
                {{ deleting() ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .sites-list {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .page-header h1 {
      margin: 0;
      font-size: 1.75rem;
    }

    .sites-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .site-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .site-header h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .site-path {
      color: #666;
      font-size: 0.875rem;
      text-decoration: none;
    }

    .site-path:hover {
      text-decoration: underline;
    }

    .site-auth {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .auth-badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      background: #e0e0e0;
    }

    .auth-badge.anonymous { background: #e8f5e9; color: #2e7d32; }
    .auth-badge.google { background: #fff3e0; color: #e65100; }
    .auth-badge.microsoft { background: #e3f2fd; color: #1565c0; }
    .auth-badge.email { background: #f3e5f5; color: #7b1fa2; }

    .site-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: auto;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      background: #f5f5f5;
      border-radius: 8px;
      grid-column: 1 / -1;
    }

    .loading {
      text-align: center;
      padding: 3rem;
      color: #666;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      text-decoration: none;
      display: inline-block;
    }

    .btn-primary {
      background: #1976d2;
      color: white;
    }

    .btn-primary:hover {
      background: #1565c0;
    }

    .btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .btn-secondary:hover {
      background: #d0d0d0;
    }

    .btn-danger {
      background: #d32f2f;
      color: white;
    }

    .btn-danger:hover {
      background: #c62828;
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
      max-height: 90vh;
      overflow-y: auto;
    }

    .dialog h2 {
      margin: 0 0 1rem 0;
    }

    .dialog-danger .warning {
      color: #d32f2f;
      font-size: 0.875rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
    }

    .form-group small {
      display: block;
      margin-top: 0.25rem;
      color: #666;
      font-size: 0.75rem;
    }

    .dialog-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }
  `]
})
export class SitesListComponent implements OnInit {
  sitesService = inject(SitesService);

  showCreateDialog = false;
  siteToDelete: Site | null = null;

  newSite = {
    name: '',
    path: '',
    authType: 'anonymous' as AuthType
  };

  creating = signal(false);
  deleting = signal(false);

  ngOnInit() {
    this.sitesService.loadSites().subscribe();
  }

  formatAuthType(type: AuthType): string {
    const labels: Record<AuthType, string> = {
      anonymous: 'Public',
      google: 'Google',
      microsoft: 'Microsoft',
      email: 'Email'
    };
    return labels[type] || type;
  }

  createSite() {
    if (!this.newSite.name || !this.newSite.path) return;

    this.creating.set(true);
    this.sitesService.createSite({
      name: this.newSite.name,
      path: this.newSite.path,
      auth_configs: [{ auth_type: this.newSite.authType, enabled: true }]
    }).subscribe({
      next: () => {
        this.showCreateDialog = false;
        this.newSite = { name: '', path: '', authType: 'anonymous' };
        this.creating.set(false);
      },
      error: (err) => {
        console.error('Failed to create site:', err);
        this.creating.set(false);
        alert(err.error?.error || 'Failed to create site');
      }
    });
  }

  confirmDelete(site: Site) {
    this.siteToDelete = site;
  }

  deleteSite() {
    if (!this.siteToDelete) return;

    this.deleting.set(true);
    this.sitesService.deleteSite(this.siteToDelete.id).subscribe({
      next: () => {
        this.siteToDelete = null;
        this.deleting.set(false);
      },
      error: (err) => {
        console.error('Failed to delete site:', err);
        this.deleting.set(false);
        alert(err.error?.error || 'Failed to delete site');
      }
    });
  }
}
