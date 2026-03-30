/*
  Warnings:

  - You are about to drop the column `isOnboarded` on the `InvestorAuthUser` table. All the data in the column will be lost.
  - You are about to drop the column `onboardingStatus` on the `InvestorAuthUser` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InvestorAuthUser" DROP COLUMN "isOnboarded",
DROP COLUMN "onboardingStatus",
ADD COLUMN     "emailVerificationCode" TEXT,
ADD COLUMN     "emailVerificationExpires" TIMESTAMP(3),
ADD COLUMN     "forgotPasswordCode" TEXT,
ADD COLUMN     "forgotPasswordExpires" TIMESTAMP(3);
