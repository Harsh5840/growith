-- AlterTable
ALTER TABLE "InvestorAuthUser"
ADD COLUMN     "walletTokenBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TokenPurchaseRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "requestedTokenCount" INTEGER NOT NULL,
    "totalAmountUsd" DECIMAL(12,3) NOT NULL,
    "paymentProofUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "adminNote" TEXT,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenPurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenPurchaseRequest_userId_createdAt_idx" ON "TokenPurchaseRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenPurchaseRequest_status_createdAt_idx" ON "TokenPurchaseRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TokenPurchaseRequest" ADD CONSTRAINT "TokenPurchaseRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InvestorAuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
