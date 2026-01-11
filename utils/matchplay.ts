/**
 * matchplay.ts - Simplified Tournament Service
 * 
 * All public tournament data comes from Supabase (synced hourly via GitHub Actions).
 * Only getUserDashboard still uses the Matchplay API (requires personal auth).
 */

import { createClient } from '@supabase/supabase-js';

// ===== Configuration =====
const API_BASE_URL = 'https://app.matchplay.events/api';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== Types =====
export interface MatchplayTournament {
    tournamentId: number;
    name: string;
    // ... validation status
    source?: 'matchplay' | 'ifpa' | 'both';
    status: string;
    startLocalDate: string;
    startLocalTime?: string;
    organizerName: string;
    locationName: string;
    address: string;
    city: string;
    stateProvince: string;
    country: string;
    latitude?: number;
    longitude?: number;
    description: string;
    imageUrl?: string;
}

// ===== Helper: Map Supabase Row to App Interface =====
const mapSupabaseRow = (t: any): MatchplayTournament => ({
    tournamentId: t.tournament_id,
    name: t.name,
    status: t.status,
    // Mock source for verified visual testing (randomly assign some as IFPA/Both)
    source: t.description?.toLowerCase().includes('ifpa') || t.name?.toLowerCase().includes('open') ? 'both' : 'matchplay',
    startLocalDate: t.start_local_date,
    startLocalTime: t.start_local_time,
    organizerName: t.organizer_name || '',
    locationName: t.location_name || '',
    address: t.address || '',
    city: t.city || '',
    stateProvince: t.state_province || '',
    country: t.country || '',
    latitude: t.latitude,
    longitude: t.longitude,
    description: t.description || '',
    imageUrl: t.image_url,
});

// ===== Helper: Get Valid Statuses =====
export const getValidStatuses = (status: 'active' | 'upcoming' | 'completed' | string): string[] => {
    // Matchplay API uses 'planned'/'started', we normalize to 'upcoming'/'active'
    if (status === 'upcoming') return ['upcoming', 'planned'];
    if (status === 'active') return ['active', 'started'];
    return [status];
};

// ===== Public API Functions =====

/**
 * Fetch all public tournaments from Supabase by status
 */
export const getSupabaseTournaments = async (
    status: 'active' | 'upcoming' | 'completed',
    minDate?: string
): Promise<MatchplayTournament[]> => {
    try {
        const validStatuses = getValidStatuses(status);
        const orFilter = validStatuses.map(s => `status.eq.${s}`).join(',');

        let query = supabase
            .from('tournaments')
            .select('*')
            .or(orFilter);

        if (minDate) {
            query = query.gte('start_local_date', minDate);
        }

        const { data, error } = await query
            .order('start_local_date', { ascending: status !== 'completed' })
            .limit(2000); // Increased limit to capture long-range future events

        if (error) throw error;
        if (!data) return [];

        return data.map(mapSupabaseRow);
    } catch (err) {
        console.error('getSupabaseTournaments error:', err);
        return [];
    }
};

/**
 * Search tournaments using Matchplay API directly
 * This allows finding tournaments that might not be synced to Supabase
 */
export const searchTournaments = async (
    query: string,
    statusFilter?: string[]
): Promise<MatchplayTournament[]> => {
    if (!query || query.trim().length < 2) return [];

    try {
        // Matchplay doesn't have a search endpoint, so we search in Supabase first
        // using text search on name and location
        let queryBuilder = supabase
            .from('tournaments')
            .select('*')
            .or(`name.ilike.%${query}%,location_name.ilike.%${query}%`)
            .order('start_local_date', { ascending: true })
            .limit(50);

        if (statusFilter && statusFilter.length > 0) {
            queryBuilder = queryBuilder.in('status', statusFilter);
        }

        const { data, error } = await queryBuilder;

        if (error) throw error;
        if (!data) return [];

        return data.map(mapSupabaseRow);
    } catch (err) {
        console.error('searchTournaments error:', err);
        return [];
    }
};

/**
 * Fetch tournaments filtered by user's state
 * This replaces the broken lat/long "Nearby" filter
 */
export const getStateFilteredTournaments = async (
    userState: string,
    status: 'active' | 'upcoming' | 'completed' = 'upcoming'
): Promise<MatchplayTournament[]> => {
    try {
        const validStatuses = getValidStatuses(status);
        const statusFilter = validStatuses.map(s => `status.eq.${s}`).join(',');

        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .or(statusFilter)
            .eq('state_province', userState.toUpperCase())
            .order('start_local_date', { ascending: true })
            .limit(100);

        if (error) throw error;
        if (!data) return [];

        return data.map(mapSupabaseRow);
    } catch (err) {
        console.error('getStateFilteredTournaments error:', err);
        return [];
    }
};

/**
 * Fetch nearby tournaments using PostGIS distance query
 * Uses the get_nearby_tournaments RPC function in Supabase
 */
export const getNearbyTournaments = async (
    latitude: number,
    longitude: number,
    radiusMiles: number = 100,
    status?: 'active' | 'upcoming' | 'completed'
): Promise<MatchplayTournament[]> => {
    try {
        // Convert miles to meters for PostGIS
        const radiusMeters = radiusMiles * 1609.34;

        // Call the RPC function
        const { data, error } = await supabase.rpc('get_nearby_tournaments', {
            user_lat: latitude,
            user_lon: longitude,
            radius_meters: radiusMeters
        });

        if (error) {
            console.error('getNearbyTournaments RPC error:', error);
            return [];
        }

        if (!data) return [];

        // Map and optionally filter by status
        let tournaments = data.map(mapSupabaseRow);

        if (status) {
            const validStatuses = getValidStatuses(status);
            tournaments = tournaments.filter((t: MatchplayTournament) => validStatuses.includes(t.status));
        }

        return tournaments;
    } catch (err) {
        console.error('getNearbyTournaments error:', err);
        return [];
    }
};

/**
 * Fetch user's personal tournaments from Matchplay API
 * This is the only function that still needs the Matchplay API (requires auth)
 */
export const getUserDashboard = async (): Promise<MatchplayTournament[]> => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_MATCHPLAY_API_KEY;
        if (!apiKey) {
            console.warn('No Matchplay API key configured');
            return [];
        }

        const response = await fetch(`${API_BASE_URL}/dashboard`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) throw new Error('Failed to fetch dashboard');

        const data = await response.json();
        const allEvents = [
            ...(data.active || []),
            ...(data.upcoming || [])
        ];

        // Map Matchplay API format to our interface
        return allEvents.map((d: any) => {
            // Extract time from startLocal "2024-01-01 13:30:00"
            let timeStr = '';
            if (d.startLocal?.includes(' ')) {
                const [, timePart] = d.startLocal.split(' ');
                const [h, m] = timePart.split(':');
                const hour = parseInt(h, 10);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const hour12 = hour % 12 || 12;
                timeStr = `${hour12}:${m} ${ampm}`;
            }

            return {
                tournamentId: d.tournamentId || d.tournament_id || 0,
                name: d.name || 'Unknown Tournament',
                status: (d.status || 'upcoming').toLowerCase(),
                startLocalDate: d.startLocal?.replace(' ', 'T') || '',
                startLocalTime: timeStr,
                organizerName: d.organizer_name || d.organizerName || '',
                locationName: d.location?.name || d.location_name || '',
                address: d.location?.address || '',
                city: d.location?.city || '',
                stateProvince: d.location?.state || '',
                country: d.location?.country || '',
                latitude: d.location?.latitude,
                longitude: d.location?.longitude,
                description: d.description || '',
                imageUrl: d.tournamentAvatar,
            };
        });
    } catch (error) {
        console.error('getUserDashboard error:', error);
        return [];
    }
};
