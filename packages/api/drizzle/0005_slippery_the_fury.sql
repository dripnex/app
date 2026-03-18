ALTER TABLE `shared_notes` ADD `tags` text NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `shared_notes` ADD `backlinks` text NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `shared_notes` ADD `word_count` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `shared_notes` ADD `notebook_name` text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE INDEX `idx_shared_notes_user_public` ON `shared_notes` (`user_id`,`is_public`);
