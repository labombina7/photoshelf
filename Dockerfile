FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ libvips-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && ls .next/standalone

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
