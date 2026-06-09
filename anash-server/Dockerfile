FROM node:20-bookworm AS builder

WORKDIR /app

# Install native build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 sqlite3 libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Force sqlite3 to build from source against this system's glibc
RUN cd node_modules/sqlite3 && npx --yes node-pre-gyp install --fallback-to-build --build-from-source 2>/dev/null || npm rebuild sqlite3 --build-from-source

# Install build-time tools (typescript)
RUN npm install typescript

# Copy application source
COPY . ./

# Compile TypeScript to JavaScript
RUN npx tsc

# Copy the .mjs entry point into dist and rewrite the .ts import to .js
# (tsc doesn't compile .mjs files, so we handle it manually)
RUN mkdir -p dist/bin \
    && cp bin/www.mjs dist/bin/www.mjs \
    && sed -i "s|from '../app.ts'|from '../app.js'|g" dist/bin/www.mjs

# Remove build-time tools
RUN npm uninstall typescript

# ------- Runtime stage -------
FROM node:20-bookworm-slim

WORKDIR /app

# Install runtime sqlite3 library
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy built app from builder
COPY --from=builder /app /app

EXPOSE 3000

CMD ["node", "dist/bin/www.mjs"]
