CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`credential_hash` text NOT NULL,
	`company` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_key` text NOT NULL,
	`image_name` text NOT NULL,
	`image_type` text NOT NULL,
	`image_size` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submissions_credential_hash` ON `submissions` (`credential_hash`);