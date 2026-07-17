-- AlterTable
ALTER TABLE "Funnel" ADD COLUMN "allowedDomainsJson" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "bigQueryDatasetId" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "bigQueryProjectId" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "domainTopology" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "rootDomain" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "stapeContainerDomain" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "stapeContainerId" TEXT;
ALTER TABLE "Funnel" ADD COLUMN "validationMethod" TEXT;

-- CreateTable
CREATE TABLE "Ga4Connection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "ga4AccountId" TEXT,
    "ga4PropertyId" TEXT,
    "ga4PropertyDisplayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ga4Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StapeConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StapeConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "system" TEXT NOT NULL,
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
    CONSTRAINT "IntegrationApiLog_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "funnelId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidationRun_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValidationStepResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "validationId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'pending',
    "detail" TEXT,
    "mpValidationMessages" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" DATETIME,
    CONSTRAINT "ValidationStepResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ValidationRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Ga4Connection_userId_key" ON "Ga4Connection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StapeConnection_userId_key" ON "StapeConnection"("userId");

-- CreateIndex
CREATE INDEX "IntegrationApiLog_funnelId_system_createdAt_idx" ON "IntegrationApiLog"("funnelId", "system", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationRun_funnelId_createdAt_idx" ON "ValidationRun"("funnelId", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationStepResult_runId_idx" ON "ValidationStepResult"("runId");
