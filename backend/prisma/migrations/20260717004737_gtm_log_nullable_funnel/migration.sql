-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GtmApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "GtmApiLog_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GtmApiLog" ("createdAt", "durationMs", "endpoint", "errorMessage", "funnelId", "id", "method", "requestBody", "responseBody", "responseStatus") SELECT "createdAt", "durationMs", "endpoint", "errorMessage", "funnelId", "id", "method", "requestBody", "responseBody", "responseStatus" FROM "GtmApiLog";
DROP TABLE "GtmApiLog";
ALTER TABLE "new_GtmApiLog" RENAME TO "GtmApiLog";
CREATE INDEX "GtmApiLog_funnelId_createdAt_idx" ON "GtmApiLog"("funnelId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
