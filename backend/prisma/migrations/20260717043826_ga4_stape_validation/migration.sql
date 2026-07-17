/*
  Warnings:

  - You are about to drop the `GtmApiLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Funnel" ADD COLUMN "ga4PropertyId" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "stapeContainerIdentifier" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "stapeSpansSubdomains" BOOLEAN;

-- AlterTable
ALTER TABLE "FunnelStep" ADD COLUMN "ga4ConversionEventResourceName" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GtmApiLog";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Ga4Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "ga4PropertyId" TEXT,
    "ga4PropertyDisplayName" TEXT,
    "ga4MeasurementId" TEXT,
    "ga4DataStreamName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ga4Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StapeConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'global',
    "containerIdentifier" TEXT,
    "containerName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StapeConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "system" TEXT NOT NULL DEFAULT 'gtm',
    "funnelId" TEXT,
    "userId" TEXT,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestBody" TEXT,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiLog_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funnelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "resultsJson" TEXT NOT NULL,
    "overallPass" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationRun_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Ga4Connection_userId_key" ON "Ga4Connection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StapeConnection_userId_key" ON "StapeConnection"("userId");

-- CreateIndex
CREATE INDEX "ApiLog_funnelId_createdAt_idx" ON "ApiLog"("funnelId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiLog_funnelId_system_createdAt_idx" ON "ApiLog"("funnelId", "system", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationRun_funnelId_createdAt_idx" ON "ValidationRun"("funnelId", "createdAt");
