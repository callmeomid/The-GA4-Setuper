/*
  Warnings:

  - You are about to drop the column `accessToken` on the `GtmConnection` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `GtmConnection` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `GtmConnection` table. All the data in the column will be lost.
  - Added the required column `workspaceId` to the `Funnel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refreshTokenEnc` to the `GtmConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `GtmConnection` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "wrappedDek" TEXT NOT NULL,
    "dekKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Funnel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "gtmWorkspaceId" TEXT,
    "ga4MeasurementId" TEXT,
    "ga4ConfigTagName" TEXT,
    CONSTRAINT "Funnel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Funnel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Funnel" ("createdAt", "ga4ConfigTagName", "ga4MeasurementId", "gtmWorkspaceId", "id", "name", "ownerId", "status", "updatedAt") SELECT "createdAt", "ga4ConfigTagName", "ga4MeasurementId", "gtmWorkspaceId", "id", "name", "ownerId", "status", "updatedAt" FROM "Funnel";
DROP TABLE "Funnel";
ALTER TABLE "new_Funnel" RENAME TO "Funnel";
CREATE TABLE "new_GtmConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "gtmAccountId" TEXT,
    "gtmContainerId" TEXT,
    "gtmContainerPublicId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GtmConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GtmConnection" ("accessTokenExpiresAt", "createdAt", "gtmAccountId", "gtmContainerId", "gtmContainerPublicId", "id", "updatedAt") SELECT "accessTokenExpiresAt", "createdAt", "gtmAccountId", "gtmContainerId", "gtmContainerPublicId", "id", "updatedAt" FROM "GtmConnection";
DROP TABLE "GtmConnection";
ALTER TABLE "new_GtmConnection" RENAME TO "GtmConnection";
CREATE UNIQUE INDEX "GtmConnection_workspaceId_key" ON "GtmConnection"("workspaceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
