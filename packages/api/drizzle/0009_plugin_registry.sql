ALTER TABLE `plugin_catalog` ADD `owner_user_id` text REFERENCES users(id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_plugin_catalog_owner` ON `plugin_catalog` (`owner_user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `plugin_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`plugin_id` text NOT NULL REFERENCES `plugin_catalog`(`id`) ON DELETE CASCADE,
	`version` text NOT NULL,
	`bundle_url` text NOT NULL,
	`published_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_plugin_versions_unique` ON `plugin_versions` (`plugin_id`, `version`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_plugin_versions_plugin` ON `plugin_versions` (`plugin_id`);
