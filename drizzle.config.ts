import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url:
      process.env.TURSO_CONNECTION_URL ??
      process.env.BLOB_TURSO_DATABASE_URL!,
    authToken:
      process.env.TURSO_AUTH_TOKEN ?? process.env.BLOB_TURSO_AUTH_TOKEN,
  },
});
