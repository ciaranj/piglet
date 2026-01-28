import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SitesService } from '../../services/sites.service';
import { Site, AuthType } from '../../models/site.model';

@Component({
  selector: 'app-sites-list',
  templateUrl: './sites-list.component.html',
  styleUrl: './sites-list.component.scss',
  imports: [RouterLink, FormsModule]
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
