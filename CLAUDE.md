# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Piglet is a static documentation hosting platform with configurable per-site authentication. It allows users to upload zip files containing static HTML documentation and serve them with various authentication methods including anonymous access, Google/Microsoft OAuth, and email verification.

## Architecture

- `src/` - Angular 17 frontend (admin portal served at `/_pigsty`)
  - `src/app/admin/` - Admin portal components (sites management, auth config)
  - `src/app/auth/` - Auth-related components (login, email verification)
  - `src/app/services/` - Angular services for API communication
  - `src/app/models/` - TypeScript interfaces
  - `src/app/guards/` - Route guards for authentication

- `server/` - Express API server
  - `server/routes/` - API route handlers (admin, auth, health)
  - `server/middleware/` - Express middleware (auth, site-resolver, site-auth, static-serve)
  - `server/services/` - Business logic (db, storage, email, oauth)

- `helm/piglet/` - Helm chart for Kubernetes deployment

## Common Commands

### Frontend (Angular)

```bash
# Install dependencies
npm install

# Run development server (standalone)
npm start

# Run development with backend proxy
npm run start:dev

# Build for production
npm run build:prod

# Run tests
npm test
```

### Backend (Express)

```bash
cd server

# Install dependencies
npm install

# Run development server
npm run dev

# Run production server
npm start

# Run tests
npm test
```

### Docker

```bash
# Build and run with docker-compose
docker-compose up --build

# Build image only
docker build -t piglet .
```

### Helm

```bash
# Install chart
helm install piglet ./helm/piglet -f values-override.yaml

# Upgrade
helm upgrade piglet ./helm/piglet -f values-override.yaml

# Dry run
helm install piglet ./helm/piglet --dry-run --debug
```

## Key Concepts

### Site Resolution
Sites are resolved using a longest-match-first strategy. For a request to `/productdocs/9.1/guide.html`:
1. Check if `/productdocs/9.1` is a registered site
2. If not, check if `/productdocs` is a registered site
3. Serve from the matched site's directory

### Path Encoding
Site paths are encoded for filesystem storage:
- `/help` → `help/`
- `/productdocs/9.1` → `productdocs__9.1/` (double underscore for path separator)

### Authentication Flows
- **Anonymous**: No authentication required
- **Social (Google/Microsoft)**: OAuth 2.0 flow with site context
- **Email**: Magic link or registration flow with optional domain restrictions

### Admin Portal
The admin portal (`/_pigsty`) requires Entra ID authentication. Global admins can manage all sites and other administrators.

## Environment Variables

See `server/.env.example` for all configuration options. Key variables:
- `DATA_PATH`: Base path for storage (default: `./data`)
- `COOKIE_SECRET`: Session signing key
- `ENTRA_*`: Entra ID configuration for admin auth
- `GOOGLE_*`, `MICROSOFT_*`: OAuth provider credentials
- `SMTP_*`: Email configuration

## Database

SQLite database at `$DATA_PATH/piglet.db`. Key tables:
- `sites`: Site configuration
- `site_auth_configs`: Per-site authentication methods
- `users`: Single identity across piglet
- `sessions`: Active sessions
- `global_admins`, `site_admins`: Admin permissions
