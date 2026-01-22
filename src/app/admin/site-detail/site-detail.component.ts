import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { SitesService } from '../../services/sites.service';
import { UploadService } from '../../services/upload.service';
import { Site, AuthConfig, AuthType, EmailSettings, ContentVersion } from '../../models/site.model';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-site-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="site-detail">
      @if (loading()) {
        <div class="loading">Loading site...</div>
      } @else if (site()) {
        <header class="page-header">
          <div>
            <a routerLink="/admin/sites" class="back-link">&larr; Back to Sites</a>
            <h1>{{ site()!.name }}</h1>
            <a [href]="site()!.path" target="_blank" class="site-path">{{ site()!.path }}</a>
          </div>
        </header>

        <div class="content-grid">
          <!-- Site Settings -->
          <section class="card">
            <h2>Site Settings</h2>
            <form (ngSubmit)="updateSite()">
              <div class="form-group">
                <label for="name">Site Name</label>
                <input id="name" type="text" [(ngModel)]="editName" name="name" required />
              </div>
              <div class="form-group">
                <label for="path">URL Path</label>
                <input id="path" type="text" [(ngModel)]="editPath" name="path" required
                       pattern="^/[a-zA-Z0-9/_.-]*$" />
              </div>
              <button type="submit" class="btn btn-primary" [disabled]="saving()">
                {{ saving() ? 'Saving...' : 'Save Changes' }}
              </button>
            </form>
          </section>

          <!-- Content Versions -->
          <section class="card">
            <div class="card-header">
              <div>
                <h2>Content Versions</h2>
                <p class="description">Manage uploaded content versions.</p>
              </div>
              <button class="btn btn-primary" (click)="openUploadModal()">
                Upload New Version
              </button>
            </div>

            @if (loadingVersions()) {
              <div class="loading-small">Loading versions...</div>
            } @else {
              <ul class="versions-list">
                @for (version of versions(); track version.id) {
                  <li [class.active]="version.is_active">
                    <div class="version-info">
                      <div class="version-header">
                        @if (version.is_active) {
                          <span class="badge active">Active</span>
                        }
                        <span class="version-date">{{ version.uploaded_at | date:'medium' }}</span>
                        <span class="version-size">{{ version.size_formatted }}</span>
                      </div>
                      @if (version.description) {
                        <div class="version-description">{{ version.description }}</div>
                      }
                    </div>
                    <div class="version-actions">
                      @if (!version.is_active) {
                        <button class="btn btn-small btn-primary" (click)="activateVersion(version)"
                                [disabled]="activatingVersion() === version.id">
                          {{ activatingVersion() === version.id ? 'Activating...' : 'Activate' }}
                        </button>
                        <button class="btn btn-small btn-danger" (click)="deleteVersion(version)"
                                [disabled]="deletingVersion() === version.id">
                          {{ deletingVersion() === version.id ? 'Deleting...' : 'Delete' }}
                        </button>
                      }
                    </div>
                  </li>
                } @empty {
                  <li class="empty">No content versions uploaded yet.</li>
                }
              </ul>
            }
          </section>

          <!-- Authentication Settings -->
          <section class="card">
            <h2>Authentication</h2>
            <p class="description">Configure how users access this documentation.</p>

            <div class="auth-options">
              @for (option of authOptions; track option.type) {
                <label class="auth-option">
                  <input type="checkbox"
                         [checked]="isAuthEnabled(option.type)"
                         (change)="toggleAuth(option.type, $event)" />
                  <span class="auth-label">
                    <strong>{{ option.label }}</strong>
                    <small>{{ option.description }}</small>
                  </span>
                </label>
              }
            </div>

            @if (isAuthEnabled('email')) {
              <div class="email-settings">
                <h3>Email Settings</h3>
                <div class="form-group">
                  <label for="flowType">Login Flow</label>
                  <select id="flowType" [(ngModel)]="emailFlowType" (change)="updateEmailSettings()">
                    <option value="magic_link">Magic Link (passwordless)</option>
                    <option value="register">Registration Required</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="domains">Allowed Domains (comma-separated, leave empty for any)</label>
                  <input id="domains" type="text" [(ngModel)]="emailDomains"
                         placeholder="company.com, partner.org"
                         (blur)="updateEmailSettings()" />
                </div>
              </div>
            }

            <button class="btn btn-primary" (click)="saveAuthConfig()" [disabled]="savingAuth()">
              {{ savingAuth() ? 'Saving...' : 'Save Authentication Settings' }}
            </button>
          </section>

          <!-- Site Admins -->
          <section class="card">
            <h2>Site Admins</h2>
            <p class="description">Users who can upload content to this site.</p>

            <ul class="admin-list">
              @for (admin of siteAdmins(); track admin.id) {
                <li>
                  <span>{{ admin.display_name || admin.email }}</span>
                  <button class="btn btn-small btn-danger" (click)="removeSiteAdmin(admin.id)">
                    Remove
                  </button>
                </li>
              } @empty {
                <li class="empty">No site admins configured.</li>
              }
            </ul>

            <div class="add-admin">
              <input type="email" [(ngModel)]="newAdminEmail" placeholder="admin@example.com" />
              <button class="btn btn-secondary" (click)="addSiteAdmin()" [disabled]="!newAdminEmail">
                Add Admin
              </button>
            </div>
          </section>
        </div>

        <!-- Upload Modal -->
        @if (showUploadModal()) {
          <div class="modal-overlay" (click)="closeUploadModal()">
            <div class="modal" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h2>Upload New Version</h2>
                <button class="modal-close" (click)="closeUploadModal()">&times;</button>
              </div>
              <div class="modal-body">
                @if (activeVersion()) {
                  <div class="active-content-warning">
                    <strong>Note:</strong> This site already has active content.
                    Uploading will create a new version and switch to it.
                  </div>
                }

                <div class="form-group">
                  <label for="uploadDescription">Version Description</label>
                  <input id="uploadDescription" type="text" [(ngModel)]="uploadDescription"
                         placeholder="e.g., v1.2.3 release, Bug fixes for API docs" />
                  <small class="field-hint">Provide a description to help identify this version later.</small>
                </div>

                <div class="upload-area"
                     [class.dragover]="dragOver()"
                     [class.has-file]="selectedFile()"
                     (dragover)="onDragOver($event)"
                     (dragleave)="dragOver.set(false)"
                     (drop)="onDrop($event)">
                  <input type="file" accept=".zip" (change)="onFileSelect($event)" #fileInput hidden />
                  @if (uploading()) {
                    <div class="upload-progress">
                      <div class="progress-bar">
                        <div class="progress-fill" [style.width.%]="uploadService.progress()?.percentage || 0"></div>
                      </div>
                      <span>{{ uploadService.progress()?.percentage || 0 }}%</span>
                    </div>
                  } @else if (selectedFile()) {
                    <div class="selected-file">
                      <span class="file-icon">&#128230;</span>
                      <span class="file-name">{{ selectedFile()!.name }}</span>
                      <span class="file-size">({{ formatFileSize(selectedFile()!.size) }})</span>
                      <button class="btn btn-small btn-secondary" (click)="clearSelectedFile(); fileInput.click()">
                        Change
                      </button>
                    </div>
                  } @else {
                    <button class="btn btn-secondary" (click)="fileInput.click()">
                      Choose ZIP File
                    </button>
                    <p>or drag and drop</p>
                  }
                </div>

                @if (uploadError()) {
                  <div class="error-message">{{ uploadError() }}</div>
                }
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" (click)="closeUploadModal()" [disabled]="uploading()">
                  Cancel
                </button>
                <button class="btn btn-primary" (click)="confirmUpload()"
                        [disabled]="!selectedFile() || uploading()">
                  {{ uploading() ? 'Uploading...' : 'Upload & Activate' }}
                </button>
              </div>
            </div>
          </div>
        }
      } @else {
        <div class="error">Site not found</div>
      }
    </div>
  `,
  styles: [`
    .site-detail {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .back-link {
      color: #666;
      text-decoration: none;
      font-size: 0.875rem;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .page-header h1 {
      margin: 0.5rem 0 0.25rem 0;
      font-size: 1.75rem;
    }

    .site-path {
      color: #1976d2;
      text-decoration: none;
    }

    .content-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
    }

    .card h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .card-header h2 {
      margin-bottom: 0.25rem;
    }

    .card-header .description {
      margin-bottom: 0;
    }

    .card h3 {
      margin: 1rem 0 0.5rem 0;
      font-size: 1rem;
    }

    .description {
      color: #666;
      font-size: 0.875rem;
      margin-bottom: 1rem;
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

    .upload-area {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 2rem;
      text-align: center;
      margin-bottom: 1rem;
      transition: border-color 0.2s;
    }

    .upload-area.dragover {
      border-color: #1976d2;
      background: #e3f2fd;
    }

    .upload-area p {
      margin: 0.5rem 0 0 0;
      color: #666;
      font-size: 0.875rem;
    }

    .upload-progress {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .progress-bar {
      flex: 1;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #1976d2;
      transition: width 0.2s;
    }

    .error-message {
      color: #d32f2f;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .success-message {
      color: #2e7d32;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .auth-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .auth-option {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      cursor: pointer;
    }

    .auth-option input {
      margin-top: 0.25rem;
    }

    .auth-label {
      display: flex;
      flex-direction: column;
    }

    .auth-label small {
      color: #666;
      font-size: 0.75rem;
    }

    .email-settings {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 4px;
      margin: 1rem 0;
    }

    .admin-list {
      list-style: none;
      padding: 0;
      margin: 0 0 1rem 0;
    }

    .admin-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .admin-list li.empty {
      color: #666;
      font-style: italic;
    }

    .add-admin {
      display: flex;
      gap: 0.5rem;
    }

    .add-admin input {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    .loading, .error {
      text-align: center;
      padding: 3rem;
      color: #666;
    }

    .loading-small {
      text-align: center;
      padding: 1rem;
      color: #666;
      font-size: 0.875rem;
    }

    .active-content-warning {
      background: #fff3e0;
      border: 1px solid #ffb74d;
      border-radius: 4px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }

    .versions-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .versions-list li {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }

    .versions-list li.active {
      background: #e8f5e9;
      border-color: #81c784;
    }

    .versions-list li.empty {
      color: #666;
      font-style: italic;
      text-align: center;
      border: none;
    }

    .version-info {
      flex: 1;
    }

    .version-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .version-date {
      font-weight: 500;
    }

    .version-size {
      color: #666;
      font-size: 0.875rem;
    }

    .version-description {
      color: #666;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .badge.active {
      background: #4caf50;
      color: white;
    }

    .version-actions {
      display: flex;
      gap: 0.5rem;
      margin-left: 1rem;
    }

    /* Modal Styles */
    .modal-overlay {
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

    .modal {
      background: white;
      border-radius: 8px;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: #666;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    .modal-close:hover {
      color: #333;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid #e0e0e0;
      background: #f9f9f9;
    }

    .field-hint {
      display: block;
      color: #666;
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .upload-area.has-file {
      border-style: solid;
      border-color: #1976d2;
      background: #e3f2fd;
    }

    .selected-file {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .file-icon {
      font-size: 1.5rem;
    }

    .file-name {
      font-weight: 500;
      word-break: break-all;
    }

    .file-size {
      color: #666;
      font-size: 0.875rem;
    }

    .success-message {
      color: #2e7d32;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
  `]
})
export class SiteDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sitesService = inject(SitesService);
  uploadService = inject(UploadService);

  site = signal<Site | null>(null);
  siteAdmins = signal<User[]>([]);
  versions = signal<ContentVersion[]>([]);
  activeVersion = signal<ContentVersion | null>(null);
  loading = signal(true);
  loadingVersions = signal(false);
  saving = signal(false);
  savingAuth = signal(false);
  uploading = signal(false);
  uploadError = signal<string | null>(null);
  uploadSuccess = signal(false);
  dragOver = signal(false);
  activatingVersion = signal<string | null>(null);
  deletingVersion = signal<string | null>(null);
  showUploadModal = signal(false);
  selectedFile = signal<File | null>(null);

  editName = '';
  editPath = '';
  uploadDescription = '';
  authConfigs: AuthConfig[] = [];
  emailFlowType: 'magic_link' | 'register' = 'magic_link';
  emailDomains = '';
  newAdminEmail = '';

  authOptions = [
    { type: 'anonymous' as AuthType, label: 'Public Access', description: 'Anyone can view without logging in' },
    { type: 'google' as AuthType, label: 'Google Sign-In', description: 'Require Google account' },
    { type: 'microsoft' as AuthType, label: 'Microsoft Sign-In', description: 'Require Microsoft account' },
    { type: 'email' as AuthType, label: 'Email Verification', description: 'Verify via email link' }
  ];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadSite(id);
    }
  }

  loadSite(id: string) {
    this.loading.set(true);
    this.sitesService.getSite(id).subscribe({
      next: (site) => {
        this.site.set(site);
        this.editName = site.name;
        this.editPath = site.path;
        this.authConfigs = site.auth_configs || [];

        if (site.email_settings) {
          this.emailFlowType = site.email_settings.flow_type;
          this.emailDomains = site.email_settings.allowed_domains?.join(', ') || '';
        }

        this.siteAdmins.set(site.admins || []);
        this.loading.set(false);

        // Load content versions
        this.loadVersions(id);
      },
      error: (err) => {
        console.error('Failed to load site:', err);
        this.loading.set(false);
      }
    });
  }

  loadVersions(siteId: string) {
    this.loadingVersions.set(true);
    this.sitesService.getVersions(siteId).subscribe({
      next: (versions) => {
        this.versions.set(versions);
        const active = versions.find(v => v.is_active);
        this.activeVersion.set(active || null);
        this.loadingVersions.set(false);
      },
      error: (err) => {
        console.error('Failed to load versions:', err);
        this.loadingVersions.set(false);
      }
    });
  }

  updateSite() {
    const currentSite = this.site();
    if (!currentSite) return;

    this.saving.set(true);
    this.sitesService.updateSite(currentSite.id, {
      name: this.editName,
      path: this.editPath
    }).subscribe({
      next: (updated) => {
        this.site.set({ ...currentSite, ...updated });
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Failed to update site:', err);
        this.saving.set(false);
        alert(err.error?.error || 'Failed to update site');
      }
    });
  }

  isAuthEnabled(type: AuthType): boolean {
    return this.authConfigs.some(c => c.auth_type === type && c.enabled);
  }

  toggleAuth(type: AuthType, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const existing = this.authConfigs.find(c => c.auth_type === type);

    if (existing) {
      existing.enabled = checked;
    } else if (checked) {
      this.authConfigs.push({
        id: '',
        site_id: this.site()!.id,
        auth_type: type,
        enabled: true
      });
    }
  }

  updateEmailSettings() {
    // This will be saved along with auth config
  }

  saveAuthConfig() {
    const currentSite = this.site();
    if (!currentSite) return;

    this.savingAuth.set(true);

    const enabledConfigs = this.authConfigs.filter(c => c.enabled).map(c => ({
      auth_type: c.auth_type,
      enabled: true,
      config: c.config
    }));

    const emailSettings = this.isAuthEnabled('email') ? {
      flow_type: this.emailFlowType,
      allowed_domains: this.emailDomains
        ? this.emailDomains.split(',').map(d => d.trim()).filter(d => d)
        : null
    } : undefined;

    this.sitesService.updateAuthConfig(currentSite.id, {
      auth_configs: enabledConfigs,
      email_settings: emailSettings
    }).subscribe({
      next: (result) => {
        this.authConfigs = result.auth_configs;
        this.savingAuth.set(false);
      },
      error: (err) => {
        console.error('Failed to save auth config:', err);
        this.savingAuth.set(false);
        alert(err.error?.error || 'Failed to save authentication settings');
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.stageFile(files[0]);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.stageFile(input.files[0]);
      input.value = ''; // Reset input so same file can be selected again
    }
  }

  stageFile(file: File) {
    if (!file.name.endsWith('.zip')) {
      this.uploadError.set('Please select a ZIP file');
      return;
    }
    this.uploadError.set(null);
    this.selectedFile.set(file);
  }

  clearSelectedFile() {
    this.selectedFile.set(null);
    this.uploadError.set(null);
  }

  openUploadModal() {
    this.showUploadModal.set(true);
    this.selectedFile.set(null);
    this.uploadDescription = '';
    this.uploadError.set(null);
  }

  closeUploadModal() {
    if (this.uploading()) return; // Don't close while uploading
    this.showUploadModal.set(false);
    this.selectedFile.set(null);
    this.uploadDescription = '';
    this.uploadError.set(null);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  confirmUpload() {
    const currentSite = this.site();
    const file = this.selectedFile();
    if (!currentSite || !file) return;

    this.uploading.set(true);
    this.uploadError.set(null);

    this.uploadService.uploadToSite(currentSite.id, file, {
      description: this.uploadDescription || undefined,
      activate: true
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          this.uploading.set(false);
          this.uploadService.resetProgress();
          this.showUploadModal.set(false);
          this.selectedFile.set(null);
          this.uploadDescription = '';

          // Reload versions to show the new one
          this.loadVersions(currentSite.id);
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadError.set(err.error?.error || 'Upload failed');
        this.uploadService.resetProgress();
      }
    });
  }

  activateVersion(version: ContentVersion) {
    const currentSite = this.site();
    if (!currentSite) return;

    this.activatingVersion.set(version.id);
    this.sitesService.activateVersion(currentSite.id, version.id).subscribe({
      next: () => {
        this.activatingVersion.set(null);
        this.loadVersions(currentSite.id);
      },
      error: (err) => {
        this.activatingVersion.set(null);
        alert(err.error?.error || 'Failed to activate version');
      }
    });
  }

  deleteVersion(version: ContentVersion) {
    const currentSite = this.site();
    if (!currentSite) return;

    if (!confirm(`Delete this version from ${version.uploaded_at}? This cannot be undone.`)) {
      return;
    }

    this.deletingVersion.set(version.id);
    this.sitesService.deleteVersion(currentSite.id, version.id).subscribe({
      next: () => {
        this.deletingVersion.set(null);
        this.loadVersions(currentSite.id);
      },
      error: (err) => {
        this.deletingVersion.set(null);
        alert(err.error?.error || 'Failed to delete version');
      }
    });
  }

  addSiteAdmin() {
    const currentSite = this.site();
    if (!currentSite || !this.newAdminEmail) return;

    this.sitesService.addSiteAdmin(currentSite.id, this.newAdminEmail).subscribe({
      next: (response) => {
        this.siteAdmins.update(admins => [...admins, response.user]);
        this.newAdminEmail = '';
      },
      error: (err) => {
        alert(err.error?.error || 'Failed to add admin');
      }
    });
  }

  removeSiteAdmin(userId: string) {
    const currentSite = this.site();
    if (!currentSite) return;

    this.sitesService.removeSiteAdmin(currentSite.id, userId).subscribe({
      next: () => {
        this.siteAdmins.update(admins => admins.filter(a => a.id !== userId));
      },
      error: (err) => {
        alert(err.error?.error || 'Failed to remove admin');
      }
    });
  }
}
