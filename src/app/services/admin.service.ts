import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User } from '../models/user.model';

const API_BASE = '/_pigsty/api';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private adminsSignal = signal<User[]>([]);
  readonly admins = this.adminsSignal.asReadonly();

  constructor(private http: HttpClient) {}

  loadAdmins(): Observable<User[]> {
    return this.http.get<User[]>(`${API_BASE}/admins`).pipe(
      tap(admins => this.adminsSignal.set(admins))
    );
  }

  addAdmin(email: string): Observable<{ success: boolean; user: User }> {
    return this.http.post<{ success: boolean; user: User }>(`${API_BASE}/admins`, { email }).pipe(
      tap(response => {
        if (response.success) {
          this.adminsSignal.update(admins => [...admins, response.user]);
        }
      })
    );
  }

  removeAdmin(userId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${API_BASE}/admins/${userId}`).pipe(
      tap(response => {
        if (response.success) {
          this.adminsSignal.update(admins => admins.filter(a => a.id !== userId));
        }
      })
    );
  }

  // User management
  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${API_BASE}/users`);
  }

  getUserById(userId: string): Observable<any> {
    return this.http.get<any>(`${API_BASE}/users/${userId}`);
  }
}
