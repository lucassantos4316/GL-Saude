CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`appointmentId` int,
	`channel` enum('email','whatsapp') NOT NULL,
	`event` enum('confirmation','cancellation','reminder_24h','reminder_1h','access_link') NOT NULL,
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`scheduledFor` timestamp NOT NULL,
	`sentAt` timestamp,
	`providerReference` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
