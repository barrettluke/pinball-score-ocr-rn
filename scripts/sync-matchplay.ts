require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// CONFIG
const MATCHPLAY_API_BASE = 'https://app.matchplay.events/api';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
// MUST be the Service Role Key to allow writing to the DB from a script
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface MatchplayTournament {
    tournamentId: number;
    name: string;
    status: string;
    startLocal: string; // "2024-01-01 13:00:00"
    organizerName?: string;
    location?: {
        name?: string;
        address?: string;
        city?: string;
        state?: string;
        country?: string;
        latitude?: number;
        longitude?: number;
    };
    description?: string;
    tournamentAvatar?: string;
}

async function fetchTournaments(status: 'upcoming' | 'active', pagesToScan = 5): Promise<MatchplayTournament[]> {
    let all: MatchplayTournament[] = [];

    for (let page = 1; page <= pagesToScan; page++) {
        try {
            console.log(`Fetching ${status} page ${page}...`);
            const res = await fetch(`${MATCHPLAY_API_BASE}/tournaments?status=${status}&page=${page}`);
            if (!res.ok) continue;

            const json = await res.json();
            const list = Array.isArray(json) ? json : (json.data || []);

            if (list.length === 0) break;
            all = [...all, ...list];
        } catch (e) {
            console.error(`Error fetching page ${page}`, e);
        }
    }
    return all;
}

async function sync() {
    console.log('Starting Sync...');

    // 1. Fetch from Matchplay
    // Scan deeper (10 pages) for Upcoming, 5 for Active
    const upcoming = await fetchTournaments('upcoming', 10);
    const active = await fetchTournaments('active', 5);

    const combined = [...active, ...upcoming];
    console.log(`Fetched ${combined.length} tournaments.`);

    // Helper: Parse address string if city/state are missing
    function parseAddress(addr: string) {
        if (!addr) return { city: null, state: null };

        // Classic US pattern: "City, State Zip" or "City, State"
        // Regex: (Anything), (2-Letter State) (Optional Zip)
        const match = addr.match(/([^,]+),\s*([A-Za-z]{2})(?:\s+\d{5})?$/);
        if (match) {
            return {
                city: match[1].trim(),
                state: match[2].toUpperCase(),
            };
        }
        return { city: null, state: null };
    }

    // 2. Transform for Supabase
    const rows = combined.map(t => {
        const lat = t.location?.latitude;
        const lon = t.location?.longitude;

        // Only valid if we have coordinates
        let location = null;
        if (lat && lon) {
            // WKT format for PostGIS: "POINT(lon lat)"
            location = `POINT(${lon} ${lat})`;
        }

        // Smart Parse: If API misses city/state, try to guess from address string
        let city = t.location?.city || null;
        let state = t.location?.state || null;
        const rawAddress = t.location?.address || '';

        if ((!city || !state) && rawAddress) {
            const parsed = parseAddress(rawAddress);
            if (!city) city = parsed.city;
            if (!state) state = parsed.state;
        }

        return {
            tournament_id: t.tournamentId,
            name: t.name,
            status: t.status,
            start_local_date: t.startLocal,
            organizer_name: t.organizerName || null,
            location_name: t.location?.name || null,
            address: t.location?.address || null,
            city: city,
            state_province: state,
            country: t.location?.country || null,
            latitude: lat || null,
            longitude: lon || null,
            description: t.description || null,
            image_url: t.tournamentAvatar || null,
            location: location, // The Geography column
            updated_at: new Date().toISOString()
        };
    });

    // 3. Upsert into Supabase
    // We process in chunks of 100 to avoid request limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
            .from('tournaments')
            .upsert(chunk, { onConflict: 'tournament_id' });

        if (error) {
            console.error('Error upserting chunk:', error);
        } else {
            console.log(`Upserted rows ${i} to ${i + chunk.length}`);
        }
    }

    console.log('Sync Complete.');
}

sync();
