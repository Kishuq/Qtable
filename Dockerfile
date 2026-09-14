FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Single schema file serves both DBs: dev uses SQLite, prod images use Postgres.
# (All field types used are portable across both.)
ARG DB_PROVIDER=postgresql
RUN sed -i "s/provider = \"sqlite\"/provider = \"${DB_PROVIDER}\"/" prisma/schema.prisma && npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /data && chown app:app /data
USER app
EXPOSE 3000
# DATABASE_URL must point at Postgres (or /data/dev.db) — see docker-compose.yml
CMD ["sh", "-c", "npx prisma db push && node ./node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000"]
