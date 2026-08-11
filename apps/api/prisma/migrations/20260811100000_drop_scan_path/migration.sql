-- DCC2 no longer records a scan path when completing a Contract (it scans out of
-- band; completing just closes the file + emails the Applicant). Drop the now
-- write-nothing column. Historical values are discarded — none are read anywhere.
ALTER TABLE "ticket" DROP COLUMN IF EXISTS "scan_path";
