#!/usr/bin/env node
/**
 * Offline Phase 3 readiness check (env + optional live API).
 * Run from repo root: pnpm phase3:bootstrap
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, 'apps/api/.env');

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function flag(env, key) {
  const v = env[key] ?? process.env[key];
  return Boolean(v && String(v).trim() && v !== 'false');
}

const env = { ...loadEnvFile(envPath), ...process.env };
const apiBase = env.PHASE3_API_URL ?? 'http://localhost:3000';

console.log('Phase 3 bootstrap check\n');
console.log(`Env file: ${existsSync(envPath) ? envPath : '(missing — using process env only)'}\n`);

const rows = [
  ['OPENAI_API_KEY (Parts 1–2)', flag(env, 'OPENAI_API_KEY')],
  ['ANTHROPIC_API_KEY (wingman)', flag(env, 'ANTHROPIC_API_KEY')],
  ['GEMINI_API_KEY (meal photos)', flag(env, 'GEMINI_API_KEY')],
  ['ASSISTANT_ENABLED', env.ASSISTANT_ENABLED === 'true'],
];

for (const [label, ok] of rows) {
  console.log(`  ${ok ? '✓' : '○'} ${label}`);
}

console.log('\nLive API (optional):');
const url = `${apiBase.replace(/\/$/, '')}/api/assistant/bootstrap`;
try {
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`  ✗ ${url} → HTTP ${res.status}`);
  } else {
    const body = await res.json();
    console.log(`  ✓ ${url}`);
    console.log(`    phase=${body.phase} enabled=${body.enabled}`);
    console.log(
      `    DB tables=${body.database?.assistantTables} OpenAI=${body.providers?.parts12OpenAi} Anthropic=${body.providers?.assistantAnthropic}`,
    );
    const todo = (body.checklist ?? []).filter((c) => c.status !== 'done');
    if (todo.length) {
      console.log(`    ${todo.length} checklist item(s) not done — see docs/PHASE3_BOOTSTRAP.md`);
    }
  }
} catch {
  console.log(`  ○ API not reachable at ${url} (start pnpm dev:api after migrate)`);
}

console.log('\nNext: cd apps/api && pnpm exec prisma migrate deploy\n');
