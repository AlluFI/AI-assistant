-- CreateTable
CREATE TABLE "AssistantUserMemory" (
    "userId" TEXT NOT NULL,
    "narrative" TEXT,
    "facts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantUserMemory_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "AssistantUserMemory" ADD CONSTRAINT "AssistantUserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
