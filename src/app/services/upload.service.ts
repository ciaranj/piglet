import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { UploadResponse } from '../models/site.model';

const API_BASE = '/_pigsty/api';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadOptions {
  description?: string;
  activate?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UploadService {
  private progressSignal = signal<UploadProgress | null>(null);
  readonly progress = this.progressSignal.asReadonly();

  constructor(private http: HttpClient) {}

  uploadToSite(siteId: string, file: File, options: UploadOptions = {}): Observable<HttpEvent<UploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);

    if (options.description) {
      formData.append('description', options.description);
    }
    if (options.activate !== undefined) {
      formData.append('activate', String(options.activate));
    }

    const request = new HttpRequest('POST', `${API_BASE}/sites/${siteId}/upload`, formData, {
      reportProgress: true
    });

    return this.http.request<UploadResponse>(request).pipe(
      tap(event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progressSignal.set({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100)
          });
        }
      })
    );
  }

  resetProgress(): void {
    this.progressSignal.set(null);
  }
}
