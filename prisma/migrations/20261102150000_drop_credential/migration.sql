-- The old shared company login is cancelled (each partner now signs in with
-- their own email + password on "User"). Approved for deletion 2026-11-02.
-- IF EXISTS: harmless on a database where it's already gone.

-- DropTable
DROP TABLE IF EXISTS "Credential";
