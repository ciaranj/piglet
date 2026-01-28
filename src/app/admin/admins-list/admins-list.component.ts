import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-admins-list',
  templateUrl: './admins-list.component.html',
  styleUrl: './admins-list.component.scss',
  imports: [FormsModule]
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
