import { createClient } from '@supabase/supabase-js';
const API_BASE_URL = 'https://app.matchplay.events/api';

// In-memory cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache: Map<string, { data: any; timestamp: number }> = new Map();

// Cache helper functions
const getCached = <T>(key: string): T | null => {
    const entry = cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age < CACHE_TTL_MS) {
        return entry.data as T;
    }
    // Cache expired, remove it
    cache.delete(key);
    return null;
};

const setCache = <T>(key: string, data: T): void => {
    cache.set(key, { data, timestamp: Date.now() });
};

export const clearEventsCache = (): void => {
    cache.clear();
};

export interface MatchplayTournament {
    tournamentId: number; // Common ID field
    itemId?: number;      // Deprecated/Alternative?
    name: string;
    status: 'active' | 'upcoming' | 'completed';
    startLocalDate: string;
    startLocalTime?: string; // Optimistically adding this
    organizerName: string;
    locationName: string;
    address: string;
    city: string;
    stateProvince: string;
    country: string;
    latitude?: number;
    longitude?: number;
    description: string;
    distance?: number; // Not returned by standard API, but we might calculate or mock it
    imageUrl?: string; // Tournament specific avatar/logo
    raw?: any; // Debug field
}

export interface MatchplayDashboard {
    tournaments: MatchplayTournament[];
    // formatted like { active: [...], upcoming: [...], completed: [...] } usually
}

const getHeaders = (): HeadersInit => {
    const apiKey = process.env.EXPO_PUBLIC_MATCHPLAY_API_KEY;
    if (!apiKey) {
        return {};
    }
    return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
};

// Helper to map API response (often snake_case) to our internal interface
const mapToTournament = (data: any): MatchplayTournament => {
    // API returns startUtc (ISO) and startLocal ("YYYY-MM-DD HH:MM:SS")
    // We prefer startLocal to show the event's wall-clock time.
    // Replace space with T to ensure parsing consistency: "2024-01-01 13:30:00" -> "2024-01-01T13:30:00"
    // This creates a "floating" local time Date object.
    let dateStr = data.startLocal ? data.startLocal.replace(' ', 'T') : (data.startUtc || '');

    // Extract readable time if possible
    let timeStr = '';
    if (data.startLocal && data.startLocal.includes(' ')) {
        // Simple parse: "2024-01-01 13:30:00" -> "13:30:00"
        const parts = data.startLocal.split(' ');
        if (parts.length > 1) {
            // Convert 24h to 12h nicely if we want, or just store for now.
            // Let's try to make it nice: 13:30 -> 1:30 PM
            const [h, m] = parts[1].split(':');
            const hour = parseInt(h, 10);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            timeStr = `${hour12}:${m} ${ampm}`;
        }
    }

    // Attempt to find coordinates
    let lat = data.location?.latitude || data.location?.lat || data.latitude;
    let long = data.location?.longitude || data.location?.lng || data.longitude;
    // Sometimes they come as strings
    if (lat) lat = parseFloat(lat);
    if (long) long = parseFloat(long);

    // Extract city/state from address if not provided separately
    // Address formats: 
    // - "Street Address. City, ST ZIP"
    // - "Street, City, ST ZIP, Country" (comma separated with ST+ZIP together)
    // - "Street, City, ST, ZIP, Country" (fully comma separated)
    const rawAddress = data.location?.address || data.address || '';
    let city = data.location?.city || data.city || '';
    let state = data.location?.state || data.location?.state_province || data.state || '';

    if (!city && rawAddress) {
        const parts = rawAddress.split(',').map((p: string) => p.trim());

        if (parts.length >= 3) {
            // Look for state pattern: either "ST" alone, or "ST 12345" (state + ZIP)
            for (let i = 1; i < parts.length; i++) {
                const part = parts[i];
                // Match "ST" or "ST 12345" or "ST 12345-1234"
                const stateMatch = part.match(/^([A-Z]{2})(?:\s+\d{5})?(?:-\d{4})?$/);
                if (stateMatch) {
                    state = stateMatch[1]; // Just the 2-letter state
                    city = parts[i - 1]; // City is the part before state
                    break;
                }
            }
        }

        // Fallback: Try "City, ST ZIP" format (no comma between ST and ZIP)
        if (!city) {
            const match = rawAddress.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s+\d{5}/);
            if (match) {
                city = match[1].trim();
                state = match[2];
            }
        }
    }

    // Extract country from end of address (usually last comma-separated part)
    let country = data.location?.country || '';
    if (!country && rawAddress) {
        const parts = rawAddress.split(',').map((p: string) => p.trim());
        const lastPart = parts[parts.length - 1];
        // Check if last part is a country code or name
        if (/^(US|USA|CA|UK|AU|DE|FR|NL|BE|ES|IT|JP|NZ|SE|NO|DK|FI|AT|CH|IE|MX|BR|PL|CZ|PT|GR|HU|RO|BG|HR|SI|SK|LT|LV|EE|IS|LU|MT|CY)$/i.test(lastPart)) {
            country = lastPart.toUpperCase();
        } else if (lastPart.length > 2 && !/\d/.test(lastPart)) {
            // Might be full country name like "Canada", "Germany"
            country = lastPart;
        }
    }

    return {
        tournamentId: data.tournamentId || data.tournament_id || data.id || 0,
        itemId: data.itemId || data.item_id,
        name: data.name || 'Unknown Tournament',
        status: (data.status || 'upcoming').toLowerCase(),
        startLocalDate: dateStr,
        startLocalTime: timeStr,
        organizerName: data.organizer_name || data.organizerName || '',
        locationName: data.location?.name || data.location_name || data.locationName || '',
        address: rawAddress,
        city: city,
        stateProvince: state,
        country: country,
        latitude: lat,
        longitude: long,
        description: data.description || '',
        distance: data.distance,
        imageUrl: data.tournamentAvatar || null,
        raw: data
    };
};

/**
 * Search for public tournaments (Upcoming/Active) with pagination and caching
 */
export const getTournaments = async (
    status: 'active' | 'upcoming' | 'completed' = 'upcoming',
    page: number = 1,
    forceRefresh: boolean = false
): Promise<{ tournaments: MatchplayTournament[]; hasMore: boolean }> => {
    const cacheKey = `${status}_page${page}`;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
        const cached = getCached<{ tournaments: MatchplayTournament[]; hasMore: boolean }>(cacheKey);
        if (cached) {
            return cached;
        }
    }

    try {
        const response = await fetch(`${API_BASE_URL}/tournaments?status=${status}&page=${page}`, {
            headers: getHeaders(),
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Unauthorized: Check API Key');
            }
            throw new Error('Failed to fetch tournaments');
        }

        const data = await response.json();

        const list = Array.isArray(data) ? data : (data.data || []);
        const tournaments = list.map(mapToTournament);

        // 25 items per page is standard for MatchPlay
        const hasMore = tournaments.length === 25;

        const result = { tournaments, hasMore };

        // Save to cache
        setCache(cacheKey, result);

        return result;
    } catch (error) {
        console.error(`Error fetching ${status} tournaments:`, error);
        return { tournaments: [], hasMore: false };
    }
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to calculate distance (Haversine formula simplified)
const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Scan for nearby tournaments using Supabase PostGIS
 */
export const findNearbyTournaments = async (
    userLat: number,
    userLon: number,
    radiusMiles: number = 100,
    maxPagesToScan: number = 10, // Unused in Supabase mode, kept for compatibility
    userZip: string | null = null,
    userState: string | null = null,
    startPage: number = 1,
    status: 'active' | 'upcoming' | 'completed' = 'upcoming'
): Promise<{ tournaments: MatchplayTournament[]; scannedPages: number }> => {
    try {
        // Convert miles to meters
        const radiusMeters = radiusMiles * 1609.34;

        const { data, error } = await supabase.rpc('get_nearby_tournaments', {
            user_lat: userLat,
            user_lon: userLon,
            radius_meters: radiusMeters,
        });

        if (error) {
            console.error('Supabase RPC Error:', error);
            throw error;
        }

        if (!data) return { tournaments: [], scannedPages: 0 };

        // Map DB snake_case to App camelCase
        const tournaments: MatchplayTournament[] = data
            .filter((t: any) => t.status === status) // Filter by status logic
            .map((t: any) => ({
                tournamentId: t.tournament_id,
                name: t.name,
                status: t.status,
                startLocalDate: t.start_local_date,
                startLocalTime: t.start_local_time,
                organizerName: t.organizer_name,
                locationName: t.location_name,
                address: t.address,
                city: t.city,
                stateProvince: t.state_province,
                country: t.country,
                latitude: t.latitude,
                longitude: t.longitude,
                description: t.description,
                distance: t.dist_meters ? t.dist_meters / 1609.34 : 0, // RPC might return distance if modified, otherwise we calc
                imageUrl: t.image_url,
            }));

        // Client-side distance calc if RPC didn't return it
        tournaments.forEach(t => {
            if (t.latitude && t.longitude && !t.distance) {
                t.distance = getDist(userLat, userLon, t.latitude, t.longitude);
            }
        });

        return {
            tournaments,
            scannedPages: 999 // Arbitrary high number to indicate "we found everything"
        };
    } catch (err) {
        console.error('findNearbyTournaments error:', err);
        return { tournaments: [], scannedPages: 0 };
    }
};

// ... keep existing functions ...

export const getUserDashboard = async (): Promise<MatchplayTournament[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard`, {
            headers: getHeaders(),
        });

        if (!response.ok) throw new Error('Failed to fetch dashboard');

        const data = await response.json();
        const allEvents = [
            ...(data.active || []),
            ...(data.upcoming || [])
        ];
        return allEvents.map(mapToTournament);
    } catch (error) {
        console.error('getUserDashboard error:', error);
        return [];
    }
};

