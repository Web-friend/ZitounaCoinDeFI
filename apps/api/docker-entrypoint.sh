#!/bin/sh
set -e

cd /app/apps/api

echo "Applying database migrations..."
bunx prisma migrate deploy

echo "Seeding the demo (idempotent)..."
bun src/scripts/seed.js

echo "Starting the API..."
exec bun src/index.js
