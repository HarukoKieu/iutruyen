# Local runtime includes Mongo tools without giving the application Docker daemon access.
FROM mongo:8.0 AS mongo-tools
FROM node:22-bookworm-slim AS build
WORKDIR /app/server
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libgssapi-krb5-2 libssl3 && rm -rf /var/lib/apt/lists/*
COPY --from=mongo-tools /usr/bin/mongodump /usr/local/bin/mongodump
COPY --from=mongo-tools /usr/bin/mongorestore /usr/local/bin/mongorestore
RUN mongodump --version && mongorestore --version
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY package.json ./
COPY scripts/restore-local-backup.cjs ./scripts/restore-local-backup.cjs
COPY scripts/migrate-crawler-indexes.cjs ./scripts/migrate-crawler-indexes.cjs
COPY docker ./docker
USER 1000:1000
EXPOSE 4000
CMD ["node", "docker/backend-entry.cjs"]
