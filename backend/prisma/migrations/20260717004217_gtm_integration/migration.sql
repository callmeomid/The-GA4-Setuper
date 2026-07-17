-- AlterTable
ALTER TABLE "Funnel" ADD COLUMN "ga4ConfigTagName" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "ga4MeasurementId" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "gtmWorkspaceId" TEXT;

-- AlterTable
ALTER TABLE "FunnelStep" ADD COLUMN "ga4EventName" TEXT;
ALTER TABLE "FunnelStep" ADD COLUMN "gtmTagId" TEXT;
ALTER TABLE "FunnelStep" ADD COLUMN "gtmTriggerId" TEXT;

-- CreateTable
CREATE TABLE "GtmConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "gtmAccountId" TEXT,
    "gtmContainerId" TEXT,
    "gtmContainerPublicId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GtmConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GtmApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funnelId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestBody" TEXT,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GtmApiLog_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GtmConnection_userId_key" ON "GtmConnection"("userId");

-- CreateIndex
CREATE INDEX "GtmApiLog_funnelId_createdAt_idx" ON "GtmApiLog"("funnelId", "createdAt");
