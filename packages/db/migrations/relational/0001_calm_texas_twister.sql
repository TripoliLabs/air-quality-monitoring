ALTER TABLE "sensors" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
UPDATE "sensors" SET "status" = 'retired' WHERE NOT "is_active";--> statement-breakpoint
ALTER TABLE "sensors" ADD COLUMN "installed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sensors" ADD COLUMN "is_simulated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "sensors" SET "is_simulated" = true;