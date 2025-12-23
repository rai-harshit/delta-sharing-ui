# Delta Sharing UI

A modern, open-source web interface for the Delta Sharing protocol. Supports both data providers (who share data) and data recipients (who consume shared data).

![Delta Sharing UI](https://img.shields.io/badge/Delta%20Sharing-UI-06b6d4?style=flat-square)
![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square)

---

## 🌟 Why Delta Sharing UI?

The [Delta Sharing protocol](https://github.com/delta-io/delta-sharing) is a powerful open standard for secure data sharing. However, the official OSS server is a **headless REST API** that requires:

- Manual YAML configuration file editing
- CLI-based token generation and management  
- No visibility into data access patterns
- Technical expertise to onboard recipients

**Delta Sharing UI bridges this gap** by providing an enterprise-ready management layer on top of the battle-tested OSS protocol.

### The Best of Both Worlds

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Your Deployment                              │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │           Delta Sharing UI (This Project)                    │   │
│   │                                                              │   │
│   │  ✓ Web-based Admin Console      ✓ Recipient Portal          │   │
│   │  ✓ Audit Dashboard              ✓ Token Management          │   │
│   │  ✓ Cloud Storage Browser        ✓ Data Preview              │   │
│   │  ✓ Role-Based Access Control    ✓ Time-Travel Queries       │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │         Official OSS Delta Sharing Server (Scala/JVM)        │   │
│   │                                                              │   │
│   │  ✓ Battle-tested protocol    ✓ Production-ready             │   │
│   │  ✓ CDF support               ✓ Predicate pushdown           │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Your Delta Lake Data                      │   │
│   │              (S3 / Azure Blob / GCS / Local)                 │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 OSS Delta Sharing vs. Delta Sharing UI

| Capability | OSS Delta Sharing Server | Delta Sharing UI (Hybrid Mode) |
|------------|--------------------------|--------------------------------|
| **Configuration** | Edit YAML files manually | Web-based UI with validation |
| **Token Management** | Generate manually, no rotation | One-click generation, rotation, expiration |
| **Recipient Onboarding** | Send tokens via email/Slack | Download credentials, self-service portal |
| **Data Discovery** | Recipients must know table paths | Visual catalog with search & preview |
| **Audit & Compliance** | Parse server logs | Rich dashboard, CSV export, filtering |
| **Cloud Storage Setup** | Manual config per deployment | Visual browser for S3/Azure/GCS |
| **User Management** | Single admin | Multi-user with Admin/Editor/Viewer roles |
| **Access Control** | All-or-nothing per share | Granular grants with query limits |
| **Time-Travel** | Via API only | UI support for version/timestamp queries |
| **Change Data Feed** | Via API only | Full CDF endpoint with pre-signed URLs |
| **Notifications** | ❌ None | ✅ Token expiry warnings, system alerts |
| **Protocol Reliability** | ✅ Battle-tested | ✅ Same OSS server under the hood |
| **User Interface** | ❌ None | ✅ Full React admin + recipient portals |

---

## ✨ Features

### For Data Providers (Admin Console)

| Feature | Description |
|---------|-------------|
| **Share Management** | Create and organize shares with schemas and tables via point-and-click |
| **Cloud Storage Browser** | Browse S3, Azure Blob, GCS directly; auto-detect Delta tables |
| **Recipient Management** | Create recipients, issue tokens, manage access grants |
| **Token Lifecycle** | Generate, rotate, revoke tokens with expiration dates |
| **Role-Based Access Control** | Admin, Editor, and Viewer roles with granular permissions |
| **Admin User Management** | Create, list, and delete admin users with different roles |
| **Audit Dashboard** | Visualize access patterns, query volumes, top tables/recipients |
| **Notifications** | Alerts for expiring tokens, storage issues, and system events |
| **Settings Page** | Change password, manage users, configure system settings |
| **Table Aliases** | Give user-friendly names to internal tables |
| **Data Preview** | Preview table data and schema before sharing |
| **Multi-Cloud Support** | Configure multiple storage backends with encrypted credentials |
| **Config Sync** | Automatic sync between database and OSS server config files |

### Role-Based Access Control (RBAC)

Control what each admin user can do with three distinct roles:

| Role | View | Create | Edit | Delete | Manage Users |
|------|:----:|:------:|:----:|:------:|:------------:|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Editor** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ |

**Permission Examples:**
- **Admin**: Full access - create shares, manage recipients, delete resources, add/remove users
- **Editor**: Create and modify shares/recipients, but cannot delete or manage other users
- **Viewer**: Read-only access to view shares, recipients, storage configs, and audit logs

### For Data Recipients (Self-Service Portal)

| Feature | Description |
|---------|-------------|
| **Visual Data Catalog** | Browse available shares, schemas, and tables |
| **Data Preview** | View table data with pagination (50 rows at a time) |
| **Schema Explorer** | See column names, types, and nullability |
| **Code Snippets** | Auto-generated Python (Pandas) and PySpark code |
| **CSV Export** | Download preview data for quick analysis |
| **Standalone Mode** | Works with any Delta Sharing server (no backend needed) |

### Advanced Data Features

| Feature | Description |
|---------|-------------|
| **Time-Travel Queries** | Query tables at specific versions or timestamps |
| **Change Data Feed (CDF)** | Track incremental changes between versions |
| **Pre-signed URLs** | Secure, time-limited file access for S3/Azure/GCS |
| **NDJSON Protocol** | Full compliance with Delta Sharing protocol spec |
| **Predicate Pushdown** | Filter data at query time for efficiency |

### Access Grant Options

Configure granular access for each recipient:

```json
{
  "maxRowsPerQuery": 10000,
  "canDownload": true,
  "canQuery": true,
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

### Enterprise-Ready Security

- **JWT Authentication** for admin users with role-based permissions
- **API-Level Permission Enforcement** - all endpoints validate user permissions
- **Hashed Token Storage** (never store plaintext)
- **Encrypted Credentials** for cloud storage configs
- **Rate Limiting** on API endpoints (configurable for dev/prod)
- **Time-Limited Access Grants** with expiration warnings
- **Comprehensive Audit Logs** with IP, user agent, duration tracking
- **Notification System** for security-relevant events

---

## 🚀 Deployment Modes

| Mode | Use Case | Components | Command |
|------|----------|------------|---------|
| **Hybrid** | Production (recommended) | Admin UI + OSS Delta Sharing Server | `docker-compose -f docker-compose.hybrid.yml up` |
| **Full** | Development/demos | Backend + Admin + Recipient Portal | `docker-compose up` |
| **Provider** | Data sharers only | Backend + Admin Portal | `docker-compose -f docker-compose.provider.yml up` |
| **Recipient** | Data consumers only | Static Recipient Portal | `docker-compose -f docker-compose.recipient.yml up` |

### Hybrid Mode Architecture (Recommended)

```
┌─────────────────────────────────────────────────────────────────────┐
│  HYBRID MODE (Production)                                            │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                         Nginx Proxy                            │  │
│  │           /api/* → Admin Backend    /delta/* → OSS Server     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│         │                                         │                  │
│         ▼                                         ▼                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐    │
│  │  Admin      │  │ Admin Portal│  │  OSS Delta Sharing Server│    │
│  │  Backend    │  │   (React)   │  │        (Scala/JVM)       │    │
│  │  + Postgres │  │             │  │   Battle-tested protocol │    │
│  └─────────────┘  └─────────────┘  └──────────────────────────┘    │
│         │                                         │                  │
│         └──── Config Sync (YAML + Tokens) ────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Why Hybrid Mode?**

1. **Protocol Reliability**: The official OSS server handles all data protocol operations
2. **Future-Proof**: Automatically get new OSS features (CDF, predicates, pagination)
3. **Management Layer**: Full UI experience for non-technical users
4. **Audit Logging**: Nginx access logs + application-level audit trail

---

## 📦 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose (for production)

### Local Development (Standalone Mode)

```bash
# Clone the repository
git clone https://github.com/yourusername/delta-sharing-ui.git
cd delta-sharing-ui

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

Default admin credentials: `admin@example.com` / `admin123`

### Production Deployment (Hybrid Mode)

```bash
# 1. Initialize hybrid mode (creates .env with secrets)
./scripts/init-hybrid.sh

# 2. Review and update .env
nano .env

# 3. Start all services
docker-compose -f docker-compose.hybrid.yml up -d
```

Services started:
- **PostgreSQL** - Database for admin data
- **Admin Backend** - Node.js API for management
- **OSS Delta Sharing Server** - Official Scala server
- **Nginx** - Reverse proxy with routing
- **Frontend** - React admin UI

Access points:
- Admin UI: http://localhost
- Delta Sharing API: http://localhost/delta
- Health check: http://localhost/health

---

## ⚙️ Configuration

Copy `env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/delta_sharing
POSTGRES_PASSWORD=your-secure-password

# Security (REQUIRED - generate with: openssl rand -hex 32)
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key

# Environment (affects rate limiting)
NODE_ENV=development  # or 'production' for stricter limits

# Hybrid Mode
HYBRID_MODE=true
DELTA_SHARING_ENDPOINT=https://your-domain.com/delta

# Cloud Storage (optional - can configure via UI)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

AZURE_STORAGE_ACCOUNT=
AZURE_STORAGE_ACCESS_KEY=

GCS_PROJECT_ID=
GCS_KEY_FILE=
```

### Rate Limiting

Rate limits are automatically adjusted based on environment:

| Limiter | Production | Development |
|---------|------------|-------------|
| API (general) | 100/min | 500/min |
| Auth (login) | 10/15min | 50/15min |
| Delta Protocol | 1000/min | 5000/min |
| Admin operations | 30/min | 300/min |

---

## 🔄 How It Works

### Provider Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin     │────▶│   Create    │────▶│   Create    │────▶│  Download   │
│   Login     │     │   Share     │     │  Recipient  │     │ Credentials │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ Add Tables  │     │  Configure  │
                    │ (via UI or  │     │   Access    │
                    │  storage    │     │   Limits    │
                    │  browser)   │     └─────────────┘
                    └─────────────┘
```

1. Admin logs into Provider Console
2. Creates Shares with Schemas and Tables (point to Delta Lake locations)
3. Creates Recipients and grants access to Shares
4. Optionally configures query limits and expiration dates
5. Downloads credential file and sends to recipient

### Recipient Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│   Browse    │────▶│   Preview   │────▶│  Get Code   │
│ Credentials │     │   Catalog   │     │    Data     │     │  Snippets   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. Recipient receives credential file from provider
2. Opens Recipient Portal and uploads credential file
3. Browses available shares, schemas, and tables
4. Previews data and gets code snippets for Python/Spark

### Credential File Format

```json
{
  "shareCredentialsVersion": 1,
  "endpoint": "https://provider.com/delta",
  "bearerToken": "abc123...",
  "expirationTime": "2025-12-31T23:59:59Z"
}
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript |
| UI Components | shadcn/ui + Tailwind CSS |
| State Management | TanStack Query v5 |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Delta Protocol | Official OSS Delta Sharing Server (Scala/JVM) |
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx |

---

## 📁 Project Structure

```
delta-sharing-ui/
├── apps/
│   ├── backend/                    # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/             # API endpoints
│   │   │   │   ├── delta-protocol.ts   # Standard Delta Sharing API
│   │   │   │   ├── shares.ts           # Admin share management
│   │   │   │   ├── recipients.ts       # Recipient management
│   │   │   │   ├── admin.ts            # Audit logs, users, notifications
│   │   │   │   └── storage.ts          # Storage configuration
│   │   │   ├── services/           # Business logic
│   │   │   │   ├── ossProxyService.ts      # OSS server integration
│   │   │   │   ├── configSyncService.ts    # Config sync to OSS
│   │   │   │   ├── notificationService.ts  # System notifications
│   │   │   │   ├── adminService.ts         # Admin user management
│   │   │   │   ├── auditService.ts         # Audit logging
│   │   │   │   └── recipientService.ts     # Recipient management
│   │   │   ├── middleware/         # Auth, rate limiting, audit
│   │   │   │   ├── auth.ts             # JWT + RBAC permissions
│   │   │   │   ├── rateLimit.ts        # Configurable rate limiting
│   │   │   │   └── auditLogger.ts      # Request logging
│   │   │   ├── delta/              # Custom Delta Lake reader
│   │   │   │   ├── reader.ts           # Time-travel & CDF support
│   │   │   │   └── parquet-reader.ts   # Parquet file parsing
│   │   │   └── storage/            # Cloud storage adapters
│   │   ├── prisma/                 # Database schema
│   │   └── Dockerfile
│   └── frontend/                   # React application
│       ├── src/
│       │   ├── components/         # UI components
│       │   │   ├── ui/             # shadcn/ui primitives
│       │   │   ├── layout/         # Header, Sidebar, NotificationDropdown
│       │   │   └── storage/        # Storage browser
│       │   ├── pages/              # Page components
│       │   │   ├── ShareDetailPage.tsx
│       │   │   ├── RecipientDetailPage.tsx
│       │   │   ├── RecipientSharesPage.tsx
│       │   │   ├── AuditDashboardPage.tsx
│       │   │   ├── SettingsPage.tsx    # Password + user management
│       │   │   └── ...
│       │   ├── hooks/              # React Query hooks
│       │   │   ├── useNotifications.ts
│       │   │   ├── useAdminUsers.ts
│       │   │   └── ...
│       │   ├── context/            # Auth & Recipient contexts
│       │   │   └── AuthContext.tsx     # Includes RBAC permissions
│       │   └── lib/                # API client & utilities
│       ├── Dockerfile              # Multi-mode Dockerfile
│       └── Dockerfile.recipient    # Lightweight recipient-only
├── nginx/
│   └── nginx.hybrid.conf           # Nginx config for hybrid mode
├── scripts/
│   ├── init-hybrid.sh              # Initialize hybrid deployment
│   ├── generate-jwt-secret.sh      # Generate JWT secret
│   └── generate-encryption-key.sh  # Generate encryption key
├── docker-compose.yml              # Standalone deployment
├── docker-compose.hybrid.yml       # Hybrid mode (recommended)
├── docker-compose.provider.yml     # Provider-only deployment
└── docker-compose.recipient.yml    # Recipient-only deployment
```

---

## 🔌 API Documentation

### Standard Delta Sharing Protocol

These endpoints follow the [Delta Sharing Protocol](https://github.com/delta-io/delta-sharing/blob/main/PROTOCOL.md):

```
GET  /delta/shares                                    # List shares
GET  /delta/shares/{share}/schemas                    # List schemas  
GET  /delta/shares/{share}/schemas/{schema}/tables    # List tables
GET  /delta/shares/{share}/schemas/{schema}/tables/{table}/version   # Get version
GET  /delta/shares/{share}/schemas/{schema}/tables/{table}/metadata  # Get metadata
POST /delta/shares/{share}/schemas/{schema}/tables/{table}/query     # Query data
POST /delta/shares/{share}/schemas/{schema}/tables/{table}/changes   # Get CDF
```

**Time-Travel Query Parameters:**
```json
{
  "version": 5,                        // Query specific version
  "timestamp": "2024-01-01T00:00:00Z"  // Query as-of timestamp
}
```

**Change Data Feed (CDF) Parameters:**
```json
{
  "startingVersion": 0,               // Starting version (inclusive)
  "endingVersion": 10,                // Ending version (inclusive)
  "startingTimestamp": "...",         // Alternative: start timestamp
  "endingTimestamp": "..."            // Alternative: end timestamp
}
```

### Admin API

All admin endpoints require authentication and respect RBAC permissions.

```
# Authentication
POST /api/auth/login                      # Admin login
POST /api/auth/change-password            # Change password
GET  /api/auth/me                         # Get current user

# Shares (requires shares:view, shares:create, shares:delete)
GET  /api/shares                          # List all shares
POST /api/shares                          # Create share
GET  /api/shares/:id                      # Get share details
DELETE /api/shares/:id                    # Delete share
POST /api/shares/:id/schemas              # Add schema
POST /api/shares/:id/schemas/:name/tables # Add table

# Recipients (requires recipients:view, recipients:create, etc.)
GET  /api/recipients                      # List recipients
POST /api/recipients                      # Create recipient
GET  /api/recipients/:id                  # Get recipient details
DELETE /api/recipients/:id                # Delete recipient
POST /api/recipients/:id/token/rotate     # Rotate token
POST /api/recipients/:id/access           # Grant share access
PUT  /api/recipients/:id/access/:shareId  # Update access grant
DELETE /api/recipients/:id/access/:shareId # Revoke access

# Admin Users (requires admin_users:view, admin_users:create, etc.)
GET  /api/admin/users                     # List admin users
POST /api/admin/users                     # Create admin user
DELETE /api/admin/users/:id               # Delete admin user

# Notifications
GET  /api/admin/notifications             # Get notifications
GET  /api/admin/notifications/counts      # Get unread count

# Audit Logs (requires audit:view, audit:export)
GET  /api/admin/audit-logs                # View audit logs
GET  /api/admin/audit-logs/summary        # Audit summary stats
GET  /api/admin/audit-logs/activity       # Daily activity
GET  /api/admin/audit-logs/top-tables     # Most accessed tables
GET  /api/admin/audit-logs/top-recipients # Most active recipients
GET  /api/admin/audit-logs/export         # Export as CSV

# Storage (requires storage:view, storage:create, etc.)
GET  /api/storage/configs                 # List storage configs
POST /api/storage/configs                 # Add storage config
PUT  /api/storage/configs/:id             # Update storage config
DELETE /api/storage/configs/:id           # Delete storage config
POST /api/storage/configs/:id/test        # Test connection
GET  /api/storage/browse/:configId/*      # Browse storage
```

---

## 🧪 Development

### Available Scripts

```bash
# Root level
pnpm dev              # Run all services (frontend + backend)
pnpm build            # Build all
pnpm lint             # Lint all
pnpm test             # Run all tests

# Frontend (apps/frontend)
pnpm dev              # Development (full mode)
pnpm dev:provider     # Development (provider mode)
pnpm dev:recipient    # Development (recipient mode)
pnpm build            # Build (full mode)
pnpm test             # Run tests

# Backend (apps/backend)
pnpm dev              # Development with hot reload
pnpm build            # Build for production
pnpm test             # Run tests
pnpm db:push          # Push schema to database
pnpm db:seed          # Seed sample data
```

### Building Docker Images

```bash
# Build all modes
cd apps/frontend
docker build -t delta-sharing-ui:full .
docker build --build-arg BUILD_MODE=provider -t delta-sharing-ui:provider .
docker build --build-arg BUILD_MODE=recipient -t delta-sharing-ui:recipient .

# Lightweight recipient-only image
docker build -f Dockerfile.recipient -t delta-sharing-ui:recipient-only .
```

---

## 🤝 Why This is Great for Delta OSS

Delta Sharing UI complements the Delta Sharing ecosystem by:

1. **Lowering the Barrier to Entry**
   - Non-technical users can manage data sharing without learning YAML syntax
   - Visual tools reduce configuration errors

2. **Accelerating Enterprise Adoption**
   - Audit logging meets compliance requirements (SOC2, HIPAA, GDPR)
   - Role-based access control enables team collaboration
   - Time-limited access grants reduce security exposure

3. **Improving Recipient Experience**
   - Self-service portal reduces support burden on data teams
   - Code snippets get recipients productive in minutes
   - Data preview before committing to full downloads

4. **Extending Without Forking**
   - Uses the official OSS server for protocol handling
   - Management layer is additive, not a replacement
   - Full CDF and time-travel support

5. **Community-Driven Development**
   - Open source under Apache 2.0
   - Contributions welcome!

---

## 🛣️ Roadmap

- [x] Role-based access control (Admin, Editor, Viewer)
- [x] Admin user management
- [x] Notification system
- [x] Settings page with password change
- [x] Change Data Feed (CDF) support
- [x] Time-travel queries (version & timestamp)
- [x] Pre-signed URL generation for cloud storage
- [x] NDJSON protocol compliance
- [x] API-level permission enforcement
- [x] Configurable rate limiting
- [ ] SSO/SAML integration
- [ ] Slack/Teams notifications for access requests
- [ ] Terraform provider for infrastructure-as-code
- [ ] Kubernetes Helm chart
- [ ] Unity Catalog integration

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Delta Sharing](https://github.com/delta-io/delta-sharing) - The open protocol this project extends
- [Delta Lake](https://delta.io/) - The storage layer powering modern lakehouses
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [TanStack Query](https://tanstack.com/query) - Powerful data fetching

---

<p align="center">
  Built with ❤️ for the Delta Lake community
</p>
