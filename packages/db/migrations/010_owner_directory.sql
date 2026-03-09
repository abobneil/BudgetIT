CREATE TABLE IF NOT EXISTS owner_directory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_directory_normalized_name
ON owner_directory (normalized_name);

ALTER TABLE vendor ADD COLUMN owner_id TEXT;
ALTER TABLE service ADD COLUMN owner_id TEXT;
ALTER TABLE contract ADD COLUMN owner_id TEXT;

INSERT INTO owner_directory (
  id,
  name,
  normalized_name
)
SELECT
  lower(hex(randomblob(16))),
  MIN(owner_name),
  normalized_name
FROM (
  SELECT TRIM(owner) AS owner_name, lower(trim(owner)) AS normalized_name
  FROM vendor
  WHERE owner IS NOT NULL AND trim(owner) <> ''
  UNION ALL
  SELECT TRIM(owner_team) AS owner_name, lower(trim(owner_team)) AS normalized_name
  FROM service
  WHERE owner_team IS NOT NULL AND trim(owner_team) <> ''
  UNION ALL
  SELECT TRIM(owner) AS owner_name, lower(trim(owner)) AS normalized_name
  FROM contract
  WHERE owner IS NOT NULL AND trim(owner) <> ''
)
GROUP BY normalized_name;

UPDATE vendor
SET owner_id = (
  SELECT id
  FROM owner_directory
  WHERE normalized_name = lower(trim(vendor.owner))
)
WHERE owner IS NOT NULL AND trim(owner) <> '';

UPDATE service
SET owner_id = (
  SELECT id
  FROM owner_directory
  WHERE normalized_name = lower(trim(service.owner_team))
)
WHERE owner_team IS NOT NULL AND trim(owner_team) <> '';

UPDATE contract
SET owner_id = (
  SELECT id
  FROM owner_directory
  WHERE normalized_name = lower(trim(contract.owner))
)
WHERE owner IS NOT NULL AND trim(owner) <> '';

CREATE INDEX IF NOT EXISTS idx_vendor_owner_id
ON vendor (owner_id);

CREATE INDEX IF NOT EXISTS idx_service_owner_id
ON service (owner_id);

CREATE INDEX IF NOT EXISTS idx_contract_owner_id
ON contract (owner_id);

UPDATE meta
SET schema_version = 10,
    updated_at = CURRENT_TIMESTAMP;
