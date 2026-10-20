# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Vite inlines VITE_* at build time — pass them as build args.
ARG VITE_API_URL
ARG VITE_IAM_URL
ARG VITE_IAM_ACCESS_CODE
ARG VITE_TURNSTILE_SITE_KEY
RUN pnpm build

# ── Serve ────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
