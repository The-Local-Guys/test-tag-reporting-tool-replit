CREATE TABLE "custom_form_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"csv_data" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "custom_form_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"service_type" text NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer,
	"asset_number" text NOT NULL,
	"item_name" text NOT NULL,
	"item_type" text NOT NULL,
	"location" text NOT NULL,
	"classification" text NOT NULL,
	"result" text NOT NULL,
	"failure_reason" text,
	"action_taken" text,
	"frequency" text NOT NULL,
	"notes" text,
	"photo_data" text,
	"vision_inspection" boolean DEFAULT true,
	"electrical_test" boolean DEFAULT true,
	"maintenance_type" text,
	"globe_type" text,
	"discharge_test" boolean,
	"switching_test" boolean,
	"charging_test" boolean,
	"manufacturer_info" text,
	"installation_date" text,
	"lux_test" boolean,
	"lux_reading" text,
	"lux_compliant" boolean,
	"equipment_type" text,
	"extinguisher_type" text,
	"size" text,
	"weight" text,
	"test_type" text,
	"fire_visual_inspection" boolean,
	"accessibility_check" boolean,
	"signage_check" boolean,
	"operational_test" boolean,
	"pressure_test" boolean,
	"push_button_test" boolean,
	"injection_timed_test" boolean,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "test_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_type" text DEFAULT 'electrical' NOT NULL,
	"test_date" text NOT NULL,
	"technician_name" text NOT NULL,
	"client_name" text NOT NULL,
	"site_contact" text NOT NULL,
	"address" text NOT NULL,
	"country" text NOT NULL,
	"user_id" integer,
	"starting_asset_number" integer,
	"technician_licensed" boolean,
	"compliance_standard" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'technician' NOT NULL,
	"franchise_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_session_id_test_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."test_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");