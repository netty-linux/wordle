/**
 * E2E API smoke: login → GET → POST (Yjs) → GET
 * Uso: node scripts/e2e-canvas-api.mjs [baseUrl]
 * Requer servidor rodando (npm run dev).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as Y from 'yjs';

const baseUrl = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const workspaceId = 'default-canvas-room';
const testEmail = `e2e-${Date.now()}@wordle.test`;
const testPassword = 'e2e-test-pass-123';

function loadEnvFile(filename, { override = false } = {}) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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
    if (override || !process.env[key]?.trim()) process.env[key] = value;
  }
}

loadEnvFile('.env.local', { override: true });

function mergeCookies(existing, response) {
  const jar = new Map();
  const parse = (str) => {
    for (const part of str.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k) jar.set(k, v.join('='));
    }
  };
  if (existing) parse(existing);
  const setCookie = response.headers.getSetCookie?.() ?? [];
  for (const c of setCookie) parse(c.split(';')[0]);
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function jsonOrText(response) {
  const text = await response.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

async function login() {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  let cookies = mergeCookies('', csrfRes);

  await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ email: testEmail, password: testPassword, name: 'E2E' }),
  });

  const signInRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies,
    },
    body: new URLSearchParams({
      csrfToken,
      email: testEmail,
      password: testPassword,
      callbackUrl: `${baseUrl}/`,
      json: 'true',
    }),
    redirect: 'manual',
  });

  cookies = mergeCookies(cookies, signInRes);
  const { json } = await jsonOrText(signInRes);

  if (!cookies.includes('authjs.session-token') && !cookies.includes('__Secure-authjs.session-token')) {
    throw new Error(`Login falhou: ${JSON.stringify(json)} cookies=${cookies.slice(0, 80)}`);
  }

  return cookies;
}

async function canvasGet(cookies) {
  const res = await fetch(`${baseUrl}/api/canvas/${workspaceId}`, {
    headers: { Cookie: cookies },
    redirect: 'manual',
  });
  const buf = await res.arrayBuffer();
  return { status: res.status, bytes: buf.byteLength, contentType: res.headers.get('content-type') };
}

async function canvasPost(cookies, body) {
  const res = await fetch(`${baseUrl}/api/canvas/${workspaceId}`, {
    method: 'POST',
    headers: {
      Cookie: cookies,
      'Content-Type': 'application/octet-stream',
      'X-Canvas-Update': 'incremental',
    },
    body,
    redirect: 'manual',
  });
  const { json, text } = await jsonOrText(res);
  return { status: res.status, json, text };
}

async function main() {
  console.log(`\n=== E2E Canvas API @ ${baseUrl} ===\n`);

  const cookies = await login();
  console.log('✓ Login OK\n');

  const get1 = await canvasGet(cookies);
  console.log('GET #1 (antes do save):', get1);

  const doc = new Y.Doc();
  const map = doc.getMap('tldraw_records');
  map.set('e2e-marker', { id: 'e2e-marker', typeName: 'shape' });
  const update = Y.encodeStateAsUpdate(doc);

  const post1 = await canvasPost(cookies, Buffer.from(update));
  console.log('POST #1:', post1);

  const get2 = await canvasGet(cookies);
  console.log('GET #2 (após save):', get2);

  const doc2 = new Y.Doc();
  if (get2.bytes > 0) {
    const getRes = await fetch(`${baseUrl}/api/canvas/${workspaceId}`, {
      headers: { Cookie: cookies },
    });
    Y.applyUpdate(doc2, new Uint8Array(await getRes.arrayBuffer()));
  }
  doc2.getMap('tldraw_records').set('e2e-marker-2', {
    id: 'e2e-marker-2',
    typeName: 'shape',
  });
  const diff = Y.diffUpdate(
    Y.encodeStateAsUpdate(doc2),
    Y.encodeStateVector(doc2)
  );
  const post2 = await canvasPost(
    cookies,
    Buffer.from(Y.encodeStateAsUpdate(doc2))
  );
  console.log('POST #2 (incremental/full):', post2);

  const get3 = await canvasGet(cookies);
  console.log('GET #3 (após 2º save):', get3);

  const ok =
    post1.status === 200 &&
    post1.json?.persisted === true &&
    get2.status === 200 &&
    get2.bytes > 0 &&
    get3.status === 200 &&
    get3.bytes > 0;

  console.log('\n--- Resultado ---');
  if (ok) {
    console.log('PASS: persistência API OK (simula F5 via GET #2/#3)');
    console.log('blobPath:', post1.json?.blobPath);
    console.log('mergedBytes:', post1.json?.mergedBytes);
    process.exit(0);
  }

  console.log('FAIL: verifique logs do servidor e npm run doctor');
  process.exit(1);
}

main().catch((err) => {
  console.error('E2E crashed:', err);
  process.exit(1);
});
