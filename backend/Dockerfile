FROM node:22-alpine
WORKDIR /app/backend
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
# Логгер пишет в <корень проекта>/logs, то есть в /app/logs.
RUN mkdir -p /app/logs uploads
ENV NODE_ENV=production PORT=5000
EXPOSE 5000
CMD ["node", "src/index.js"]
