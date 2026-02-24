CREATE TABLE `plugin_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`readme` text,
	`author` text NOT NULL,
	`version` text NOT NULL,
	`category` text NOT NULL DEFAULT 'other',
	`tags` text NOT NULL DEFAULT '[]',
	`icon` text NOT NULL DEFAULT 'puzzle',
	`repository_url` text,
	`bundle_url` text,
	`downloads` integer NOT NULL DEFAULT 0,
	`min_api_version` text,
	`is_built_in` integer NOT NULL DEFAULT 0,
	`status` text NOT NULL DEFAULT 'published',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plugin_catalog_slug_unique` ON `plugin_catalog` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_plugin_catalog_category` ON `plugin_catalog` (`category`);
--> statement-breakpoint
CREATE INDEX `idx_plugin_catalog_status` ON `plugin_catalog` (`status`);
