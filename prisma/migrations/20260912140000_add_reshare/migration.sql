-- CreateTable
CREATE TABLE "Reshare" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "resharedById" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reshare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reshare_postId_resharedById_key" ON "Reshare"("postId", "resharedById");

-- CreateIndex
CREATE INDEX "Reshare_resharedById_createdAt_idx" ON "Reshare"("resharedById", "createdAt");

-- AddForeignKey
ALTER TABLE "Reshare" ADD CONSTRAINT "Reshare_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reshare" ADD CONSTRAINT "Reshare_resharedById_fkey" FOREIGN KEY ("resharedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
