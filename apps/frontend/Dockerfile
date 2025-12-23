# Frontend Dockerfile - Multi-stage build with build mode support
# 
# Build modes:
#   - full (default): Both Provider and Recipient portals
#   - provider: Provider portal only (Admin Console)
#   - recipient: Recipient portal only (Data Consumer)
#
# Usage:
#   docker build -t delta-sharing-ui:full .
#   docker build --build-arg BUILD_MODE=provider -t delta-sharing-ui:provider .
#   docker build --build-arg BUILD_MODE=recipient -t delta-sharing-ui:recipient .

FROM node:25-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Dependencies stage
FROM base AS deps

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build mode argument: full | provider | recipient
ARG BUILD_MODE=full
ARG VITE_API_URL

# Set environment variables for build
ENV VITE_BUILD_MODE=$BUILD_MODE
ENV VITE_API_URL=$VITE_API_URL

# Log build configuration
RUN echo "🔧 Building Delta Sharing UI in '${BUILD_MODE}' mode"

# Build the application
RUN pnpm build

# Determine the output directory based on build mode
RUN if [ "$BUILD_MODE" = "full" ]; then \
      mv dist /app/output; \
    else \
      mv dist-${BUILD_MODE} /app/output; \
    fi

# Production stage - nginx
FROM nginx:alpine AS production

# Add labels
LABEL org.opencontainers.image.title="Delta Sharing UI"
LABEL org.opencontainers.image.description="UI for Delta Sharing Protocol"
LABEL org.opencontainers.image.source="https://github.com/delta-sharing/delta-sharing-ui"

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from the unified output directory
COPY --from=build /app/output /usr/share/nginx/html

# Build mode is embedded at build time, but we can expose it as a label
ARG BUILD_MODE=full
LABEL delta-sharing.build-mode=$BUILD_MODE

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
