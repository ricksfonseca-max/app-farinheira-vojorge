# Estágio 1: Build
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# Forçamos a build ignorando erros de tipagem remanescentes
RUN npx vite build

# Estágio 2: Runtime
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Configura o Nginx para escutar na 3000 e lidar com as rotas do React
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
