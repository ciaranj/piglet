# Piglet

A static documentation hosting platform with configurable per-site authentication.

## Features

- **Upload and Serve Static Sites**: Upload zip files containing HTML documentation and serve them as static sites
- **Flexible URL Paths**: Create sites at any path (e.g., `/help`, `/docs/v2`, `/productdocs/9.1`)
- **Per-Site Authentication**: Configure different auth methods for each site:
  - Anonymous (public access)
  - Google Sign-In
  - Microsoft Sign-In
  - Email verification (magic link or registration flow)
- **Domain Restrictions**: Limit email auth to specific domains
- **Admin Portal**: Manage sites and administrators via web UI

## Quick Start

### Prerequisites

- Node.js 22+
- npm

### Development Setup

1. Install dependencies:
```bash
npm install
cd server && npm install
```

2. Copy environment configuration:
```bash
cp server/.env.example server/.env
# Edit .env with your configuration
```

3. Start development servers:
```bash
npm run start:dev
```

This starts both the Angular dev server (port 4200) and Express backend (port 3000) with proxy configuration.

### Production Build

```bash
npm run build:prod
```

### Docker

#### Using docker-compose

```bash
# Build and run
docker-compose up --build

# Access at http://localhost:8080
```

#### Local Development with Docker

When running the container locally over HTTP (not HTTPS), you need to configure the environment variables appropriately:

```bash
# Build the image
docker build -t piglet .

# Run with local development settings
docker run -p 4200:3000 \
  -e BASE_URL=http://localhost:4200 \
  -e COOKIE_SECURE=false \
  -e COOKIE_SECRET=dev-secret \
  -e ENTRA_TENANT_ID=your-tenant-id \
  -e ENTRA_CLIENT_ID=your-client-id \
  -e ENTRA_CLIENT_SECRET=your-client-secret \
  -v piglet-data:/data \
  piglet
```

Key environment variables for local development:

| Variable | Value | Purpose |
|----------|-------|---------|
| `BASE_URL` | `http://localhost:<port>` | Must match your external port for OAuth redirects |
| `COOKIE_SECURE` | `false` | Allows cookies over HTTP (required for local dev) |
| `NODE_ENV` | `production` (default) | Can set to `development` for more verbose logging |

**Note**: Ensure your OAuth provider (Entra ID, Google, Microsoft) has `http://localhost:<port>/_auth/<provider>/callback` configured as a valid redirect URI.

## Architecture

```
piglet/
├── src/                  # Angular frontend (admin portal)
├── server/               # Express backend
│   ├── routes/           # API endpoints
│   ├── middleware/       # Auth, site resolution
│   └── services/         # Database, storage, email
├── helm/piglet/          # Kubernetes Helm chart
├── Dockerfile
└── docker-compose.yml
```

## API Endpoints

### Admin API (`/_pigsty/api/`)

- `GET /sites` - List all sites
- `POST /sites` - Create a site
- `GET /sites/:id` - Get site details
- `PUT /sites/:id` - Update site
- `DELETE /sites/:id` - Delete site
- `POST /sites/:id/upload` - Upload content (zip file)
- `GET/PUT /sites/:id/auth` - Manage auth config

### Auth API (`/_auth/`)

- `GET /session` - Check current session
- `POST /logout` - Clear session
- `GET /entra/login` - Admin login via Entra ID
- `GET /google/login?site=:path` - Google sign-in
- `GET /microsoft/login?site=:path` - Microsoft sign-in
- `POST /email/send` - Send magic link

## Configuration

Key environment variables (see `server/.env.example`):

| Variable | Description |
|----------|-------------|
| `DATA_PATH` | Storage directory (default: `./data`) |
| `COOKIE_SECRET` | Session signing secret |
| `COOKIE_SECURE` | Set to `false` for HTTP, `true` for HTTPS (default: `true` in production) |
| `BASE_URL` | External URL for OAuth redirects (e.g., `http://localhost:4200`) |
| `ENTRA_TENANT_ID` | Azure AD tenant for admin auth |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID |
| `SMTP_HOST` | SMTP server for email auth |

## Kubernetes Deployment

```bash
# Create values override file
cat > values-override.yaml << EOF
ingress:
  hosts:
    - host: docs.example.com
      paths:
        - path: /
          pathType: Prefix

externalUrl:
  baseUrl: https://docs.example.com

secrets:
  cookieSecret: "your-secret"
  entraTenantId: "your-tenant"
  entraClientId: "your-client-id"
  entraClientSecret: "your-secret"
EOF

# Install
helm install piglet ./helm/piglet -f values-override.yaml
```

## License
Apache 2.0
