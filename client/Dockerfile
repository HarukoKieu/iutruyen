# Stage 1: Build Client Assets
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build-time environment variables
ARG VITE_API_URL=/api/v1
ARG VITE_SOCKET_URL=/
ARG VITE_ADS_MODE=placeholder

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_ADS_MODE=$VITE_ADS_MODE

# Compile production bundle
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:1.27-alpine AS runtime

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
