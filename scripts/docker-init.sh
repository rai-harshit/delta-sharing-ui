#!/bin/bash
# Initialize Delta Sharing UI for production deployment
# Usage: ./docker-init.sh

set -e

echo "🚀 Delta Sharing UI - Production Setup"
echo "======================================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    read -p "⚠️  .env file already exists. Overwrite? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Keeping existing .env file."
        exit 0
    fi
fi

# Copy template
cp env.example .env
echo "✅ Created .env from template"

# Generate secure keys
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

# Update .env with generated keys
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i '' "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
    sed -i '' "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
else
    # Linux
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
    sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
fi

echo "✅ Generated secure secrets"
echo ""
echo "📋 Configuration Summary:"
echo "   - JWT Secret: ${JWT_SECRET:0:8}..."
echo "   - Encryption Key: ${ENCRYPTION_KEY:0:8}..."
echo "   - Postgres Password: ${POSTGRES_PASSWORD:0:8}..."
echo ""

# Ask about cloud storage
read -p "Would you like to configure cloud storage now? (y/N): " configure_cloud
if [ "$configure_cloud" = "y" ] || [ "$configure_cloud" = "Y" ]; then
    echo ""
    echo "Cloud storage can be configured via the UI after startup."
    echo "Alternatively, you can set environment variables in .env:"
    echo ""
    echo "For AWS S3:"
    echo "  AWS_ACCESS_KEY_ID=your-access-key"
    echo "  AWS_SECRET_ACCESS_KEY=your-secret-key"
    echo "  AWS_REGION=us-east-1"
    echo ""
    echo "For Azure Blob:"
    echo "  AZURE_STORAGE_CONNECTION_STRING=your-connection-string"
    echo ""
    echo "For Google Cloud:"
    echo "  GCP_KEY_FILE=/path/to/service-account.json"
    echo ""
fi

# Start services
echo ""
read -p "Start Delta Sharing UI now? (Y/n): " start_now
if [ "$start_now" != "n" ] && [ "$start_now" != "N" ]; then
    echo ""
    echo "Starting services..."
    docker-compose up -d
    echo ""
    echo "✅ Services started!"
    echo ""
    echo "🌐 Access the UI:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:5000"
    echo "   API Docs: http://localhost:5000/api/docs/ui"
    echo ""
    echo "📝 Default admin credentials:"
    echo "   Email: admin@localhost"
    echo "   Password: changeme"
    echo ""
    echo "⚠️  Remember to change the default password after first login!"
else
    echo ""
    echo "To start later, run: docker-compose up -d"
fi














