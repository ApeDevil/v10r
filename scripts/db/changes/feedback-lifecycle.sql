-- Feedback lifecycle (Slice 1 of docs/blueprint/feedback/request-driven-development.md).
--
-- Hand-written because the status enum change is not additive: drizzle-kit's generated
-- form casts the old labels straight to the new type, and 'new'/'read'/'archived' do not
-- exist in it, so the cast fails on any populated table. This file maps the data instead:
--   new | read → received      archived → closed + close_reason 'archived'
-- `lifecycle-migration.pglite.test.ts` runs it against old-shape rows and checks the
-- result against the Drizzle schema.
--
-- ALREADY APPLIED TO PRODUCTION (2026-11-26, before the Slice 1 ship bea046c). DO NOT RUN IT
-- AGAIN: it renames and recreates the status enum and would fail or corrupt the mapping.
-- Kept, with its down file and regression test, until Slice 2 and the first real
-- feedback-driven development task are verified; then the temporary artifacts are consolidated.

BEGIN;

CREATE TYPE "feedback"."feedback_category" AS ENUM('feature', 'bug', 'improvement', 'general');
CREATE TYPE "feedback"."feedback_close_reason" AS ENUM('rejected', 'duplicate', 'archived');

ALTER TYPE "feedback"."feedback_status" RENAME TO "feedback_status_retired";
CREATE TYPE "feedback"."feedback_status" AS ENUM('received', 'deferred', 'accepted', 'in_development', 'ready_for_review', 'release_approved', 'released', 'closed');

ALTER TABLE "feedback"."feedback" ADD COLUMN "close_reason" "feedback"."feedback_close_reason";
UPDATE "feedback"."feedback" SET "close_reason" = 'archived' WHERE "status"::text = 'archived';

ALTER TABLE "feedback"."feedback" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "feedback"."feedback" ALTER COLUMN "status" SET DATA TYPE "feedback"."feedback_status"
	USING (CASE "status"::text WHEN 'archived' THEN 'closed' ELSE 'received' END)::"feedback"."feedback_status";
ALTER TABLE "feedback"."feedback" ALTER COLUMN "status" SET DEFAULT 'received';
DROP TYPE "feedback"."feedback_status_retired";

ALTER TABLE "feedback"."feedback" ADD COLUMN "category" "feedback"."feedback_category" DEFAULT 'general' NOT NULL;
ALTER TABLE "feedback"."feedback" ADD COLUMN "user_id" text;
ALTER TABLE "feedback"."feedback" ADD COLUMN "route_id" text;
ALTER TABLE "feedback"."feedback" ADD COLUMN "app_version" text;
ALTER TABLE "feedback"."feedback" ADD COLUMN "error_id" text;
ALTER TABLE "feedback"."feedback" ADD COLUMN "duplicate_of" text;
ALTER TABLE "feedback"."feedback" ADD COLUMN "triage_note" text;
ALTER TABLE "feedback"."feedback" ADD COLUMN "status_changed_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "feedback"."feedback" ADD COLUMN "erased_at" timestamp with time zone;

ALTER TABLE "feedback"."feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "feedback"."feedback" ADD CONSTRAINT "feedback_duplicate_of_feedback_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "feedback"."feedback"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "feedback_user_submitted_idx" ON "feedback"."feedback" USING btree ("user_id","submitted_at");
CREATE INDEX "feedback_duplicate_of_idx" ON "feedback"."feedback" USING btree ("duplicate_of");
CREATE UNIQUE INDEX "feedback_one_active_development_idx" ON "feedback"."feedback" USING btree ((true)) WHERE "feedback"."feedback"."status" IN ('in_development', 'ready_for_review', 'release_approved');
ALTER TABLE "feedback"."feedback" ADD CONSTRAINT "feedback_route_len" CHECK (char_length("feedback"."feedback"."route_id") <= 200);
ALTER TABLE "feedback"."feedback" ADD CONSTRAINT "feedback_version_len" CHECK (char_length("feedback"."feedback"."app_version") <= 64);
ALTER TABLE "feedback"."feedback" ADD CONSTRAINT "feedback_error_id_shape" CHECK ("feedback"."feedback"."error_id" ~ '^[A-Za-z0-9_-]{1,64}$');
ALTER TABLE "feedback"."feedback" ADD CONSTRAINT "feedback_note_len" CHECK (char_length("feedback"."feedback"."triage_note") <= 2000);
ALTER TABLE "feedback"."feedback" ADD CONSTRAINT "feedback_close_reason_iff_closed" CHECK (("feedback"."feedback"."status" = 'closed') = ("feedback"."feedback"."close_reason" IS NOT NULL));
ALTER TABLE "feedback"."feedback" ADD CONSTRAINT "feedback_duplicate_target_reason" CHECK ("feedback"."feedback"."duplicate_of" IS NULL OR "feedback"."feedback"."close_reason" = 'duplicate');
ALTER TABLE "feedback"."feedback" ADD CONSTRAINT "feedback_not_own_duplicate" CHECK ("feedback"."feedback"."duplicate_of" IS NULL OR "feedback"."feedback"."duplicate_of" <> "feedback"."feedback"."id");

COMMIT;
