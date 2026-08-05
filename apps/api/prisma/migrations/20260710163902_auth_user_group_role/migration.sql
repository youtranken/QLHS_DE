-- CreateTable
CREATE TABLE "user" (
    "sub" TEXT NOT NULL,
    "employee_code" TEXT,
    "email" TEXT,
    "full_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("sub")
);

-- CreateTable
CREATE TABLE "group_role_map" (
    "group_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "group_role_map_pkey" PRIMARY KEY ("group_id","role")
);
