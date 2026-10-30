-- Separate notifications and messages per hub.
ALTER TABLE "Notification" ADD COLUMN "hub" TEXT NOT NULL DEFAULT 'social';
ALTER TABLE "Conversation" ADD COLUMN "hub" TEXT NOT NULL DEFAULT 'social';

-- Existing hub-specific notifications go to their own hub.
UPDATE "Notification" SET "hub" = 'connection' WHERE "type" IN ('CONNECTION_REQUEST', 'CONNECTION_ACCEPTED', 'JOB_APPLICATION');
UPDATE "Notification" SET "hub" = 'developer' WHERE "type" IN ('PULL_REQUEST', 'ISSUE');

CREATE INDEX "Notification_recipientId_hub_createdAt_idx" ON "Notification"("recipientId", "hub", "createdAt");
CREATE INDEX "Conversation_hub_idx" ON "Conversation"("hub");
