ALTER TABLE "user_logins" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_logins" ADD COLUMN "phone_number" text;