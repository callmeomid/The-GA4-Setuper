/*
  Warnings:

  - You are about to drop the `GtmApiLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GtmApiLog";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "IntegrationApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'gtm',
    "funnelId" TEXT,
    "userId" TEXT,
    "runId" TEXT,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestBody" TEXT,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationApiLog_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "stepsTotal" INTEGER NOT NULL,
    "stepsOk" INTEGER NOT NULL,
    "stepsError" INTEGER NOT NULL,
    "errorSummary" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "PushAttempt_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IntegrationApiLog_funnelId_createdAt_idx" ON "IntegrationApiLog"("funnelId", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationApiLog_runId_idx" ON "IntegrationApiLog"("runId");

-- CreateIndex
CREATE INDEX "IntegrationApiLog_provider_createdAt_idx" ON "IntegrationApiLog"("provider", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushAttempt_runId_key" ON "PushAttempt"("runId");

-- CreateIndex
CREATE INDEX "PushAttempt_funnelId_startedAt_idx" ON "PushAttempt"("funnelId", "startedAt");

-- CreateIndex
CREATE INDEX "PushAttempt_outcome_startedAt_idx" ON "PushAttempt"("outcome", "startedAt");
