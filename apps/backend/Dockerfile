# Backend Production Dockerfile
FROM node:25-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/
RUN pnpm install

COPY . .
RUN npx prisma generate
RUN pnpm build

# Production image
FROM node:25-alpine AS runner

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 5000

# Run production migrations and start
# Uses 'migrate deploy' for safe, versioned migrations (no data loss risk)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
