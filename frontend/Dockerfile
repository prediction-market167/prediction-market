FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Write startup script with guaranteed LF endings via printf
RUN printf '#!/bin/sh\n\
PORT="${PORT:-3000}"\n\
BACKEND="${BACKEND_URL:-http://localhost:8000}"\n\
sed -e "s|NGINX_PORT|$PORT|g" \\\n\
    -e "s|NGINX_BACKEND_URL|$BACKEND|g" \\\n\
    /etc/nginx/conf.d/default.conf.template \\\n\
    > /etc/nginx/conf.d/default.conf\n\
exec nginx -g "daemon off;"\n' > /start-nginx.sh && chmod +x /start-nginx.sh

EXPOSE 3000
CMD ["/bin/sh", "/start-nginx.sh"]
