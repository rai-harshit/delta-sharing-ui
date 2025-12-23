#!/bin/bash
# Generate a secure JWT secret for admin authentication
# Usage: ./generate-jwt-secret.sh

echo "Generating secure JWT secret..."
echo ""
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo ""
echo "Add this to your .env file or environment variables."














