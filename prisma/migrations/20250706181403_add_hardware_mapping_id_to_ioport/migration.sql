-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IOPort" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scanTime" INTEGER,
    "timeOut" INTEGER,
    "retryCount" INTEGER,
    "autoRecoverTime" INTEGER,
    "scanMode" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "serialSettings" TEXT,
    "hardwareInterface" TEXT,
    "hardwareMappingId" TEXT,
    CONSTRAINT "IOPort_hardwareMappingId_fkey" FOREIGN KEY ("hardwareMappingId") REFERENCES "HardwareMapping" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_IOPort" ("autoRecoverTime", "description", "enabled", "hardwareInterface", "id", "name", "retryCount", "scanMode", "scanTime", "serialSettings", "timeOut", "type") SELECT "autoRecoverTime", "description", "enabled", "hardwareInterface", "id", "name", "retryCount", "scanMode", "scanTime", "serialSettings", "timeOut", "type" FROM "IOPort";
DROP TABLE "IOPort";
ALTER TABLE "new_IOPort" RENAME TO "IOPort";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
