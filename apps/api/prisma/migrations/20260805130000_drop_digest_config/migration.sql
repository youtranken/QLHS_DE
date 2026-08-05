-- Digest send time is fixed at 09:00 (Vietnam) in code — the runtime config table
-- and its admin UI were dropped. Reverts 20260805120000_digest_config.
DROP TABLE IF EXISTS "digest_config";
