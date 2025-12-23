# SSO Configuration Guide

Delta Sharing UI supports Single Sign-On (SSO) via OpenID Connect (OIDC). This guide covers configuration for:

- Azure AD / Microsoft Entra ID
- Okta
- Generic OIDC providers

## Quick Start

1. Choose your identity provider
2. Create an application/client in your IdP
3. Configure environment variables
4. Restart the backend

## Azure AD / Entra ID

### 1. Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory → App registrations
3. Click "New registration"
4. Configure:
   - **Name**: Delta Sharing UI
   - **Supported account types**: Single tenant (or multi-tenant)
   - **Redirect URI**: `https://your-domain.com/api/auth/sso/callback` (Web platform)

### 2. Configure Authentication

1. Go to your app registration → Authentication
2. Add platform → Web
3. Add redirect URI: `https://your-domain.com/api/auth/sso/callback`
4. Enable "ID tokens" under Implicit grant

### 3. Get Credentials

1. Go to Overview, note the:
   - **Application (client) ID**
   - **Directory (tenant) ID**
2. Go to Certificates & secrets → New client secret
3. Note the **secret value** (shown only once!)

### 4. Configure Group Claims (Optional)

To map Azure AD groups to roles:

1. Go to Token configuration
2. Add groups claim
3. Select "Groups assigned to the application"
4. Note the **Object ID** of your admin group

### 5. Set Environment Variables

```env
SSO_PROVIDER=azure
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_ADMIN_GROUP_ID=your-admin-group-object-id  # Optional
```

## Okta

### 1. Create Application

1. Go to your Okta Admin Console
2. Navigate to Applications → Create App Integration
3. Select:
   - **Sign-in method**: OIDC
   - **Application type**: Web Application
4. Configure:
   - **Name**: Delta Sharing UI
   - **Sign-in redirect URI**: `https://your-domain.com/api/auth/sso/callback`
   - **Sign-out redirect URI**: `https://your-domain.com/login`
   - **Controlled access**: Assign users/groups

### 2. Get Credentials

1. Go to the application's General tab
2. Note the:
   - **Client ID**
   - **Client Secret**
3. Note your Okta domain (e.g., `your-org.okta.com`)

### 3. Configure Groups (Optional)

To include groups in the token:

1. Go to the application's Sign On tab
2. Edit OpenID Connect ID Token section
3. Add "groups" claim with filter

### 4. Set Environment Variables

```env
SSO_PROVIDER=okta
OKTA_DOMAIN=your-org.okta.com
OKTA_CLIENT_ID=your-client-id
OKTA_CLIENT_SECRET=your-client-secret
OKTA_ADMIN_GROUP=DeltaSharingAdmins  # Optional
```

## Generic OIDC

For other OIDC providers (Auth0, Keycloak, etc.):

### 1. Create Application

Follow your provider's documentation to create an OIDC application with:
- Redirect URI: `https://your-domain.com/api/auth/sso/callback`
- Response type: code
- Grant type: authorization_code

### 2. Set Environment Variables

```env
SSO_PROVIDER=oidc
OIDC_ISSUER_URL=https://your-provider.com/.well-known/openid-configuration
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_SCOPES=openid,profile,email,groups
```

## Role Mapping

By default, SSO users are assigned the `viewer` role. To grant admin access:

### Azure AD

1. Create a security group in Azure AD
2. Add users to the group
3. Set `AZURE_AD_ADMIN_GROUP_ID` to the group's Object ID

### Okta

1. Create a group in Okta (e.g., "DeltaSharingAdmins")
2. Assign users to the group
3. Set `OKTA_ADMIN_GROUP` to the group name

### Generic OIDC

The service checks for these group names by default:
- `DeltaSharingAdmins` → admin role
- `DeltaSharingEditors` → editor role
- Other groups → viewer role

## Linking SSO Accounts

If a user already has a local account:

1. Log in with local credentials
2. Navigate to Settings → Account
3. Click "Link SSO Account"
4. Complete the SSO flow

## Troubleshooting

### Common Issues

**"SSO provider not configured"**
- Verify all required environment variables are set
- Check that `SSO_PROVIDER` matches your configuration

**"Invalid redirect URI"**
- Ensure the redirect URI in your IdP matches exactly
- Include the `/api/auth/sso/callback` path

**"Token validation failed"**
- Check that the issuer URL is correct
- Verify client ID and secret

**"User not assigned"** (Okta)
- Ensure the user is assigned to the application
- Check group assignments

### Debug Mode

Enable debug logging to see detailed OIDC flow:

```env
LOG_LEVEL=debug
```

## Security Considerations

1. **Always use HTTPS** in production
2. **Rotate secrets** regularly
3. **Limit application permissions** in your IdP
4. **Monitor failed login attempts**
5. **Use group-based access** for better security

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SSO_PROVIDER` | Provider type: `azure`, `okta`, or `oidc` | Yes |
| `AZURE_AD_TENANT_ID` | Azure tenant ID | Azure only |
| `AZURE_AD_CLIENT_ID` | Azure client ID | Azure only |
| `AZURE_AD_CLIENT_SECRET` | Azure client secret | Azure only |
| `AZURE_AD_ADMIN_GROUP_ID` | Azure group for admin role | No |
| `OKTA_DOMAIN` | Okta domain | Okta only |
| `OKTA_CLIENT_ID` | Okta client ID | Okta only |
| `OKTA_CLIENT_SECRET` | Okta client secret | Okta only |
| `OKTA_ADMIN_GROUP` | Okta group for admin role | No |
| `OIDC_ISSUER_URL` | OIDC issuer URL | Generic only |
| `OIDC_CLIENT_ID` | OIDC client ID | Generic only |
| `OIDC_CLIENT_SECRET` | OIDC client secret | Generic only |
| `OIDC_SCOPES` | Comma-separated scopes | No |
| `FRONTEND_URL` | Frontend URL for redirects | No |


