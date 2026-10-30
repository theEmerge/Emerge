-- Carousel posts
CREATE TABLE "PostImage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PostImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PostImage_postId_position_idx" ON "PostImage"("postId", "position");
ALTER TABLE "PostImage" ADD CONSTRAINT "PostImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Positional photo tags (pins dropped on a photo, Instagram-style)
ALTER TABLE "PostTag" ADD COLUMN "x" DOUBLE PRECISION;
ALTER TABLE "PostTag" ADD COLUMN "y" DOUBLE PRECISION;
ALTER TABLE "PostTag" ADD COLUMN "imageIndex" INTEGER NOT NULL DEFAULT 0;

-- Saved / bookmarks
CREATE TABLE "Saved" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Saved_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Saved_userId_postId_key" ON "Saved"("userId", "postId");
CREATE INDEX "Saved_userId_createdAt_idx" ON "Saved"("userId", "createdAt");
ALTER TABLE "Saved" ADD CONSTRAINT "Saved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Saved" ADD CONSTRAINT "Saved_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Close friends
CREATE TABLE "CloseFriend" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloseFriend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CloseFriend_ownerId_friendId_key" ON "CloseFriend"("ownerId", "friendId");
CREATE INDEX "CloseFriend_ownerId_idx" ON "CloseFriend"("ownerId");
CREATE INDEX "CloseFriend_friendId_idx" ON "CloseFriend"("friendId");
ALTER TABLE "CloseFriend" ADD CONSTRAINT "CloseFriend_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CloseFriend" ADD CONSTRAINT "CloseFriend_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Story audience (everyone vs close friends only)
CREATE TYPE "StoryAudience" AS ENUM ('EVERYONE', 'CLOSE_FRIENDS');
ALTER TABLE "Story" ADD COLUMN "audience" "StoryAudience" NOT NULL DEFAULT 'EVERYONE';
