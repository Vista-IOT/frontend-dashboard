-- CreateTable
CREATE TABLE "VirtualMemoryMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "destinationId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "value" TEXT,
    "buffer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VirtualMemoryMap_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
