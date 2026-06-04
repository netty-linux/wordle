import { createClient } from '@libsql/client';

let schemaReady: Promise<void> | null = null;

function isDuplicateColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('duplicate column') ||
    message.includes('already exists')
  );
}

/**
 * Garante colunas de metadados do Blob em `canvas_documents` (migration 0002).
 * Idempotente: seguro em cada cold start serverless.
 */
export function ensureCanvasDocumentsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = runCanvasDocumentsMigrations();
  }
  return schemaReady;
}

async function runCanvasDocumentsMigrations(): Promise<void> {
  const url =
    process.env.TURSO_CONNECTION_URL ?? process.env.BLOB_TURSO_DATABASE_URL;
  if (!url) {
    return;
  }

  const authToken =
    process.env.TURSO_AUTH_TOKEN ?? process.env.BLOB_TURSO_AUTH_TOKEN;

  const client = createClient({
    url,
    authToken: authToken || undefined,
  });

  const statements = [
    'ALTER TABLE `canvas_documents` ADD COLUMN `blob_url` text',
    'ALTER TABLE `canvas_documents` ADD COLUMN `size_bytes` integer',
  ];

  for (const statement of statements) {
    try {
      await client.execute(statement);
    } catch (error) {
      if (!isDuplicateColumnError(error)) {
        console.error('[db] Falha na migration canvas_documents:', statement, error);
        throw error;
      }
    }
  }
}
