CREATE TABLE `finance_rate_cache` (
	`base` text NOT NULL,
	`quote` text NOT NULL,
	`rate` text NOT NULL,
	`as_of` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	`source` text DEFAULT 'frankfurter' NOT NULL,
	PRIMARY KEY(`base`, `quote`)
);
--> statement-breakpoint
CREATE TABLE `sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`workbook_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`row_count` integer DEFAULT 200 NOT NULL,
	`col_count` integer DEFAULT 26 NOT NULL,
	`cells_json` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workbook_id`) REFERENCES `workbooks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sheets_workbook_idx` ON `sheets` (`workbook_id`);--> statement-breakpoint
CREATE TABLE `workbooks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`active_sheet_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `workbooks_tenant_owner_idx` ON `workbooks` (`tenant_id`,`owner_user_id`);