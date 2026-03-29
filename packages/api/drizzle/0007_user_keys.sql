CREATE TABLE `user_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`salt` text NOT NULL,
	`wrapped_cek` text NOT NULL,
	`wrapped_cek_recovery` text,
	`kdf_params` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_keys_user_id_unique` ON `user_keys` (`user_id`);
