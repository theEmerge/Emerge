-- Feed reads filter posts by author + order by time, and count likes /
-- helpful marks / comments per post. Without these the database scans.
CREATE INDEX IF NOT EXISTS "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Like_postId_idx" ON "Like"("postId");
CREATE INDEX IF NOT EXISTS "HelpfulMark_postId_idx" ON "HelpfulMark"("postId");
CREATE INDEX IF NOT EXISTS "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");
