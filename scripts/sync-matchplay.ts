require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
// const fetch = require('node-fetch'); // Native fetch is used in Node 18+

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

    // Helper: Parse address string if city/state/country are missing
    function parseAddress(addr: string) {
        if (!addr) return { city: null, state: null, country: null };

        // 1. Split by comma to handle structural parts
        // e.g. "117 J St, Sacramento, CA 95814, US" -> ["117 J St", "Sacramento", "CA 95814", "US"]
        const parts = addr.split(',').map(p => p.trim()).filter(p => p.length > 0);

        if (parts.length < 2) return { city: null, state: null, country: null };

        let state = null;
        let city = null;
        let country = null;

        // Iterate backwards to look for State/Zip patterns
        // We skip the last part if it looks like a Country (2 chars, e.g. US, AU)
        // unless it's the ONLY candidate.

        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];

            // EXTRACT COUNTRY
            // Check for isolated "US", "AU", "UK", "CA" (Country Code) or full name "United States"
            // Assuming country is always at the very end (index parts.length - 1)
            if (i === parts.length - 1) {
                if (/^(US|USA|United States|AU|Australia|CA|Canada|UK|United Kingdom)$/i.test(part)) {
                    country = part;
                    // Normalize common codes
                    if (country.toUpperCase() === 'USA') country = 'US';
                    if (/united states/i.test(country)) country = 'US';
                    continue; // It was a country, move to next part leftwards
                }
            }

            // Check for "State Zip" pattern (e.g. "CA 95814")
            const stateZipMatch = part.match(/^([A-Za-z]{2})\s+\d+/);
            if (stateZipMatch) {
                state = stateZipMatch[1].toUpperCase();
                // If we found state at index i, City is likely i-1
                if (i > 0) {
                    let rawCity = parts[i - 1];
                    // FIX: If "City" starts with digits, it likely contains Street address too
                    // e.g. "1100 First State Blvd. Wilmington"
                    if (/^\d/.test(rawCity)) {
                        // Try to split on common street suffixes
                        // Ave, St, Rd, Blvd, Ln, Dr, Ct, Pl, Way, Cir, Hwy, Pkwy
                        // FIX: Use \b to avoid matching "st" in "First"
                        const streetSplit = rawCity.match(/\b(?:Ave|St|Rd|Blvd|Ln|Dr|Ct|Pl|Way|Cir|Hwy|Pkwy)\.?\s+(.+)$/i);
                        if (streetSplit) {
                            rawCity = streetSplit[1];
                        }
                    }
                    city = rawCity.trim();
                }
                break;
            }

            // Check for isolated State code (e.g. "SA")
            // Avoid "US" or "AU" if it's the very last part (likely Country)
            const isIso = /^[A-Za-z]{2,3}$/.test(part);
            if (isIso) {
                // If it's the last part, we already checked for Country above.
                // If we are here, and it matches 2-3 chars, it MIGHT be a state (e.g. "SA" in Australia)
                // UNLESS we already identified a country.
                const isLast = (i === parts.length - 1);

                if (!isLast) {
                    state = part.toUpperCase();
                    if (i > 0) city = parts[i - 1];
                    break;
                }
            }
        }

        return { city, state, country };
    }

    // 2. Transform for Supabase
    const rows = combined.map(t => {
        const lat = t.location?.latitude;
        const lon = t.location?.longitude;

        // Disable WKT location logic if lat/lon missing
        let location = null;
        if (lat && lon) {
            // WKT format for PostGIS: "POINT(lon lat)"
            location = `POINT(${lon} ${lat})`;
        }

        // Smart Parse: If API misses city/state, try to guess from address string
        let city = t.location?.city || null;
        let state = t.location?.state || null;
        let country = t.location?.country || null;
        const rawAddress = t.location?.address || '';

        if (rawAddress && (!city || !state || !country)) {
            const parsed = parseAddress(rawAddress);
            if (!city) city = parsed.city;
            if (!state) state = parsed.state;
            if (!country) country = parsed.country;
        }

        // SPLIT TIME
        // t.startLocal is "2026-07-30 18:00:00"
        let startDate = t.startLocal;
        let startTime = null;

        if (t.startLocal && t.startLocal.includes(' ')) {
            const parts = t.startLocal.split(' ');
            if (parts.length === 2) {
                startDate = parts[0]; // "2026-07-30"
                startTime = parts[1]; // "18:00:00"
            }
        }

        return {
            tournament_id: t.tournamentId,
            name: t.name,
            status: t.status,
            start_local_date: startDate,
            start_local_time: startTime,
            organizer_name: t.organizerName || null,
            location_name: t.location?.name || null,
            address: t.location?.address || null,
            city: city,
            state_province: state,
            country: country,
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
