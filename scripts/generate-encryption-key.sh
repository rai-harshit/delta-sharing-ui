#!/bin/bash
# Generate a secure 256-bit encryption key for storing cloud credentials
# Usage: ./generate-encryption-key.sh

echo "Generating secure 256-bit encryption key..."
echo ""
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo ""
echo "Add this to your .env file or environment variables."
echo "IMPORTANT: Keep this key safe - encrypted credentials cannot be recovered without it!"














