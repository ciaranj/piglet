import { Component, OnInit, inject, signal } from '@angular/core';

import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-login',
    imports: [FormsModule],
    template: `
    <div class="login-page">
      <div class="login-card">
        <h1>Sign In</h1>
        @if (sitePath) {
          <p class="subtitle">to access {{ sitePath }}</p>
        }

        @if (availableMethods.includes('google')) {
          <button class="btn btn-google" (click)="loginWithGoogle()">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        }

        @if (availableMethods.includes('microsoft')) {
          <button class="btn btn-microsoft" (click)="loginWithMicrosoft()">
            <svg viewBox="0 0 21 21" width="20" height="20">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            Sign in with Microsoft
          </button>
        }

        @if (availableMethods.includes('email')) {
          @if (!showEmailForm()) {
            <button class="btn btn-email" (click)="showEmailForm.set(true)">
              Sign in with Email
            </button>
          } @else {
            <div class="email-form">
              <div class="form-group">
                <label for="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  [(ngModel)]="email"
                  placeholder="you@example.com"
                  (keyup.enter)="sendEmailLink()"
                />
              </div>
              @if (emailError()) {
                <div class="error-message">{{ emailError() }}</div>
              }
              @if (emailSent()) {
                <div class="success-message">
                  Check your email for a sign-in link!
                </div>
              } @else {
                <button
                  class="btn btn-primary"
                  (click)="sendEmailLink()"
                  [disabled]="!email || sendingEmail()"
                >
                  {{ sendingEmail() ? 'Sending...' : 'Send Sign-In Link' }}
                </button>
              }
            </div>
          }
        }

        @if (availableMethods.length === 0) {
          <p class="error">No authentication methods available for this site.</p>
        }
      </div>
    </div>
  `,
    styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 1rem;
    }

    .login-card {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
      text-align: center;
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
    }

    .subtitle {
      color: #666;
      margin: 0.5rem 0 1.5rem;
    }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 1rem;
      margin-bottom: 0.75rem;
      transition: background 0.2s;
    }

    .btn:hover {
      background: #f5f5f5;
    }

    .btn-google:hover {
      border-color: #4285f4;
    }

    .btn-microsoft:hover {
      border-color: #00a4ef;
    }

    .btn-email {
      background: #f5f5f5;
    }

    .btn-primary {
      background: #1976d2;
      color: white;
      border: none;
    }

    .btn-primary:hover {
      background: #1565c0;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .email-form {
      text-align: left;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #eee;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.25rem;
      font-weight: 500;
    }

    .form-group input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
    }

    .error-message {
      color: #d32f2f;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .success-message {
      color: #2e7d32;
      background: #e8f5e9;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
    }

    .error {
      color: #d32f2f;
    }
  `]
})
export class LoginComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  sitePath = '';
  returnTo = '';
  availableMethods: string[] = [];
  email = '';

  showEmailForm = signal(false);
  sendingEmail = signal(false);
  emailSent = signal(false);
  emailError = signal<string | null>(null);

  ngOnInit() {
    this.sitePath = this.route.snapshot.queryParamMap.get('site') || '';
    this.returnTo = this.route.snapshot.queryParamMap.get('returnTo') || this.sitePath;

    const method = this.route.snapshot.queryParamMap.get('method');

    // If specific method requested, only show that
    if (method) {
      this.availableMethods = [method];
      if (method === 'email') {
        this.showEmailForm.set(true);
      }
    } else {
      // Default available methods - in real app, these would come from server
      this.availableMethods = ['google', 'microsoft', 'email'];
    }
  }

  loginWithGoogle() {
    this.authService.loginWithGoogle(this.sitePath, this.returnTo);
  }

  loginWithMicrosoft() {
    this.authService.loginWithMicrosoft(this.sitePath, this.returnTo);
  }

  sendEmailLink() {
    if (!this.email || !this.sitePath) return;

    this.sendingEmail.set(true);
    this.emailError.set(null);

    this.authService.sendEmailLink(this.email, this.sitePath).subscribe({
      next: () => {
        this.sendingEmail.set(false);
        this.emailSent.set(true);
      },
      error: (err) => {
        this.sendingEmail.set(false);
        this.emailError.set(err.error?.error || 'Failed to send email');
      }
    });
  }
}
