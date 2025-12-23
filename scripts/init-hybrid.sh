#!/bin/bash
#
# Initialize Hybrid Delta Sharing Deployment
#
# This script sets up the hybrid deployment with:
# - Your Admin UI (Node.js backend + React frontend)
# - OSS Delta Sharing Server (Scala/JVM)
# - Nginx reverse proxy
# - PostgreSQL database
#
# Usage:
#   ./scripts/init-hybrid.sh
#

set -e

echo "=========================================="
echo "  Delta Sharing UI - Hybrid Mode Setup"
echo "=========================================="
echo ""

# Check for required tools
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed."; exit 1; }

# Directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    
    # Generate secrets
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    
    cat > .env << EOF
# ============================================
# Delta Sharing UI - Hybrid Mode Configuration
# ============================================

# ===================
# Database Settings
# ===================
POSTGRES_USER=delta_sharing
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=delta_sharing
DATABASE_URL=postgresql://delta_sharing:${POSTGRES_PASSWORD}@postgres:5432/delta_sharing

# ===================
# Security Settings
# ===================
# JWT secret for admin authentication (auto-generated)
JWT_SECRET=${JWT_SECRET}

# Encryption key for sensitive data like cloud credentials (auto-generated)
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ===================
# Hybrid Mode Settings
# ===================
# Enable hybrid mode (uses OSS Delta Sharing Server)
HYBRID_MODE=true

# Delta Sharing endpoint URL (what recipients see in credential files)
# Change this to your public domain in production
DELTA_SHARING_ENDPOINT=http://localhost/delta

# ===================
# Port Configuration
# ===================
HTTP_PORT=80
HTTPS_PORT=443

# ===================
# Cloud Storage Credentials
# ===================
# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT_NAME=
AZURE_STORAGE_ACCOUNT_KEY=
AZURE_STORAGE_CONNECTION_STRING=

# Google Cloud Storage
GCS_PROJECT_ID=

# ===================
# CORS Settings
# ===================
CORS_ORIGIN=*
EOF
    
    echo "✅ .env file created with generated secrets"
    echo ""
    echo "⚠️  IMPORTANT: Review and update the .env file before deploying!"
    echo "   - Set DELTA_SHARING_ENDPOINT to your public domain"
    echo "   - Configure cloud storage credentials if needed"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Create nginx directories
echo "📁 Creating nginx directories..."
mkdir -p nginx/certs

# Create a placeholder for SSL certificates
if [ ! -f "nginx/certs/.gitkeep" ]; then
    touch nginx/certs/.gitkeep
fi

# Create shared config directory (will be a Docker volume)
echo "📁 Creating shared config directory..."
mkdir -p shared-config

# Check if nginx config exists
if [ ! -f "nginx/nginx.hybrid.conf" ]; then
    echo "❌ nginx/nginx.hybrid.conf not found!"
    exit 1
fi

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "To start the hybrid deployment:"
echo ""
echo "  docker-compose -f docker-compose.hybrid.yml up -d"
echo ""
echo "This will start:"
echo "  - PostgreSQL database"
echo "  - Admin Backend (Node.js)"
echo "  - OSS Delta Sharing Server (Scala/JVM)"
echo "  - Nginx reverse proxy"
echo "  - Frontend (React)"
echo ""
echo "Access points:"
echo "  - Admin UI: http://localhost"
echo "  - Delta Sharing API: http://localhost/delta"
echo "  - Health check: http://localhost/health"
echo ""
echo "Default admin login:"
echo "  - Email: admin@delta-sharing.local"
echo "  - Password: changeme123"
echo ""
echo "⚠️  Remember to change the default password after first login!"
echo ""











