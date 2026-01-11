DELETE FROM "UserRole" a
USING "UserRole" b
WHERE a."userId" = b."userId"
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX "UserRole_userId_key" ON "UserRole"("userId");
