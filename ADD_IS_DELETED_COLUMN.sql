-- SQL Query to Add is_deleted Column to employees_cache Table
-- ============================================================
-- Run this SQL query in your PostgreSQL database
-- 
-- Replace 'lad_dev' with your actual schema name
-- For multi-tenant: Replace 'lad_dev' with your tenant schema (e.g., 'tenant_12345678_87654321')
-- ============================================================

-- Add is_deleted column with default value of false
ALTER TABLE lad_dev.employees_cache 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;

-- Update any existing NULL values to false (safety check)
UPDATE lad_dev.employees_cache 
SET is_deleted = false 
WHERE is_deleted IS NULL;

-- Create index on is_deleted for faster queries (only indexes active records)
CREATE INDEX IF NOT EXISTS idx_employees_cache_is_deleted 
ON lad_dev.employees_cache(is_deleted) 
WHERE is_deleted = false;

-- Optional: Add comment for documentation
COMMENT ON COLUMN lad_dev.employees_cache.is_deleted IS 'Soft delete flag - true if deleted, false if active';

-- ============================================================
-- For Multi-Tenant Setup:
-- ============================================================
-- If you have tenant-specific schemas, run this for each schema:
-- 
-- ALTER TABLE tenant_<tenant_id>.employees_cache 
-- ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;
--
-- UPDATE tenant_<tenant_id>.employees_cache 
-- SET is_deleted = false 
-- WHERE is_deleted IS NULL;
--
-- CREATE INDEX IF NOT EXISTS idx_employees_cache_is_deleted 
-- ON tenant_<tenant_id>.employees_cache(is_deleted) 
-- WHERE is_deleted = false;

