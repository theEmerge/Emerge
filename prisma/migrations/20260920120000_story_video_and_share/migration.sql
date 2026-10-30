-- Stories can now be a video (a reel shared to your story) instead of
-- only an image - imageUrl is no longer required, but exactly one of
-- imageUrl/videoUrl must be set (enforced in the API, not the DB).
ALTER TABLE "Story" ALTER COLUMN "imageUrl" DROP NOT NULL;
ALTER TABLE "Story" ADD COLUMN "videoUrl" TEXT;
