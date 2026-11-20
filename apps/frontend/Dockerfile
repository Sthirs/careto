FROM node:26.13.0-alpine3.23@sha256:44a3247313f9bc069a4ec25d01b66254ed7dc4d0408727d8720dc827f0753423 AS build
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

FROM nginx:1.31.9-alpine@sha256:fb4658584bd9a916ffb6f6e365f97c25cfdb2923801f551ea08356e695f14ff7
# Run as non-root on a read-only root fs: drop `user`, move pid + temp paths to /tmp
RUN sed -i -e '/^user /d' \
           -e 's,^pid .*,pid /tmp/nginx.pid;,' \
           -e '/^http {/a\    client_body_temp_path /tmp/client_temp;\n    proxy_temp_path /tmp/proxy_temp;\n    fastcgi_temp_path /tmp/fastcgi_temp;\n    uwsgi_temp_path /tmp/uwsgi_temp;\n    scgi_temp_path /tmp/scgi_temp;' \
           /etc/nginx/nginx.conf
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
