FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . ./

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate:prod && npm start"]
