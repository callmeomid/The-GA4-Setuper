-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Funnel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "gtmWorkspaceId" TEXT,
    "ga4MeasurementId" TEXT,
    "ga4ConfigTagName" TEXT,
    "setupMode" TEXT,
    "stapeContainerId" TEXT,
    "stapeSubdomain" TEXT,
    "stapeContainerUrl" TEXT,
    "stapeContainerStatus" TEXT NOT NULL DEFAULT 'pending',
    "stapeCookieName" TEXT,
    CONSTRAINT "Funnel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Funnel" ("createdAt", "ga4ConfigTagName", "ga4MeasurementId", "gtmWorkspaceId", "id", "name", "ownerId", "status", "updatedAt") SELECT "createdAt", "ga4ConfigTagName", "ga4MeasurementId", "gtmWorkspaceId", "id", "name", "ownerId", "status", "updatedAt" FROM "Funnel";
DROP TABLE "Funnel";
ALTER TABLE "new_Funnel" RENAME TO "Funnel";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
