import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  imports: [FormsModule]
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
