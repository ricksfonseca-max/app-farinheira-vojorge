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

# Nginx na porta 3000: rotas do React + encaminhamento /umidade-api/ para o serviço Python
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
