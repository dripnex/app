CREATE TABLE `shared_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`note_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL DEFAULT '',
	`content` text NOT NULL DEFAULT '',
	`is_public` integer NOT NULL DEFAULT 1,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shared_notes_slug_unique` ON `shared_notes` (`slug`);
--> statement-breakpoint
CREATE UNIQUE INDEX `shared_notes_user_note_unique` ON `shared_notes` (`user_id`, `note_id`);
