# Backend Production Dockerfile
# Build context should be the monorepo root for pnpm workspace to work
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy pnpm workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/prisma ./apps/backend/prisma/

# Install dependencies for backend only
RUN pnpm install --filter @delta-sharing-ui/backend...

# Copy backend source
COPY apps/backend ./apps/backend/

# Generate Prisma client and build
WORKDIR /app/apps/backend
RUN pnpm db:generate
RUN pnpm build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Copy production files
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/apps/backend/node_modules ./node_modules

EXPOSE 5000

# Run production migrations and start
# Uses 'migrate deploy' for safe, versioned migrations (no data loss risk)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
