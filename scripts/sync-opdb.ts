
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' }); // Explicitly load .env.local if needed, though dotenv usually loads .env

// @ts-ignore
const fetch = global.fetch || require('node-fetch');

const OPDB_API_KEY = process.env.EXPO_PUBLIC_OPDB_API_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPDB_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required environment variables (OPDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sync() {
    console.log('Fetching OPDB export...');
    try {
        const res = await fetch(`https://opdb.org/api/export?api_token=${OPDB_API_KEY}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch export: ${res.status} ${res.statusText}`);
        }

        // This might be large (5-10MB), but fits in memory for Node
        const machines = await res.json();
        console.log(`Fetched ${machines.length} machines. Preparing upload...`);

        const rows = machines.map((m: any) => ({
            opdb_id: m.opdb_id,
            name: m.name,
            manufacturer_name: m.manufacturer?.name || null,
            year: m.manufacture_date ? m.manufacture_date.substring(0, 4) : null,
            image_url: m.images?.[0]?.urls?.medium || m.images?.[0]?.urls?.large || null,
            type: m.type,
            display: m.display,
            player_count: m.player_count,
            description: m.description,
            updated_at: new Date().toISOString()
        }));

        // Batch upsert to Supabase
        const BATCH_SIZE = 500;
        let successCount = 0;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from('opdb_machines').upsert(batch);

            if (error) {
                console.error(`Error upserting batch ${i}-${i + BATCH_SIZE}:`, error.message);
            } else {
                successCount += batch.length;
                process.stdout.write(`\rSynced ${successCount}/${rows.length} machines...`);
            }
        }

        console.log('\nSync complete!');

    } catch (e) {
        console.error('Sync failed:', e);
    }
}

sync();
