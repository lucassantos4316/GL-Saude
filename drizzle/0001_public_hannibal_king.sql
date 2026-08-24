CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`professionalId` int NOT NULL,
	`clinicId` int NOT NULL,
	`kind` enum('consultation','exam') NOT NULL,
	`status` enum('held','pending_payment','confirmed','cancelled','completed') NOT NULL DEFAULT 'held',
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`holdExpiresAt` timestamp,
	`cancellationPolicy` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clinical_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`professionalId` int NOT NULL,
	`appointmentId` int,
	`type` enum('record','report','prescription','exam_request') NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clinical_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clinics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`city` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clinics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`method` enum('pix','credit_card') NOT NULL,
	`status` enum('pending','confirmed','failed','refunded') NOT NULL DEFAULT 'pending',
	`amount` decimal(10,2) NOT NULL,
	`gatewayReference` varchar(160),
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `professionals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clinicId` int NOT NULL,
	`specialty` varchar(120) NOT NULL,
	`crm` varchar(40) NOT NULL,
	`rating` decimal(2,1) NOT NULL DEFAULT '5.0',
	`consultationPrice` decimal(10,2) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	CONSTRAINT `professionals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','patient','doctor','operator') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `failedLoginAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lockedUntil` timestamp;--> statement-breakpoint
CREATE INDEX `appointments_patient_idx` ON `appointments` (`patientId`);--> statement-breakpoint
CREATE INDEX `appointments_schedule_idx` ON `appointments` (`professionalId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `professionals_clinic_idx` ON `professionals` (`clinicId`);--> statement-breakpoint
CREATE INDEX `professionals_specialty_idx` ON `professionals` (`specialty`);