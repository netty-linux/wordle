import { sqliteTable, text, blob, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const canvasDocuments = sqliteTable('canvas_documents', {
    id: text('id').primaryKey(), // ID único da sala/canvas
    yjsState: blob('yjs_state', { mode: 'buffer' }).notNull(), // O estado binário puro do Yjs
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});