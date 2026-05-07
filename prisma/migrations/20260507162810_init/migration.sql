-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "season" INTEGER NOT NULL DEFAULT 2025,
    "maxDriverPicks" INTEGER NOT NULL DEFAULT 2,
    "maxConstructorPicks" INTEGER NOT NULL DEFAULT 3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "permanentNumber" TEXT,
    "nationality" TEXT
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nationality" TEXT
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "season" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "circuitName" TEXT,
    "locality" TEXT,
    "country" TEXT,
    "date" DATETIME NOT NULL,
    "pickDeadline" DATETIME NOT NULL,
    "resultsLocked" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "driverId" TEXT,
    "teamId" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pick_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pick_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RaceResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "raceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "positionText" TEXT,
    "points" REAL NOT NULL,
    "status" TEXT,
    CONSTRAINT "RaceResult_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "driverPoints" REAL NOT NULL DEFAULT 0,
    "constructorPoints" REAL NOT NULL DEFAULT 0,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Score_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Race_season_round_key" ON "Race"("season", "round");

-- CreateIndex
CREATE UNIQUE INDEX "Pick_userId_raceId_key" ON "Pick"("userId", "raceId");

-- CreateIndex
CREATE UNIQUE INDEX "RaceResult_raceId_driverId_key" ON "RaceResult"("raceId", "driverId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_userId_raceId_key" ON "Score"("userId", "raceId");
