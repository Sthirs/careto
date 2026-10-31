FROM node:26.12.1-alpine3.23@sha256:bc2b334006f15c7167bbeb2f08f28c2df883f7594a0470e04454ebe7560cfe68 AS build
WORKDIR /app

ARG APP_VERSION=dev
ENV VITE_APP_VERSION=$APP_VERSION

COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN npm ci --workspace @careto/frontend --ignore-scripts

COPY apps ./apps
RUN npm run build --workspace @careto/frontend \
  && find apps/frontend/dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \
     -o -name '*.svg' -o -name '*.json' -o -name '*.webmanifest' \) \
     -exec gzip -9 -k -n {} +

FROM nginxinc/nginx-unprivileged:1.31.2-alpine3.23@sha256:6320020c7da8714feab524e02c08c5a1958675c4e68700e93a2fd8970b065786
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
