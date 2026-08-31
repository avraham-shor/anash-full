# 22.x, not 20: package.json declares engines node >=22.3, and npm test needs
# --experimental-test-module-mocks, which only exists from 22.3 on.
FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . ./

EXPOSE 3000

# Start only. Migrations are a deploy-time step, not a container-start step:
# railway.json runs them via preDeployCommand, once per deploy, before the new
# version takes traffic. Chaining them into CMD here did nothing on Railway
# anyway -- an explicit startCommand overrides CMD -- and on docker-compose,
# which defines no database of its own, it silently migrated whatever
# DATABASE_URL happened to point at. Run `npm run db:migrate:prod` by hand there.
CMD ["npm", "start"]
