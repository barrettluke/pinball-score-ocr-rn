
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// @ts-ignore
const fetch = global.fetch || require('node-fetch');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing env vars.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log('Fetching manufacturer names...');
    const { data, error } = await supabase
        .from('opdb_machines')
        .select('manufacturer_name');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Fetched ${data.length} rows.`);

    const counts: Record<string, number> = {};
    data.forEach((row: any) => {
        const name = row.manufacturer_name || 'Unknown';
        counts[name] = (counts[name] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .sort(([, a], [, b]) => b - a);

    console.log(`Found ${sorted.length} unique manufacturers.`);
    console.log('Top 20:');
    sorted.slice(0, 20).forEach(([name, count], i) => {
        console.log(`${i + 1}. ${name} (${count})`);
    });
}

run();
