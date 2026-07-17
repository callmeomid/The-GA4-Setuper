-- AlterTable
ALTER TABLE "Funnel" ADD COLUMN "stapeSubdomain" TEXT;

-- AlterTable
ALTER TABLE "FunnelStep" ADD COLUMN "validatedAt" DATETIME;

-- CreateTable
CREATE TABLE "Ga4Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "ga4PropertyId" TEXT,
    "ga4PropertyName" TEXT,
    "ga4MeasurementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ga4Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Ga4Connection_userId_key" ON "Ga4Connection"("userId");
