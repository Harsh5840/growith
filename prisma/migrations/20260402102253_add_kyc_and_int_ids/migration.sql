/*
  Warnings:

  - The primary key for the `InvestorAuthUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `InvestorAuthUser` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "InvestorAuthUser" DROP CONSTRAINT "InvestorAuthUser_pkey",
ADD COLUMN     "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "InvestorAuthUser_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "forgotPasswordCode" TEXT,
    "forgotPasswordExpires" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorKyc" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fullLegalName" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "countryOfResidence" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stateProvince" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "primaryDocumentType" TEXT NOT NULL,
    "primaryDocFrontUrl" TEXT NOT NULL,
    "primaryDocBackUrl" TEXT,
    "supportingDocName" TEXT,
    "supportingDocUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorKyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorKyc_userId_key" ON "InvestorKyc"("userId");

-- AddForeignKey
ALTER TABLE "InvestorKyc" ADD CONSTRAINT "InvestorKyc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "InvestorAuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
