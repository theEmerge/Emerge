-- Remove exact GPS from posts (privacy). Wipe the data first, then drop the columns.
UPDATE "Post" SET "latitude" = NULL, "longitude" = NULL;
ALTER TABLE "Post" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "Post" DROP COLUMN IF EXISTS "longitude";
