CREATE TABLE IF NOT EXISTS "user_logins" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"logged_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"success" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp,
	"salutation" text,
	"first_name" text,
	"last_name" text,
	"father_name" text,
	"wife_name" text,
	"wife_last_name" text,
	"wife_father_name" text,
	"id_number" text,
	"wife_id_number" text,
	"birth_date" text,
	"wife_birth_date" text,
	"city" text,
	"street" text,
	"building_number" text,
	"apartment_number" text,
	"entrance_number" text,
	"neighborhood" text,
	"synagogue" text,
	"home_phone" text,
	"husband_mobile" text,
	"wife_mobile" text,
	"whatsapp_number" text,
	"system_phone_1" text,
	"system_phone_2" text,
	"email_1" text,
	"email_2" text,
	"wants_to_register" text,
	"husband_name" text,
	"husband_father_name" text,
	"is_groom_of_rabbi" text,
	"children_at_home_count" text,
	"has_married_children" text,
	"full_name_search" text,
	"city_lat" real,
	"city_lon" real,
	"street_lat" real,
	"street_lon" real,
	"coordinates" text,
	"password" text,
	"role" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_logins" ADD CONSTRAINT "user_logins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
