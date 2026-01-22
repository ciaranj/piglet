import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="unauthorized-page">
      <div class="content">
        <h1>403</h1>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
        <a routerLink="/" class="btn">Go Home</a>
      </div>
    </div>
  `,
  styles: [`
    .unauthorized-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
    }

    .content {
      text-align: center;
    }

    h1 {
      font-size: 6rem;
      margin: 0;
      color: #d32f2f;
    }

    h2 {
      margin: 0 0 1rem 0;
    }

    p {
      color: #666;
      margin-bottom: 2rem;
    }

    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: #1976d2;
      color: white;
      text-decoration: none;
      border-radius: 4px;
    }

    .btn:hover {
      background: #1565c0;
    }
  `]
})
export class UnauthorizedComponent {}
