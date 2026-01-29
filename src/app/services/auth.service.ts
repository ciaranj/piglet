import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { Session, User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private sessionSignal = signal<Session | null>(null);
  private loadingSignal = signal(true);

  readonly session = this.sessionSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal()?.authenticated ?? false);
  readonly isAdmin = computed(() => this.sessionSignal()?.is_admin ?? false);
  readonly isGlobalAdmin = computed(() => this.sessionSignal()?.is_global_admin ?? false);
  readonly user = computed(() => this.sessionSignal()?.user ?? null);

  constructor(private http: HttpClient) {
    this.checkSession();
  }

  checkSession(): Observable<Session> {
    this.loadingSignal.set(true);
    return this.http.get<Session>('/_auth/session').pipe(
      tap(session => {
        this.sessionSignal.set(session);
        this.loadingSignal.set(false);
      }),
      catchError(() => {
        this.sessionSignal.set({ authenticated: false });
        this.loadingSignal.set(false);
        return of({ authenticated: false });
      })
    );
  }

  logout(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>('/_auth/logout', {}).pipe(
      tap(() => {
        this.sessionSignal.set({ authenticated: false });
      })
    );
  }

  loginWithEntra(returnTo?: string): void {
    const url = returnTo
      ? `/_auth/entra/login?returnTo=${encodeURIComponent(returnTo)}`
      : '/_auth/entra/login';
    window.location.href = url;
  }

  loginWithGoogle(sitePath: string, returnTo?: string): void {
    let url = `/_auth/google/login?site=${encodeURIComponent(sitePath)}`;
    if (returnTo) {
      url += `&returnTo=${encodeURIComponent(returnTo)}`;
    }
    window.location.href = url;
  }

  loginWithMicrosoft(sitePath: string, returnTo?: string): void {
    let url = `/_auth/microsoft/login?site=${encodeURIComponent(sitePath)}`;
    if (returnTo) {
      url += `&returnTo=${encodeURIComponent(returnTo)}`;
    }
    window.location.href = url;
  }

  sendEmailLink(email: string, sitePath: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>('/_auth/email/send', {
      email,
      site: sitePath
    });
  }

  register(email: string, sitePath: string, displayName?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>('/_auth/email/register', {
      email,
      site: sitePath,
      display_name: displayName
    });
  }
}
