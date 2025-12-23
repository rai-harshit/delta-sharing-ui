# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- PostgreSQL database support with connection pooling
- Enhanced security middleware with CSRF protection
- Account lockout after failed login attempts (5 attempts = 15 min lockout)
- SSO fields in AdminUser model for OIDC integration
- Strong JWT secret validation (required in production)
- Enhanced security headers middleware
- LICENSE file (Apache 2.0)
- CONTRIBUTING.md with contribution guidelines
- SECURITY.md with vulnerability disclosure policy
- This CHANGELOG.md file

### Changed
- Database provider changed from SQLite to PostgreSQL
- JWT secret no longer falls back to weak default in production
- AdminUser model now supports SSO authentication

### Security
- Removed weak JWT secret default - now requires proper configuration
- Added account lockout mechanism to prevent brute force attacks
- Added CSRF token generation and validation
- Enhanced HTTP security headers

## [0.1.0] - 2024-XX-XX

### Added
- Initial release of Delta Sharing UI
- Provider Console for data administrators
  - Share management (create, edit, delete)
  - Schema and table management
  - Recipient management with token rotation
  - Access grant configuration
  - Storage configuration (S3, Azure, GCS)
  - Audit dashboard with visualizations
  - Settings page with user management
- Recipient Portal for data consumers
  - Credential-based authentication
  - Share and table discovery
  - Data preview with pagination
  - Code snippets (Python, PySpark)
  - CSV export
- Role-Based Access Control (RBAC)
  - Admin role (full access)
  - Editor role (create/edit, no delete)
  - Viewer role (read-only)
- Delta Sharing Protocol Implementation
  - Standard protocol endpoints
  - Time-travel queries
  - Change Data Feed (CDF) support
  - Pre-signed URL generation
- Hybrid Mode
  - Integration with OSS Delta Sharing Server
  - Config sync service
  - OSS proxy service
- Multi-cloud Storage Support
  - AWS S3
  - Azure Blob Storage
  - Google Cloud Storage
  - Local filesystem
- Security Features
  - JWT authentication
  - Bearer token authentication for recipients
  - Encrypted credential storage
  - Rate limiting
  - Audit logging
- Docker Support
  - Multi-mode Dockerfiles
  - Docker Compose configurations
  - Hybrid mode deployment
- Kubernetes Support
  - Base manifests
  - Helm chart foundation

### Documentation
- Comprehensive README.md
- API documentation (OpenAPI/Swagger)
- Deployment guides

---

## Template for Future Releases

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Features that will be removed in future versions

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security-related changes


