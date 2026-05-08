-- Make email optional and add unique constraint on name
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");
