-- Reverses feedback-lifecycle.sql: puts feedback.feedback back in the shape the application
-- before Slice 1 expects. Only for the case the migration was applied and the new application
-- cannot be deployed and fixing forward is not an option (§R.4 of
-- docs/blueprint/feedback/request-driven-development.md). Lossy by design: categories,
-- account links, technical context beyond the page, duplicate links, notes and close reasons
-- are dropped. Every row survives; statuses map back:
--   received → new      closed + archived → archived      every other state → read
-- Rows that were shelled by an account erasure (no subject) keep their empty text.

BEGIN;

ALTER TABLE "feedback"."feedback" DROP CONSTRAINT IF EXISTS "feedback_route_len";
ALTER TABLE "feedback"."feedback" DROP CONSTRAINT IF EXISTS "feedback_version_len";
ALTER TABLE "feedback"."feedback" DROP CONSTRAINT IF EXISTS "feedback_error_id_shape";
ALTER TABLE "feedback"."feedback" DROP CONSTRAINT IF EXISTS "feedback_note_len";
ALTER TABLE "feedback"."feedback" DROP CONSTRAINT IF EXISTS "feedback_close_reason_iff_closed";
ALTER TABLE "feedback"."feedback" DROP CONSTRAINT IF EXISTS "feedback_duplicate_target_reason";
ALTER TABLE "feedback"."feedback" DROP CONSTRAINT IF EXISTS "feedback_not_own_duplicate";
DROP INDEX IF EXISTS "feedback"."feedback_one_active_development_idx";
DROP INDEX IF EXISTS "feedback"."feedback_duplicate_of_idx";
DROP INDEX IF EXISTS "feedback"."feedback_user_submitted_idx";

ALTER TYPE "feedback"."feedback_status" RENAME TO "feedback_status_lifecycle";
CREATE TYPE "feedback"."feedback_status" AS ENUM('new', 'read', 'archived');
ALTER TABLE "feedback"."feedback" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "feedback"."feedback" ALTER COLUMN "status" SET DATA TYPE "feedback"."feedback_status"
	USING (CASE
		WHEN "status"::text = 'received' THEN 'new'
		WHEN "status"::text = 'closed' AND "close_reason"::text = 'archived' THEN 'archived'
		ELSE 'read'
	END)::"feedback"."feedback_status";
ALTER TABLE "feedback"."feedback" ALTER COLUMN "status" SET DEFAULT 'new';
DROP TYPE "feedback"."feedback_status_lifecycle";

ALTER TABLE "feedback"."feedback"
	DROP COLUMN "category",
	DROP COLUMN "user_id",
	DROP COLUMN "route_id",
	DROP COLUMN "app_version",
	DROP COLUMN "error_id",
	DROP COLUMN "close_reason",
	DROP COLUMN "duplicate_of",
	DROP COLUMN "triage_note",
	DROP COLUMN "status_changed_at",
	DROP COLUMN "erased_at";
DROP TYPE "feedback"."feedback_category";
DROP TYPE "feedback"."feedback_close_reason";

COMMIT;
