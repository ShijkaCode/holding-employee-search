-- Create org_hierarchy view for hierarchical org unit paths
-- This view builds the full path for each org unit (e.g., "Division > Department > Team")

CREATE OR REPLACE VIEW org_hierarchy AS
WITH RECURSIVE org_tree AS (
  -- Base case: root level org units (no parent)
  SELECT
    id,
    company_id,
    name,
    parent_id,
    level_type,
    sort_order,
    0 AS level_depth,
    name AS path_names,
    ARRAY[id] AS path_ids
  FROM org_units
  WHERE parent_id IS NULL

  UNION ALL

  -- Recursive case: child org units
  SELECT
    o.id,
    o.company_id,
    o.name,
    o.parent_id,
    o.level_type,
    o.sort_order,
    ot.level_depth + 1,
    ot.path_names || ' > ' || o.name AS path_names,
    ot.path_ids || o.id AS path_ids
  FROM org_units o
  INNER JOIN org_tree ot ON o.parent_id = ot.id
)
SELECT
  id,
  company_id,
  name,
  parent_id,
  level_type,
  sort_order,
  level_depth,
  path_names,
  path_ids
FROM org_tree
ORDER BY company_id, path_names;

-- Grant access to authenticated users
GRANT SELECT ON org_hierarchy TO authenticated;

-- Add comment
COMMENT ON VIEW org_hierarchy IS 'Recursive view that builds hierarchical paths for org units';
