#!/bin/sh
set -e

cd /repo/apps/api

wait_for_tcp() {
  host="$1"
  port="$2"
  label="$3"
  export WAIT_HOST="$host"
  export WAIT_PORT="$port"
  export WAIT_LABEL="$label"
  echo "Waiting for ${label} at ${host}:${port}..."
  node <<'NODE'
const net = require('net');
const host = process.env.WAIT_HOST;
const port = Number(process.env.WAIT_PORT);
const label = process.env.WAIT_LABEL;
const maxAttempts = 30;
const delayMs = 2000;

function tryConnect() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve();
    });
    socket.on('error', reject);
    socket.setTimeout(3000, () => {
      socket.destroy();
      reject(new Error('timeout'));
    });
  });
}

(async () => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await tryConnect();
      console.log(`${label} is accepting connections.`);
      process.exit(0);
    } catch {
      console.log(
        `${label} not ready (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs / 1000}s...`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  console.error(`${label} unreachable after retries.`);
  process.exit(1);
})();
NODE
}

wait_for_tcp "${PGHOST:-postgres}" "${PGPORT:-5432}" "PostgreSQL"
wait_for_tcp "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" "Redis"

echo "Applying database migrations..."
pnpm exec prisma migrate deploy

echo "Starting API..."
exec node dist/src/main.js
