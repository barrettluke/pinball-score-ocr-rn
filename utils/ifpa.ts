import { MatchplayTournament } from './matchplay';

const API_BASE_URL = 'https://api.ifpapinball.com/v2';
const API_KEY = process.env.EXPO_PUBLIC_IFPA_API_KEY;

export interface IfpaCalendarEvent {
    tournament_id: string;
    tournament_name: string;
    event_name: string;
    address1: string;
    address2: string;
    city: string;
    stateprov: string;
    postal_code: string;
    country_name: string;
    country_code: string;
    website: string;
    start_date: string;
    end_date: string;
    director_name: string;
    latitude: string;
    longitude: string;
    ranking_system: string;
    private_flag: string;
    distance: number;
}

export interface IfpaCalendarResponse {
    calendar: IfpaCalendarEvent[];
    total_entries: number;
}

/**
 * Fetch IFPA Calendar events by coordinate radius
 */
export const searchIfpaCalendar = async (
    latitude: number,
    longitude: number,
    distanceMiles: number = 50
): Promise<MatchplayTournament[]> => {
    if (!API_KEY) {
        console.warn('No IFPA API Key found');
        return [];
    }

    try {
        const url = `${API_BASE_URL}/calendar/search?api_key=${API_KEY}&latitude=${latitude}&longitude=${longitude}&distance=${distanceMiles}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`IFPA API Error: ${response.status}`);
        }

        const data: IfpaCalendarResponse = await response.json();

        if (!data.calendar) return [];

        // Map to MatchplayTournament interface for UI consistency
        return data.calendar.map(event => ({
            tournamentId: parseInt(event.tournament_id, 10),
            name: event.event_name === 'Main Tournament' ? event.tournament_name : `${event.tournament_name} - ${event.event_name}`,
            status: 'upcoming', // IFPA calendar implies upcoming/active
            source: 'ifpa',
            startLocalDate: event.start_date,
            startLocalTime: '', // IFPA doesn't provide time
            organizerName: event.director_name,
            locationName: event.tournament_name, // Often the venue name is part of tournament name or not distinct
            address: [event.address1, event.address2, event.postal_code].filter(Boolean).join(', '),
            city: event.city,
            stateProvince: event.stateprov,
            country: event.country_code,
            latitude: parseFloat(event.latitude),
            longitude: parseFloat(event.longitude),
            description: `IFPA Ranked: ${event.ranking_system}. Director: ${event.director_name}. \n${event.website}`,
            imageUrl: undefined // IFPA doesn't provide images
        }));

    } catch (error) {
        console.error('searchIfpaCalendar error:', error);
        return [];
    }
};
