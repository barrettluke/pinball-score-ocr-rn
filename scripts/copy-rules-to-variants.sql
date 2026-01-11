-- CLEANUP: Remove incorrectly copied rules and re-copy correctly
-- This ensures only machines with matching year, manufacturer, AND base name share rules

-- Step 1: Delete ALL rules except the original 129 that were AI-generated
-- We identify originals by checking if their exact name matches what the script generated for
-- The safest way: delete rules where the machine wasn't in the original generation list

-- First, let's see what we have
SELECT 'Before cleanup - total rules:' as status, COUNT(*) as count FROM machine_rules;

-- Step 2: Create temp table of the original generated machines (ones where opdb_id matches exactly)
-- We'll keep only rules where the machine name doesn't contain variant suffixes 
-- OR is one of the first machines generated per base name/manufacturer/year combo
CREATE TEMP TABLE rules_to_keep AS
WITH base_info AS (
    SELECT 
        mr.opdb_id,
        m.name,
        m.manufacturer_name,
        m.year,
        regexp_replace(
            m.name,
            '\s*\((Pro|LE|Limited Edition|Premium|Standard|Standard Model|Vault Edition|LUCI|LUCI Vault Edition|Back In Black LE|Catwoman Signature Edition|Remake|Remake LE|SE|CE)\)$',
            '',
            'gi'
        ) as base_name,
        ROW_NUMBER() OVER (
            PARTITION BY 
                m.manufacturer_name,
                m.year,
                regexp_replace(
                    m.name,
                    '\s*\((Pro|LE|Limited Edition|Premium|Standard|Standard Model|Vault Edition|LUCI|LUCI Vault Edition|Back In Black LE|Catwoman Signature Edition|Remake|Remake LE|SE|CE)\)$',
                    '',
                    'gi'
                )
            ORDER BY mr.created_at ASC
        ) as rn
    FROM machine_rules mr
    JOIN opdb_machines m ON m.opdb_id = mr.opdb_id
)
SELECT opdb_id FROM base_info WHERE rn = 1;

-- Step 3: Delete rules that weren't in the original generation (duplicates added by variant copy)
DELETE FROM machine_rules 
WHERE opdb_id NOT IN (SELECT opdb_id FROM rules_to_keep);

SELECT 'After cleanup - total rules:' as status, COUNT(*) as count FROM machine_rules;

-- Step 4: Now re-copy to variants correctly (matching manufacturer AND year)
CREATE TEMP TABLE base_name_mapping AS
SELECT 
    m.opdb_id,
    m.name,
    m.manufacturer_name,
    m.year,
    regexp_replace(
        m.name,
        '\s*\((Pro|LE|Limited Edition|Premium|Standard|Standard Model|Vault Edition|LUCI|LUCI Vault Edition|Back In Black LE|Catwoman Signature Edition|Remake|Remake LE|SE|CE)\)$',
        '',
        'gi'
    ) as base_name
FROM opdb_machines m;

INSERT INTO machine_rules (opdb_id, summary, key_shots, modes, scoring_tips, created_at, updated_at)
SELECT 
    variants.opdb_id,
    source.summary,
    source.key_shots,
    source.modes,
    source.scoring_tips,
    now(),
    now()
FROM base_name_mapping variants
INNER JOIN base_name_mapping source_map ON (
    source_map.base_name = variants.base_name 
    AND source_map.manufacturer_name = variants.manufacturer_name
    AND source_map.year = variants.year
    AND source_map.opdb_id != variants.opdb_id
)
INNER JOIN machine_rules source ON source.opdb_id = source_map.opdb_id
WHERE NOT EXISTS (
    SELECT 1 FROM machine_rules mr WHERE mr.opdb_id = variants.opdb_id
)
ON CONFLICT (opdb_id) DO NOTHING;

SELECT 'After re-copy - total rules:' as status, COUNT(*) as count FROM machine_rules;

-- Step 5: Verify Godzilla - Sega (1998) should have NO rules, Stern (2021) should have rules
SELECT 
    m.name,
    m.manufacturer_name,
    m.year,
    CASE WHEN mr.opdb_id IS NOT NULL THEN '✓ has rules' ELSE '✗ no rules' END as status
FROM opdb_machines m
LEFT JOIN machine_rules mr ON m.opdb_id = mr.opdb_id
WHERE m.name ILIKE '%godzilla%'
ORDER BY m.year, m.name;

-- Cleanup temp tables
DROP TABLE rules_to_keep;
DROP TABLE base_name_mapping;
