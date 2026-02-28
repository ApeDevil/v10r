CREATE SCHEMA "ai";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "jobs";
--> statement-breakpoint
CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE SCHEMA "rag";
--> statement-breakpoint
CREATE SCHEMA "showcase";
--> statement-breakpoint
CREATE TYPE "showcase"."audit_action" AS ENUM('create', 'update', 'delete', 'restore', 'export', 'import', 'login', 'logout');--> statement-breakpoint
CREATE TYPE "showcase"."audit_severity" AS ENUM('debug', 'info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "rag"."chunk_level" AS ENUM('sentence', 'paragraph', 'section');--> statement-breakpoint
CREATE TYPE "notifications"."delivery_status" AS ENUM('pending', 'processing', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "notifications"."digest_frequency" AS ENUM('instant', 'daily', 'weekly', 'never');--> statement-breakpoint
CREATE TYPE "rag"."document_source" AS ENUM('upload', 'web', 'text', 'api');--> statement-breakpoint
CREATE TYPE "rag"."document_status" AS ENUM('pending', 'processing', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "jobs"."job_execution_status" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TYPE "jobs"."job_trigger" AS ENUM('cron', 'scheduler', 'manual');--> statement-breakpoint
CREATE TYPE "ai"."message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "notifications"."notification_channel" AS ENUM('email', 'telegram', 'discord');--> statement-breakpoint
CREATE TYPE "notifications"."notification_type" AS ENUM('mention', 'comment', 'system', 'success', 'security', 'follow');--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showcase"."audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"sequence_num" bigserial NOT NULL,
	"action" "showcase"."audit_action" NOT NULL,
	"severity" "showcase"."audit_severity" DEFAULT 'info' NOT NULL,
	"specimen_id" integer,
	"actor_id" text DEFAULT 'system' NOT NULL,
	"description" text NOT NULL,
	"correlation_id" uuid DEFAULT gen_random_uuid(),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_sequence_num_unique" UNIQUE("sequence_num")
);
--> statement-breakpoint
CREATE TABLE "rag"."chunk" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"parent_id" text,
	"level" "rag"."chunk_level" NOT NULL,
	"position" integer NOT NULL,
	"content" text NOT NULL,
	"context_prefix" text,
	"token_count" integer NOT NULL,
	"content_hash" text NOT NULL,
	"overlap_prev" integer DEFAULT 0 NOT NULL,
	"overlap_next" integer DEFAULT 0 NOT NULL,
	"embedding_model_id" text,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag"."collection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag"."collection_document" (
	"collection_id" text NOT NULL,
	"document_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_document_collection_id_document_id_pk" PRIMARY KEY("collection_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "showcase"."collection_shelf" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scores" integer[],
	"tags" text[] DEFAULT ARRAY[]::text[],
	"steps" jsonb[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai"."conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag"."document" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"source" "rag"."document_source" NOT NULL,
	"source_uri" text,
	"mime_type" text,
	"status" "rag"."document_status" DEFAULT 'pending' NOT NULL,
	"total_chunks" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"content_hash" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showcase"."document_vault" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"raw_json" json,
	"metadata" jsonb,
	"settings" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag"."embedding_model" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model_name" text NOT NULL,
	"dimensions" integer NOT NULL,
	"max_tokens" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs"."job_execution" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobs"."job_execution_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"job_slug" text NOT NULL,
	"status" "jobs"."job_execution_status" NOT NULL,
	"trigger" "jobs"."job_trigger" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer NOT NULL,
	"result_count" integer,
	"error_message" text,
	CONSTRAINT "duration_positive" CHECK ("jobs"."job_execution"."duration_ms" >= 0),
	CONSTRAINT "result_count_positive" CHECK ("jobs"."job_execution"."result_count" IS NULL OR "jobs"."job_execution"."result_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai"."message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" "ai"."message_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showcase"."network_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_name" text NOT NULL,
	"ip_address" "inet" NOT NULL,
	"network_block" "cidr",
	"mac_address" "macaddr",
	"location" "point",
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notification_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"channel" "notifications"."notification_channel" NOT NULL,
	"status" "notifications"."delivery_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"error_code" text,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"attempted_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notification_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email_mention" boolean DEFAULT true NOT NULL,
	"email_comment" boolean DEFAULT true NOT NULL,
	"email_system" boolean DEFAULT false NOT NULL,
	"email_success" boolean DEFAULT false NOT NULL,
	"email_security" boolean DEFAULT true NOT NULL,
	"email_follow" boolean DEFAULT true NOT NULL,
	"telegram_mention" boolean DEFAULT false NOT NULL,
	"telegram_comment" boolean DEFAULT false NOT NULL,
	"telegram_system" boolean DEFAULT false NOT NULL,
	"telegram_security" boolean DEFAULT true NOT NULL,
	"discord_mention" boolean DEFAULT false NOT NULL,
	"discord_comment" boolean DEFAULT false NOT NULL,
	"discord_system" boolean DEFAULT false NOT NULL,
	"discord_security" boolean DEFAULT true NOT NULL,
	"digest_frequency" "notifications"."digest_frequency" DEFAULT 'instant' NOT NULL,
	"quiet_start" text,
	"quiet_end" text,
	"muted_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"actor_id" text,
	"type" "notifications"."notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"entity_ref" text,
	"group_key" text,
	"action_url" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "showcase"."range_booking" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_name" text NOT NULL,
	"floor_range" "int4range",
	"booking_period" "tstzrange",
	"reservation_dates" daterange,
	"priority" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "priority_valid" CHECK ("showcase"."range_booking"."priority" >= 1 AND "showcase"."range_booking"."priority" <= 10)
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "notifications"."telegram_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "showcase"."temporal_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"event_date" date,
	"event_time" time,
	"local_timestamp" timestamp,
	"utc_timestamp" timestamp with time zone,
	"duration" interval,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valid_range_check" CHECK ("showcase"."temporal_record"."valid_to" IS NULL OR "showcase"."temporal_record"."valid_from" < "showcase"."temporal_record"."valid_to")
);
--> statement-breakpoint
CREATE TABLE "showcase"."type_specimen" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"code" varchar(10) NOT NULL,
	"country_code" char(2),
	"rating" smallint,
	"quantity" integer DEFAULT 0 NOT NULL,
	"view_count" bigint DEFAULT 0 NOT NULL,
	"price" numeric(10, 2),
	"temperature" real,
	"latitude" double precision,
	"longitude" double precision,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "type_specimen_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "type_specimen_code_unique" UNIQUE("code"),
	CONSTRAINT "rating_range" CHECK ("showcase"."type_specimen"."rating" >= 1 AND "showcase"."type_specimen"."rating" <= 5),
	CONSTRAINT "quantity_positive" CHECK ("showcase"."type_specimen"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "showcase"."type_specimen_history" (
	"history_id" serial PRIMARY KEY NOT NULL,
	"specimen_id" integer NOT NULL,
	"version" integer NOT NULL,
	"label" text NOT NULL,
	"code" varchar(10) NOT NULL,
	"rating" smallint,
	"quantity" integer NOT NULL,
	"price" numeric(10, 2),
	"is_active" boolean NOT NULL,
	"changed_by" text DEFAULT 'system' NOT NULL,
	"change_type" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "notifications"."user_discord_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_username" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"token_refresh_failed_at" timestamp with time zone,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tokens_refreshed_at" timestamp with time zone,
	"unlinked_at" timestamp with time zone,
	CONSTRAINT "user_discord_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_discord_accounts_discord_user_id_unique" UNIQUE("discord_user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications"."user_telegram_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"telegram_username" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unlinked_at" timestamp with time zone,
	CONSTRAINT "user_telegram_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_telegram_accounts_telegram_chat_id_unique" UNIQUE("telegram_chat_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showcase"."audit_log" ADD CONSTRAINT "audit_log_specimen_id_type_specimen_id_fk" FOREIGN KEY ("specimen_id") REFERENCES "showcase"."type_specimen"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag"."chunk" ADD CONSTRAINT "chunk_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "rag"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag"."chunk" ADD CONSTRAINT "chunk_embedding_model_id_embedding_model_id_fk" FOREIGN KEY ("embedding_model_id") REFERENCES "rag"."embedding_model"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag"."collection" ADD CONSTRAINT "collection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag"."collection_document" ADD CONSTRAINT "collection_document_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "rag"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag"."collection_document" ADD CONSTRAINT "collection_document_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "rag"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai"."conversation" ADD CONSTRAINT "conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag"."document" ADD CONSTRAINT "document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai"."message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "ai"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "notifications"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notification_settings" ADD CONSTRAINT "notification_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notifications" ADD CONSTRAINT "notifications_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."telegram_verification_tokens" ADD CONSTRAINT "telegram_verification_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showcase"."type_specimen_history" ADD CONSTRAINT "type_specimen_history_specimen_id_type_specimen_id_fk" FOREIGN KEY ("specimen_id") REFERENCES "showcase"."type_specimen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."user_discord_accounts" ADD CONSTRAINT "user_discord_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."user_telegram_accounts" ADD CONSTRAINT "user_telegram_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_specimen_id_idx" ON "showcase"."audit_log" USING btree ("specimen_id");--> statement-breakpoint
CREATE INDEX "audit_actor_id_idx" ON "showcase"."audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_occurred_at_idx" ON "showcase"."audit_log" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "showcase"."audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "chunk_document_idx" ON "rag"."chunk" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "chunk_parent_idx" ON "rag"."chunk" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "chunk_doc_level_pos_idx" ON "rag"."chunk" USING btree ("document_id","level","position");--> statement-breakpoint
CREATE UNIQUE INDEX "chunk_doc_hash_level_idx" ON "rag"."chunk" USING btree ("document_id","content_hash","level");--> statement-breakpoint
CREATE INDEX "chunk_embedding_model_idx" ON "rag"."chunk" USING btree ("embedding_model_id");--> statement-breakpoint
CREATE INDEX "chunk_children_idx" ON "rag"."chunk" USING btree ("parent_id","position") WHERE parent_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "collection_user_idx" ON "rag"."collection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collection_active_idx" ON "rag"."collection" USING btree ("user_id","name") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "collection_document_doc_idx" ON "rag"."collection_document" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "shelf_tags_gin_idx" ON "showcase"."collection_shelf" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "shelf_scores_gin_idx" ON "showcase"."collection_shelf" USING gin ("scores");--> statement-breakpoint
CREATE INDEX "conversation_user_updated_idx" ON "ai"."conversation" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "document_user_idx" ON "rag"."document" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_status_idx" ON "rag"."document" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_content_hash_idx" ON "rag"."document" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "document_active_idx" ON "rag"."document" USING btree ("created_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "vault_metadata_gin_idx" ON "showcase"."document_vault" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "vault_active_title_idx" ON "showcase"."document_vault" USING btree ("title") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "job_exec_slug_started_idx" ON "jobs"."job_execution" USING btree ("job_slug","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "job_exec_status_started_idx" ON "jobs"."job_execution" USING btree ("status","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "job_exec_started_idx" ON "jobs"."job_execution" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "message_conv_created_idx" ON "ai"."message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "registry_device_name_idx" ON "showcase"."network_registry" USING btree ("device_name");--> statement-breakpoint
CREATE INDEX "registry_registered_at_idx" ON "showcase"."network_registry" USING btree ("registered_at");--> statement-breakpoint
CREATE INDEX "delivery_pending_idx" ON "notifications"."notification_deliveries" USING btree ("created_at") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "delivery_failed_idx" ON "notifications"."notification_deliveries" USING btree ("created_at") WHERE status = 'failed';--> statement-breakpoint
CREATE INDEX "delivery_notification_idx" ON "notifications"."notification_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "notifications"."notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "notifications"."notifications" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE is_read = false;--> statement-breakpoint
CREATE INDEX "booking_resource_name_idx" ON "showcase"."range_booking" USING btree ("resource_name");--> statement-breakpoint
CREATE INDEX "booking_period_gist_idx" ON "showcase"."range_booking" USING gist ("booking_period");--> statement-breakpoint
CREATE INDEX "booking_reservation_gist_idx" ON "showcase"."range_booking" USING gist ("reservation_dates");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "auth"."session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "telegram_token_cleanup_idx" ON "notifications"."telegram_verification_tokens" USING btree ("expires_at") WHERE used_at IS NULL;--> statement-breakpoint
CREATE INDEX "temporal_valid_range_idx" ON "showcase"."temporal_record" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "specimen_label_idx" ON "showcase"."type_specimen" USING btree ("label");--> statement-breakpoint
CREATE INDEX "history_specimen_id_idx" ON "showcase"."type_specimen_history" USING btree ("specimen_id");--> statement-breakpoint
CREATE INDEX "history_specimen_version_idx" ON "showcase"."type_specimen_history" USING btree ("specimen_id","version");--> statement-breakpoint
CREATE INDEX "discord_user_idx" ON "notifications"."user_discord_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "discord_token_refresh_idx" ON "notifications"."user_discord_accounts" USING btree ("token_expires_at") WHERE is_active = true AND token_refresh_failed_at IS NULL;--> statement-breakpoint
CREATE INDEX "telegram_user_idx" ON "notifications"."user_telegram_accounts" USING btree ("user_id");