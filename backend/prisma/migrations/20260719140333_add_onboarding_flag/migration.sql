-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "apiKey" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "planStatus" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" DATETIME,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "hasSeenOnboarding" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("apiKey", "currentPeriodEnd", "email", "emailVerified", "id", "image", "isAdmin", "name", "plan", "planStatus", "stripeCustomerId", "stripeSubscriptionId") SELECT "apiKey", "currentPeriodEnd", "email", "emailVerified", "id", "image", "isAdmin", "name", "plan", "planStatus", "stripeCustomerId", "stripeSubscriptionId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
