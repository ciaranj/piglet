import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { SitesService } from '../../services/sites.service';
import { UploadService } from '../../services/upload.service';
import { AdminService } from '../../services/admin.service';
import { Site, AuthConfig, AuthType, EmailSettings, ContentVersion } from '../../models/site.model';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-site-detail',
  templateUrl: './site-detail.component.html',
  styleUrl: './site-detail.component.scss',
  imports: [CommonModule, RouterLink, FormsModule]
})
export class SiteDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sitesService = inject(SitesService);
  private adminService = inject(AdminService);
  uploadService = inject(UploadService);

  site = signal<Site | null>(null);
  siteAdmins = signal<User[]>([]);
  allUsers = signal<any[]>([]);
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
  selectedUserId = '';

  // Filter users to show only site admin role users (not global admins, they already have access)
  availableUsers = computed(() => {
    const currentAdminIds = this.siteAdmins().map(a => a.id);
    return this.allUsers().filter(user =>
      // User must have site admin role (no point showing global admins)
      user.is_site_admin_role &&
      // User must not already be an admin of this site
      !currentAdminIds.includes(user.id)
    );
  });

  // Auth method options (excluding anonymous, which is handled by public/authenticated toggle)
  authMethodOptions = [
    { type: 'google' as AuthType, label: 'Google Sign-In', description: 'Sign in with Google account' },
    { type: 'microsoft' as AuthType, label: 'Microsoft Sign-In', description: 'Sign in with Microsoft account' },
    { type: 'email' as AuthType, label: 'Email Verification', description: 'Verify via email link' }
  ];

  authValidationError = signal<string | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadSite(id);
    }
    this.loadUsers();
  }

  loadUsers() {
    this.adminService.getAllUsers().subscribe({
      next: (users) => {
        this.allUsers.set(users);
      },
      error: (err) => {
        console.error('Failed to load users:', err);
      }
    });
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

  isPublic(): boolean {
    return this.isAuthEnabled('anonymous');
  }

  setPublicAccess(isPublic: boolean) {
    if (isPublic) {
      // Enable anonymous, disable other auth methods
      const anonymousConfig = this.authConfigs.find(c => c.auth_type === 'anonymous');
      if (anonymousConfig) {
        anonymousConfig.enabled = true;
      } else {
        this.authConfigs.push({
          id: '',
          site_id: this.site()!.id,
          auth_type: 'anonymous',
          enabled: true
        });
      }
      // Disable all other auth methods
      this.authConfigs.forEach(c => {
        if (c.auth_type !== 'anonymous') {
          c.enabled = false;
        }
      });
    } else {
      // Disable anonymous
      const anonymousConfig = this.authConfigs.find(c => c.auth_type === 'anonymous');
      if (anonymousConfig) {
        anonymousConfig.enabled = false;
      }
    }
    this.authValidationError.set(null);
  }

  hasAnyAuthMethod(): boolean {
    return this.authConfigs.some(c => c.auth_type !== 'anonymous' && c.enabled);
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
    this.authValidationError.set(null);
  }

  updateEmailSettings() {
    // This will be saved along with auth config
  }

  saveAuthConfig() {
    const currentSite = this.site();
    if (!currentSite) return;

    // Validate: if not public, must have at least one auth method
    if (!this.isPublic() && !this.hasAnyAuthMethod()) {
      this.authValidationError.set('Please select at least one authentication method');
      return;
    }

    this.savingAuth.set(true);
    this.authValidationError.set(null);

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
    if (!currentSite || !this.selectedUserId) return;

    const selectedUser = this.allUsers().find(u => u.id === this.selectedUserId);
    if (!selectedUser) return;

    this.sitesService.addSiteAdmin(currentSite.id, selectedUser.email).subscribe({
      next: (response) => {
        this.siteAdmins.update(admins => [...admins, response.user]);
        this.selectedUserId = '';
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
