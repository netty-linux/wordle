/**
 * Wired Wordle — diagnóstico local de env, Turso e Vercel Blob.
 * Uso: npm run doctor [--skip-blob]
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { list } from '@vercel/blob';

const REQUIRED_ENV = [
  {
    label: 'BLOB_READ_WRITE_TOKEN',
    keys: ['BLOB_READ_WRITE_TOKEN'],
    hint: 'Vercel Dashboard → Storage → Blob → Connect, ou: vercel blob create-store ... --yes',
  },
  {
    label: 'Turso URL',
    keys: ['BLOB_TURSO_DATABASE_URL', 'TURSO_CONNECTION_URL'],
    hint: 'Integração Turso no projeto Vercel ou TURSO_CONNECTION_URL no .env.local',
  },
  {
    label: 'Turso auth',
    keys: ['BLOB_TURSO_AUTH_TOKEN', 'TURSO_AUTH_TOKEN'],
    hint: 'Token da integração Turso (não vem no vercel env pull de integrações)',
  },
];

const RECOMMENDED_ENV = [
  {
    label: 'AUTH_SECRET',
    keys: ['AUTH_SECRET'],
    hint: 'openssl rand -base64 32',
  },
];

const SCHEMA_COLUMNS = ['blob_url', 'size_bytes'];

/** Valores muito curtos costumam ser placeholder do vercel env pull. */
const MIN_LENGTH = {
  BLOB_READ_WRITE_TOKEN: 20,
  BLOB_TURSO_AUTH_TOKEN: 20,
  TURSO_AUTH_TOKEN: 20,
  BLOB_TURSO_DATABASE_URL: 12,
  TURSO_CONNECTION_URL: 12,
};

const skipBlob = process.argv.includes('--skip-blob');

/** @type {{ name: string; ok: boolean; detail: string }[]} */
const results = [];

function loadEnvFile(filename, { override = false } = {}) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return false;

  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || !process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }

  return true;
}

function resolveEnv(keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return { key, value };
  }
  return null;
}

function checkEnvGroup(group, required) {
  for (const item of group) {
    const resolved = resolveEnv(item.keys);

    if (resolved) {
      const minLen = Math.max(
        ...item.keys.map((k) => MIN_LENGTH[k] ?? 1)
      );
      const tooShort = resolved.value.length < minLen;

      results.push({
        name: item.label,
        ok: !tooShort || !required,
        detail: tooShort
          ? `${resolved.key} muito curto (${resolved.value.length} chars)`
          : `${resolved.key} (${resolved.value.length} chars)`,
      });

      if (tooShort && required) {
        console.log(
          `  ✗ ${item.label}: ${resolved.key} parece inválido (${resolved.value.length} chars, mín. ${minLen})`
        );
        console.log(`      → ${item.hint}`);
      } else if (tooShort) {
        console.log(
          `  ○ ${item.label}: ${resolved.key} curto (${resolved.value.length} chars) — recomendado revisar`
        );
      } else {
        console.log(
          `  ✓ ${item.label}: ${resolved.key} (${resolved.value.length} chars)`
        );
      }
    } else {
      const emptyKey = item.keys.find((k) => k in process.env);
      const status = emptyKey ? 'vazio' : 'ausente';
      results.push({
        name: item.label,
        ok: !required,
        detail: status,
      });
      console.log(
        `  ${required ? '✗' : '○'} ${item.label}: ${status}${required ? '' : ' (recomendado)'}`
      );
      if (required) {
        console.log(`      → ${item.hint}`);
      }
    }
  }
}

/** Encerra o processo sem assert do libuv no Windows (handles HTTP ainda fechando). */
function exitGracefully(code) {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 150).unref();
}

async function checkTursoSchema() {
  const turso = resolveEnv([
    'BLOB_TURSO_DATABASE_URL',
    'TURSO_CONNECTION_URL',
  ]);
  const token = resolveEnv(['BLOB_TURSO_AUTH_TOKEN', 'TURSO_AUTH_TOKEN']);

  if (!turso) {
    results.push({
      name: 'Turso schema',
      ok: false,
      detail: 'sem URL — pulando PRAGMA',
    });
    console.log('  ✗ Turso schema: sem URL configurada');
    return;
  }

  const client = createClient({
    url: turso.value,
    authToken: token?.value,
  });

  try {
    const tableInfo = await client.execute(
      'PRAGMA table_info(canvas_documents)'
    );

    const columns = new Set(
      tableInfo.rows.map((row) => String(row.name ?? row[1] ?? ''))
    );

    const missing = SCHEMA_COLUMNS.filter((col) => !columns.has(col));

    if (missing.length === 0) {
      results.push({
        name: 'Turso schema',
        ok: true,
        detail: `canvas_documents OK (${[...columns].join(', ')})`,
      });
      console.log(
        `  ✓ Turso schema: colunas ${SCHEMA_COLUMNS.join(', ')} presentes`
      );
    } else {
      results.push({
        name: 'Turso schema',
        ok: false,
        detail: `faltam: ${missing.join(', ')}`,
      });
      console.log(`  ✗ Turso schema: faltam colunas ${missing.join(', ')}`);
      console.log(
        '      → Rode db:push ou deixe o deploy aplicar ensure-schema no primeiro POST'
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name: 'Turso schema', ok: false, detail: message });
    console.log(`  ✗ Turso schema: ${message}`);
  } finally {
    client.close();
  }
}

async function checkBlobStore() {
  const token = resolveEnv(['BLOB_READ_WRITE_TOKEN']);

  if (!token) {
    results.push({
      name: 'Vercel Blob API',
      ok: false,
      detail: 'BLOB_READ_WRITE_TOKEN ausente',
    });
    console.log('  ✗ Vercel Blob API: token ausente');
    return;
  }

  try {
    await list({ limit: 1, token: token.value });
    results.push({
      name: 'Vercel Blob API',
      ok: true,
      detail: 'list() OK',
    });
    console.log('  ✓ Vercel Blob API: token válido (list OK)');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name: 'Vercel Blob API', ok: false, detail: message });
    console.log(`  ✗ Vercel Blob API: ${message}`);
    console.log(
      '      → vercel blob list-stores  |  vercel blob create-store wordle-canvas --access public --yes'
    );
  }
}

async function main() {
  console.log('\n🏥 Wired Wordle — doctor\n');

  const loadedLocal = loadEnvFile('.env.local', { override: true });
  loadEnvFile('.env');

  console.log(
    `Arquivo: ${loadedLocal ? '.env.local carregado' : '.env.local não encontrado (só process.env)'}\n`
  );

  console.log('Variáveis obrigatórias (canvas + persistência):');
  checkEnvGroup(REQUIRED_ENV, true);

  console.log('\nVariáveis recomendadas:');
  checkEnvGroup(RECOMMENDED_ENV, false);

  console.log('\nBanco Turso:');
  await checkTursoSchema();

  if (skipBlob) {
    console.log('\nVercel Blob: ignorado (--skip-blob)');
  } else {
    console.log('\nVercel Blob:');
    await checkBlobStore();
  }

  const failed = results.filter((r) => !r.ok);
  const requiredFailed = failed.filter((r) =>
    ['BLOB_READ_WRITE_TOKEN', 'Turso URL', 'Turso auth', 'Turso schema', 'Vercel Blob API'].includes(
      r.name
    )
  );

  console.log('\n--- Resumo ---');
  if (failed.length === 0) {
    console.log('Tudo OK. Cole este output no prompt do Cursor se precisar de contexto.\n');
    exitGracefully(0);
    return;
  }

  console.log(`Falhas: ${failed.map((f) => f.name).join(', ')}`);
  console.log(
    '\nPrompt sugerido para o Cursor:\n' +
      `  "doctor falhou: ${failed.map((f) => `${f.name} (${f.detail})`).join('; ')}. ` +
      'Corrigir env/schema/blob no projeto wordle."\n'
  );

  exitGracefully(requiredFailed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\nDoctor crashed:', error);
  exitGracefully(1);
});
