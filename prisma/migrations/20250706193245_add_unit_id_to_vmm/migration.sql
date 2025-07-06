/*
  Warnings:

  - Added the required column `unitId` to the `VirtualMemoryMap` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VirtualMemoryMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "destinationId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "value" TEXT,
    "buffer" TEXT,
    "unitId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VirtualMemoryMap_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VirtualMemoryMap" ("address", "buffer", "createdAt", "dataType", "destinationId", "id", "updatedAt", "value") SELECT "address", "buffer", "createdAt", "dataType", "destinationId", "id", "updatedAt", "value" FROM "VirtualMemoryMap";
DROP TABLE "VirtualMemoryMap";
ALTER TABLE "new_VirtualMemoryMap" RENAME TO "VirtualMemoryMap";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
