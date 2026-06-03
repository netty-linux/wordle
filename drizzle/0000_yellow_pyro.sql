CREATE TABLE `canvas_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`yjs_state` blob NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
