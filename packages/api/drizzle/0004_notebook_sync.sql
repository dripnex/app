CREATE TABLE `notebook_sync_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`notebook_id` text NOT NULL,
	`version` integer NOT NULL,
	`operation` text NOT NULL,
	`encrypted_data` text,
	`device_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notebook_sync_log_user_version` ON `notebook_sync_log` (`user_id`,`version`);
--> statement-breakpoint
CREATE INDEX `idx_notebook_sync_log_user_notebook` ON `notebook_sync_log` (`user_id`,`notebook_id`);
