-- Remove the deprecated PMH-group → role mapping. Authorization is assigned
-- locally per user (user_role); groups never grant roles (supersedes AD-7).
DROP TABLE IF EXISTS "group_role_map";
