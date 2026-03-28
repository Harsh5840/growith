-- CreateTable
CREATE TABLE "InvestorAuthUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "profilePicture" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'pending',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorAuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestorAuthUser_email_key" ON "InvestorAuthUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorAuthUser_googleId_key" ON "InvestorAuthUser"("googleId");
