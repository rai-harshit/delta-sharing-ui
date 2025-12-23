# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Delta Sharing UI seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to the Security tab of the repository
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Email**
   - Send an email to the project maintainers
   - Use a clear subject line: "Security Vulnerability Report - Delta Sharing UI"

### What to Include

Please include the following information in your report:

- **Type of vulnerability** (e.g., XSS, SQL injection, authentication bypass)
- **Location** - Full paths of source file(s) related to the vulnerability
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact assessment** - What can an attacker do with this vulnerability?
- **Suggested fix** (if you have one)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Target**: Within 30 days for critical vulnerabilities

### Process

1. **Receipt Confirmation** - We will acknowledge receipt of your report
2. **Investigation** - We will investigate and validate the vulnerability
3. **Fix Development** - We will develop a fix for confirmed vulnerabilities
4. **Disclosure** - We will coordinate with you on disclosure timing
5. **Credit** - We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When deploying Delta Sharing UI, please follow these security recommendations:

### Authentication & Authorization

- **Use strong JWT secrets** - Generate with `openssl rand -hex 32`
- **Enable SSO/OIDC** for enterprise deployments
- **Review RBAC roles** and assign minimum necessary permissions
- **Rotate admin passwords** regularly
- **Monitor failed login attempts** for potential attacks

### Network Security

- **Use HTTPS** in production - Configure TLS certificates
- **Set appropriate CORS origins** - Don't use wildcard in production
- **Deploy behind a reverse proxy** (nginx, traefik)
- **Use network policies** in Kubernetes

### Data Protection

- **Encrypt credentials at rest** - Uses AES-256-GCM encryption
- **Don't store the encryption key in version control**
- **Rotate encryption keys** periodically
- **Enable database encryption** at the PostgreSQL level

### Infrastructure

- **Keep dependencies updated** - Run `pnpm audit` regularly
- **Use container security scanning** for Docker images
- **Enable audit logging** and monitor for suspicious activity
- **Implement rate limiting** (already configured by default)
- **Set resource limits** in Kubernetes deployments

### Environment Variables

Required security-related environment variables:

```bash
# REQUIRED - Must be set in production
JWT_SECRET=<64-character-hex-string>
ENCRYPTION_KEY=<64-character-hex-string>
DATABASE_URL=postgresql://...

# RECOMMENDED - Configure appropriately
CORS_ORIGIN=https://your-domain.com
NODE_ENV=production
```

### Checklist for Production Deployment

- [ ] JWT_SECRET is set to a strong random value
- [ ] ENCRYPTION_KEY is set to a strong random value
- [ ] NODE_ENV is set to "production"
- [ ] CORS_ORIGIN is set to your domain (not *)
- [ ] HTTPS is configured
- [ ] Database is secured (encrypted, strong password)
- [ ] Rate limiting is enabled
- [ ] Audit logging is configured
- [ ] Container images are scanned
- [ ] Network policies are in place

## Known Security Considerations

### Bearer Token Storage

- Recipient bearer tokens are stored hashed (bcrypt)
- Tokens are shown only once at creation time
- Token rotation is supported and recommended

### Admin Sessions

- JWT tokens expire after 24 hours
- Failed login attempts trigger account lockout (5 attempts = 15 min lockout)
- Password change forced for new accounts

### Data Access

- All data access is logged in audit logs
- Row-level access control via grants
- Query limits can be enforced per recipient

## Security Updates

Security updates will be announced through:

- GitHub Security Advisories
- Release notes in CHANGELOG.md
- GitHub Releases

Subscribe to repository notifications to stay informed.

## Acknowledgments

We appreciate the security research community and thank everyone who has responsibly disclosed vulnerabilities to us.

---

*This security policy is subject to change. Last updated: 2024*


