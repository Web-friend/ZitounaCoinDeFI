FROM oven/bun:1

WORKDIR /app

# Install workspace dependencies first so code edits do not bust the cache.
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/rules/package.json packages/rules/package.json
RUN bun install --frozen-lockfile

COPY . .
RUN cd apps/api && bunx prisma generate
RUN chmod +x apps/api/docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
