# Build stage for Angular frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,dst=/root/.npmrc npm ci
COPY . .
RUN npm run build

# Build stage for server dependencies (includes native modules)
FROM node:22-alpine AS server-builder
WORKDIR /app/server
RUN apk add --no-cache python3 make g++
COPY server/package*.json ./
RUN --mount=type=secret,id=npmrc,dst=/root/.npmrc npm ci --only=production

# Production image
FROM node:22-alpine
RUN apk add --no-cache nginx gettext

WORKDIR /app

# Copy built Angular app (to both nginx and where Express expects it)
COPY --from=frontend-builder /app/dist/piglet /usr/share/nginx/html
COPY --from=frontend-builder /app/dist/piglet /app/dist/piglet

# Copy server
COPY server ./server
COPY --from=server-builder /app/server/node_modules ./server/node_modules

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create data directory
RUN mkdir -p /data/sites /data/uploads

# Expose ports
EXPOSE 80 3000

# Set environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_PATH=/data \
    DB_PATH=/data/piglet.db

ENTRYPOINT ["/docker-entrypoint.sh"]
