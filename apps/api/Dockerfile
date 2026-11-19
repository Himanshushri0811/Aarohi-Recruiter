# ============================================================
# AI Recruiter API — Multi-stage Dockerfile
# ============================================================

# ---------------------------
# Stage 1: Builder
# ---------------------------
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# ---------------------------
# Stage 2: Runtime
# ---------------------------
FROM node:22-slim AS runtime

# Security: run as non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/sh --create-home app

WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled app and Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Change ownership to non-root user
RUN chown -R app:nodejs /app

USER app

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/api/v1/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
