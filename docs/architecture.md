# Delta Sharing UI Architecture

This document describes the high-level architecture of Delta Sharing UI.

## Overview

Delta Sharing UI is a web-based management interface for the Delta Sharing protocol. It provides two main interfaces:

1. **Provider Console** - For data administrators to manage shares, recipients, and access grants
2. **Recipient Portal** - For data consumers to discover and access shared data

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Load Balancer / Ingress                        │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
              ▼                                       ▼
┌─────────────────────────┐             ┌─────────────────────────┐
│   Frontend (React)      │             │   Backend (Express)     │
│                         │             │                         │
│ - Provider Console      │ ──────────► │ - REST API              │
│ - Recipient Portal      │             │ - Delta Protocol        │
│ - SPA (nginx served)    │             │ - SSO/OIDC              │
└─────────────────────────┘             └──────────┬──────────────┘
                                                   │
              ┌────────────────────────────────────┼────────────────┐
              │                                    │                │
              ▼                                    ▼                ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│    PostgreSQL       │  │      Redis          │  │  Cloud Storage      │
│                     │  │                     │  │                     │
│ - Shares            │  │ - Rate Limiting     │  │ - S3                │
│ - Recipients        │  │ - Session Cache     │  │ - Azure Blob        │
│ - Access Grants     │  │ - CSRF Tokens       │  │ - GCS               │
│ - Audit Logs        │  │                     │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

## Deployment Modes

### 1. Standalone Mode (Default)

In standalone mode, the backend implements the full Delta Sharing protocol:

```
Client ──► Backend ──► Cloud Storage
              │
              └──► Database
```

### 2. Hybrid Mode

In hybrid mode, the UI manages configuration while the OSS Delta Sharing Server handles the protocol:

```
Client ──► OSS Server ──► Cloud Storage
              │
              └──► Config Files (synced from UI)
                        ▲
                        │
                   UI Backend
                        │
                   Database
```

## Component Details

### Frontend (React + TypeScript)

- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query for server state
- **Routing**: React Router v6
- **Build**: Vite

Key features:
- Role-based UI (admin, editor, viewer)
- Dark/light theme support
- Responsive design
- SSO integration

### Backend (Node.js + Express)

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database ORM**: Prisma
- **Validation**: Zod
- **Authentication**: JWT + OIDC

Key services:
- `shareService` - Share management
- `recipientService` - Recipient and token management
- `adminService` - Admin user management
- `auditService` - Audit logging
- `webhookService` - External notifications

### Database (PostgreSQL)

Schema includes:
- `shares` - Data shares
- `schemas` - Schemas within shares
- `tables` - Tables within schemas
- `recipients` - External data consumers
- `recipient_tokens` - Bearer tokens for recipients
- `access_grants` - Permissions mapping
- `admin_users` - Console administrators
- `audit_logs` - Access and operation logs
- `storage_configs` - Cloud storage credentials

### Cache (Redis)

Used for:
- Distributed rate limiting
- Session storage (for SSO)
- CSRF token storage
- General caching

## Authentication

### Admin Authentication

Two methods supported:

1. **Local Authentication**
   - Email/password login
   - Password strength validation
   - Account lockout after failed attempts

2. **SSO (OIDC)**
   - Azure AD / Entra ID
   - Okta
   - Generic OIDC providers

### Recipient Authentication

- Bearer token authentication
- Tokens hashed with bcrypt
- Token rotation support
- Expiration enforcement

## Role-Based Access Control

| Role   | Permissions                                    |
|--------|------------------------------------------------|
| Admin  | Full access to all operations                  |
| Editor | Create/edit shares and recipients, no delete   |
| Viewer | Read-only access                               |

## API Structure

```
/api
├── /auth          # Authentication
│   ├── /login
│   ├── /logout
│   └── /sso/*     # SSO flows
├── /shares        # Share management
├── /recipients    # Recipient management
├── /admin         # Admin operations
├── /storage       # Storage configuration
├── /delta         # Delta Sharing protocol
│   ├── /shares
│   ├── /:share/schemas
│   ├── /:share/:schema/tables
│   └── /:share/:schema/:table/*
├── /health        # Health checks
│   ├── /live
│   └── /ready
└── /metrics       # Prometheus metrics
```

## Security Measures

- JWT with secure secret (required in production)
- CSRF protection for state-changing operations
- Rate limiting per IP and endpoint
- Account lockout after failed logins
- Encrypted credential storage (AES-256-GCM)
- Security headers (HSTS, CSP, etc.)
- Audit logging for all operations

## Observability

### Metrics (Prometheus)

- HTTP request duration and counts
- Active connections
- Business metrics (shares, recipients, etc.)
- Database health

### Logging

- Structured JSON logging
- Correlation IDs for request tracing
- Log levels: debug, info, warn, error

### Health Checks

- `/health` - Basic liveness
- `/health/live` - Kubernetes liveness probe
- `/health/ready` - Kubernetes readiness probe
- `/health/detailed` - Full status with dependencies

## Webhooks

Events can be sent to external systems:
- `share.created/updated/deleted`
- `recipient.created/updated/deleted`
- `access.granted/revoked`
- `token.rotated`
- `user.login/sso_login`

## Technology Stack Summary

| Component    | Technology           |
|--------------|----------------------|
| Frontend     | React, TypeScript    |
| Backend      | Node.js, Express     |
| Database     | PostgreSQL           |
| Cache        | Redis                |
| Auth         | JWT, OIDC            |
| Build        | Vite, TypeScript     |
| Container    | Docker               |
| Orchestration| Kubernetes, Helm     |


