-- CreateTable
CREATE TABLE "user_role" (
    "sub" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("sub","role")
);
