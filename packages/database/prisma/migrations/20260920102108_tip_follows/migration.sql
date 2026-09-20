-- CreateTable
CREATE TABLE "public"."tip_follows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipId" TEXT NOT NULL,
    "stake" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tip_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tip_follows_userId_createdAt_idx" ON "public"."tip_follows"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tip_follows_userId_tipId_key" ON "public"."tip_follows"("userId", "tipId");

-- AddForeignKey
ALTER TABLE "public"."tip_follows" ADD CONSTRAINT "tip_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tip_follows" ADD CONSTRAINT "tip_follows_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "public"."tips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
