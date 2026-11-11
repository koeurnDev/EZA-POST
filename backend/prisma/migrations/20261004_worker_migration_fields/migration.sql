-- Additive fields used by the Worker-native password reset and post processor.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "resetPasswordToken" TEXT,
  ADD COLUMN IF NOT EXISTS "resetPasswordExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_resetPasswordToken_key"
  ON "users"("resetPasswordToken");

ALTER TABLE "scheduled_posts"
  ADD COLUMN IF NOT EXISTS "lastError" JSONB;

ALTER TABLE "scheduled_posts"
  ADD COLUMN IF NOT EXISTS "carouselCards" JSONB;
