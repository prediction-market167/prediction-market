FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["/bin/sh", "-c", "sed -i 's|NGINX_BACKEND_URL|'\"$NGINX_BACKEND_URL\"'|g' /etc/nginx/conf.d/default.conf && sed -i 's|listen [0-9]*;|listen 3000;|g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]