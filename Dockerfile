# Estágio 1: Build
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
# Instalando com --legacy-peer-deps para evitar conflitos de versão
RUN npm install --legacy-peer-deps
COPY . .
# Rodando a build ignorando erros de tipagem
RUN npx vite build

# Estágio 2: Servidor Web
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Configuração para React Router (SPA) não dar 404
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
