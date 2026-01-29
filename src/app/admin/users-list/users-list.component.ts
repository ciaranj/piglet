import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SitesService } from '../../services/sites.service';

@Component({
  selector: 'app-users-list',
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
  imports: [CommonModule, FormsModule]
})
export class UsersListComponent implements OnInit {
  private adminService = inject(AdminService);
  private sitesService = inject(SitesService);

  loading = signal(true);
  users = signal<any[]>([]);
  sites = signal<any[]>([]);
  searchQuery = signal('');
  roleFilter = signal('all');
  selectedUser: any = null;
  selectedSiteId = '';
  savingRole = signal(false);
  roleError = signal<string | null>(null);

  filteredUsers = computed(() => {
    let filtered = this.users();

    // Filter by search query
    const query = this.searchQuery();
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(lowerQuery) ||
        (user.display_name && user.display_name.toLowerCase().includes(lowerQuery))
      );
    }

    // Filter by role
    const roleFilterValue = this.roleFilter();
    if (roleFilterValue !== 'all') {
      filtered = filtered.filter(user => {
        if (roleFilterValue === 'global_admin') return user.is_global_admin;
        if (roleFilterValue === 'site_admin') return !user.is_global_admin && (user.is_site_admin_role || user.site_admin_count > 0);
        if (roleFilterValue === 'regular') return !user.is_global_admin && !user.is_site_admin_role && user.site_admin_count === 0;
        return true;
      });
    }

    return filtered;
  });

  availableSites = computed(() => {
    if (!this.selectedUser) return [];
    const userSiteIds = this.selectedUser.admin_sites.map((s: any) => s.id);
    return this.sites().filter(site => !userSiteIds.includes(site.id));
  });

  ngOnInit() {
    this.loadUsers();
    this.loadSites();
  }

  loadUsers() {
    this.loading.set(true);
    this.adminService.getAllUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load users:', err);
        this.loading.set(false);
      }
    });
  }

  loadSites() {
    this.sitesService.loadSites().subscribe({
      next: (sites) => {
        this.sites.set(sites);
      },
      error: (err) => {
        console.error('Failed to load sites:', err);
      }
    });
  }

  manageUser(user: any) {
    this.selectedUser = { ...user };
    this.selectedSiteId = '';
    this.roleError.set(null);
  }

  closeModal() {
    this.selectedUser = null;
    this.selectedSiteId = '';
    this.roleError.set(null);
  }

  toggleGlobalAdmin(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.savingRole.set(true);
    this.roleError.set(null);

    if (checked) {
      // Add global admin
      this.adminService.addAdmin(this.selectedUser.email).subscribe({
        next: () => {
          this.savingRole.set(false);
          this.selectedUser.is_global_admin = true;
          // Update the user in the list
          this.users.update(users =>
            users.map(u => u.id === this.selectedUser.id ? { ...u, is_global_admin: true } : u)
          );
        },
        error: (err) => {
          this.savingRole.set(false);
          this.roleError.set(err.error?.error || 'Failed to add global admin');
          // Revert checkbox
          (event.target as HTMLInputElement).checked = false;
        }
      });
    } else {
      // Remove global admin
      this.adminService.removeAdmin(this.selectedUser.id).subscribe({
        next: () => {
          this.savingRole.set(false);
          this.selectedUser.is_global_admin = false;
          // Update the user in the list
          this.users.update(users =>
            users.map(u => u.id === this.selectedUser.id ? { ...u, is_global_admin: false } : u)
          );
        },
        error: (err) => {
          this.savingRole.set(false);
          this.roleError.set(err.error?.error || 'Failed to remove global admin');
          // Revert checkbox
          (event.target as HTMLInputElement).checked = true;
        }
      });
    }
  }

  toggleSiteAdminRole(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.savingRole.set(true);
    this.roleError.set(null);

    this.adminService.setSiteAdminRole(this.selectedUser.id, checked).subscribe({
      next: () => {
        this.savingRole.set(false);
        this.selectedUser.is_site_admin_role = checked;
        // Update the user in the list
        this.users.update(users =>
          users.map(u => u.id === this.selectedUser.id ? { ...u, is_site_admin_role: checked } : u)
        );
      },
      error: (err) => {
        this.savingRole.set(false);
        this.roleError.set(err.error?.error || 'Failed to update site admin role');
        // Revert checkbox
        (event.target as HTMLInputElement).checked = !checked;
      }
    });
  }

  addSiteAdmin() {
    if (!this.selectedSiteId) return;

    this.savingRole.set(true);
    this.roleError.set(null);

    this.sitesService.addSiteAdmin(this.selectedSiteId, this.selectedUser.email).subscribe({
      next: () => {
        this.savingRole.set(false);
        // Find the site
        const site = this.sites().find(s => s.id === this.selectedSiteId);
        if (site) {
          this.selectedUser.admin_sites.push({
            id: site.id,
            name: site.name,
            path: site.path
          });
          this.selectedUser.site_admin_count++;
          // Update the user in the list
          this.users.update(users =>
            users.map(u => u.id === this.selectedUser.id ? { ...this.selectedUser } : u)
          );
        }
        this.selectedSiteId = '';
      },
      error: (err) => {
        this.savingRole.set(false);
        this.roleError.set(err.error?.error || 'Failed to add site admin');
      }
    });
  }

  removeSiteAdmin(siteId: string) {
    this.savingRole.set(true);
    this.roleError.set(null);

    this.sitesService.removeSiteAdmin(siteId, this.selectedUser.id).subscribe({
      next: () => {
        this.savingRole.set(false);
        this.selectedUser.admin_sites = this.selectedUser.admin_sites.filter((s: any) => s.id !== siteId);
        this.selectedUser.site_admin_count--;
        // Update the user in the list
        this.users.update(users =>
          users.map(u => u.id === this.selectedUser.id ? { ...this.selectedUser } : u)
        );
      },
      error: (err) => {
        this.savingRole.set(false);
        this.roleError.set(err.error?.error || 'Failed to remove site admin');
      }
    });
  }
}
