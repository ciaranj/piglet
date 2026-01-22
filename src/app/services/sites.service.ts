import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Site, CreateSiteRequest, UpdateSiteRequest, UpdateAuthConfigRequest, AuthConfig, EmailSettings, ContentVersion, ActiveVersionResponse } from '../models/site.model';
import { User } from '../models/user.model';

const API_BASE = '/_pigsty/api';

@Injectable({
  providedIn: 'root'
})
export class SitesService {
  private sitesSignal = signal<Site[]>([]);
  private loadingSignal = signal(false);

  readonly sites = this.sitesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  constructor(private http: HttpClient) {}

  loadSites(): Observable<Site[]> {
    this.loadingSignal.set(true);
    return this.http.get<Site[]>(`${API_BASE}/sites`).pipe(
      tap(sites => {
        this.sitesSignal.set(sites);
        this.loadingSignal.set(false);
      })
    );
  }

  getSite(id: string): Observable<Site> {
    return this.http.get<Site>(`${API_BASE}/sites/${id}`);
  }

  createSite(request: CreateSiteRequest): Observable<Site> {
    return this.http.post<Site>(`${API_BASE}/sites`, request).pipe(
      tap(site => {
        this.sitesSignal.update(sites => [...sites, site]);
      })
    );
  }

  updateSite(id: string, request: UpdateSiteRequest): Observable<Site> {
    return this.http.put<Site>(`${API_BASE}/sites/${id}`, request).pipe(
      tap(updatedSite => {
        this.sitesSignal.update(sites =>
          sites.map(site => site.id === id ? updatedSite : site)
        );
      })
    );
  }

  deleteSite(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${API_BASE}/sites/${id}`).pipe(
      tap(response => {
        if (response.success) {
          this.sitesSignal.update(sites => sites.filter(site => site.id !== id));
        }
      })
    );
  }

  // Auth configuration
  getAuthConfig(siteId: string): Observable<{ auth_configs: AuthConfig[]; email_settings: EmailSettings | null }> {
    return this.http.get<{ auth_configs: AuthConfig[]; email_settings: EmailSettings | null }>(
      `${API_BASE}/sites/${siteId}/auth`
    );
  }

  updateAuthConfig(siteId: string, request: UpdateAuthConfigRequest): Observable<{ auth_configs: AuthConfig[]; email_settings: EmailSettings | null }> {
    return this.http.put<{ auth_configs: AuthConfig[]; email_settings: EmailSettings | null }>(
      `${API_BASE}/sites/${siteId}/auth`,
      request
    );
  }

  // Site admins
  getSiteAdmins(siteId: string): Observable<User[]> {
    return this.http.get<User[]>(`${API_BASE}/sites/${siteId}/admins`);
  }

  addSiteAdmin(siteId: string, email: string): Observable<{ success: boolean; user: User }> {
    return this.http.post<{ success: boolean; user: User }>(
      `${API_BASE}/sites/${siteId}/admins`,
      { email }
    );
  }

  removeSiteAdmin(siteId: string, userId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${API_BASE}/sites/${siteId}/admins/${userId}`
    );
  }

  // Content versions
  getVersions(siteId: string): Observable<ContentVersion[]> {
    return this.http.get<ContentVersion[]>(`${API_BASE}/sites/${siteId}/versions`);
  }

  getActiveVersion(siteId: string): Observable<ActiveVersionResponse> {
    return this.http.get<ActiveVersionResponse>(`${API_BASE}/sites/${siteId}/versions/active`);
  }

  activateVersion(siteId: string, versionId: string): Observable<{ success: boolean; version: ContentVersion }> {
    return this.http.put<{ success: boolean; version: ContentVersion }>(
      `${API_BASE}/sites/${siteId}/versions/${versionId}/activate`,
      {}
    );
  }

  deleteVersion(siteId: string, versionId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${API_BASE}/sites/${siteId}/versions/${versionId}`
    );
  }
}
