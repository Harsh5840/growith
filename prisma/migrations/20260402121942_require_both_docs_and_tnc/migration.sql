/*
  Warnings:

  - You are about to drop the column `primaryDocBackUrl` on the `InvestorKyc` table. All the data in the column will be lost.
  - You are about to drop the column `primaryDocFrontUrl` on the `InvestorKyc` table. All the data in the column will be lost.
  - You are about to drop the column `primaryDocumentType` on the `InvestorKyc` table. All the data in the column will be lost.
  - Added the required column `aadhaarBackUrl` to the `InvestorKyc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `aadhaarFrontUrl` to the `InvestorKyc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `aadhaarNumber` to the `InvestorKyc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `panFrontUrl` to the `InvestorKyc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `panNumber` to the `InvestorKyc` table without a default value. This is not possible if the table is not empty.
  - Added the required column `termsAgreedAt` to the `InvestorKyc` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InvestorKyc" DROP COLUMN "primaryDocBackUrl",
DROP COLUMN "primaryDocFrontUrl",
DROP COLUMN "primaryDocumentType",
ADD COLUMN     "aadhaarBackUrl" TEXT NOT NULL,
ADD COLUMN     "aadhaarFrontUrl" TEXT NOT NULL,
ADD COLUMN     "aadhaarNumber" TEXT NOT NULL,
ADD COLUMN     "panFrontUrl" TEXT NOT NULL,
ADD COLUMN     "panNumber" TEXT NOT NULL,
ADD COLUMN     "termsAgreedAt" TIMESTAMP(3) NOT NULL;
