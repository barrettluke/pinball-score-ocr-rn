/**
 * Pinball Map API Utility
 * Provides functions to search for pinball locations using the Pinball Map API
 */

const PINBALL_MAP_API = 'https://pinballmap.com/api/v1';
import { getDistance } from './location';

export interface PinballMapLocation {
    id: number;
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    lat: string;
    lon: string;
    num_machines: number;
    distance: number;
    machines?: { name: string; manufacturer: string; year: string }[];
}

export interface PinballMapMachine {
    id: number;
    name: string;
    manufacturer: string;
    year: number;
}

/**
 * Search for a machine in Pinball Map by name
 * Returns the machine ID needed for location searches
 */
export async function searchMachineByName(machineName: string): Promise<PinballMapMachine | null> {
    try {
        // First try searching with the exact name (including Pro/Premium/etc)
        let response = await fetch(
            `${PINBALL_MAP_API}/machines.json?name=${encodeURIComponent(machineName)}`
        );
        let data = await response.json();

        // If no results, try cleaning up the name (remove Pro/Le/etc)
        if (!data.machines || data.machines.length === 0) {
            const cleanName = machineName
                .replace(/\s*\((Pro|LE|Premium|Limited Edition|SE|CE|Vault Edition|LUCI).*\)/gi, '')
                .trim();

            if (cleanName !== machineName) {
                response = await fetch(
                    `${PINBALL_MAP_API}/machines.json?name=${encodeURIComponent(cleanName)}`
                );
                data = await response.json();
            }
        }

        if (data.machines && data.machines.length > 0) {
            // Try to find exact match first (case-insensitive) for the original name
            const exactMatch = data.machines.find((m: any) => m.name.toLowerCase() === machineName.toLowerCase());
            if (exactMatch) {
                return exactMatch;
            }

            // If we scrubbed the name or just didn't find exact match, try exact match against clean name
            // (Only relevant if we have a clean name to compare against)
            const cleanName = machineName
                .replace(/\s*\((Pro|LE|Premium|Limited Edition|SE|CE|Vault Edition|LUCI).*\)/gi, '')
                .trim();

            const cleanMatch = data.machines.find((m: any) => m.name.toLowerCase() === cleanName.toLowerCase());
            if (cleanMatch) {
                return cleanMatch;
            }

            // Return first match as fallback
            return data.machines[0];
        }
        return null;
    } catch (error) {
        console.error('Error searching Pinball Map machine:', error);
        return null;
    }
}

/**
 * Find locations near a lat/lon that have a specific machine
 * @param lat Latitude
 * @param lon Longitude
 * @param machineId Pinball Map machine ID
 * @param maxDistance Miles to search (default 50)
 */
export async function findLocationsWithMachine(
    lat: number,
    lon: number,
    machineId: number,
    maxDistance: number = 50
): Promise<PinballMapLocation[]> {
    try {
        // Use by_machine_id for filtering
        const response = await fetch(
            `${PINBALL_MAP_API}/locations/closest_by_lat_lon.json?lat=${lat}&lon=${lon}&by_machine_id=${machineId}&max_distance=${maxDistance}`
        );

        if (!response.ok) return [];

        const data = await response.json();

        if (data.locations) {
            // Filter out locations that don't actually have the specific machine ID
            // (The API sometimes returns "fuzzy" matches, e.g. Premium for Pro)
            return data.locations.filter((loc: any) => loc.machine_ids.includes(machineId));
        }
        if (data.location) {
            // Singular location check
            if (data.location.machine_ids && data.location.machine_ids.includes(machineId)) {
                return [data.location];
            }
            return [];
        }

        return [];
    } catch (error) {
        console.error('Error finding Pinball Map locations:', error);
        return [];
    }
}

/**
 * Find locations near a lat/lon (any machines)
 */
export async function findNearbyLocations(
    lat: number,
    lon: number,
    maxDistance: number = 30
): Promise<PinballMapLocation[]> {
    try {
        const response = await fetch(
            `${PINBALL_MAP_API}/locations/closest_by_lat_lon.json?lat=${lat}&lon=${lon}&send_all_within_distance=1&max_distance=${maxDistance}`
        );

        if (!response.ok) return [];

        const data = await response.json();
        return data.locations || [];
    } catch (error) {
        console.error('Error finding nearby Pinball Map locations:', error);
        return [];
    }
}

/**
 * Get machines at a specific location
 */
export async function getMachinesAtLocation(locationId: number): Promise<{ name: string; manufacturer: string; year: string }[]> {
    try {
        const response = await fetch(
            `${PINBALL_MAP_API}/locations/${locationId}/machine_details.json`
        );

        if (!response.ok) return [];

        const data = await response.json();
        return data.machines?.map((m: any) => ({
            name: m.name,
            manufacturer: m.manufacturer,
            year: m.year?.toString() || ''
        })) || [];
    } catch (error) {
        console.error('Error getting machines at location:', error);
        return [];
    }
}

/**
 * Find locations that have any of the provided machines
 * Aggregates results from multiple machine searches
 */


/**
 * Find nearby locations that have ANY of the user's favorite machines.
 * Uses a Region-Based strategy for accuracy:
 * 1. Find user's region
 * 2. Fetch all locations in region
 * 3. Filter locally by distance and favorites
 */
export async function findLocationsWithFavorites(
    lat: number,
    lon: number,
    favoriteMachineNames: string[],
    maxDistance: number = 60
): Promise<{ location: PinballMapLocation; matchingMachines: string[] }[]> {
    if (favoriteMachineNames.length === 0) return [];

    try {
        console.log('[PinballMap] Starting Region-Based Search...');

        // 1. Resolve favorite names to IDs (for strict matching)
        const favoriteIds: number[] = [];
        const machineIdToName: Record<number, string> = {};

        await Promise.all(favoriteMachineNames.map(async (name) => {
            const machine = await searchMachineByName(name);
            if (machine) {
                favoriteIds.push(machine.id);
                // Also map the name for display purposes
                machineIdToName[machine.id] = name;
            }
        }));

        if (favoriteIds.length === 0) return [];

        // 2. Find user's Region ID via a quick nearby search
        const nearbyResponse = await fetch(
            `${PINBALL_MAP_API}/locations/closest_by_lat_lon.json?lat=${lat}&lon=${lon}&max_distance=50&limit=1`
        );
        if (!nearbyResponse.ok) return [];

        const nearbyData = await nearbyResponse.json();
        const closestLoc = nearbyData.location || (nearbyData.locations && nearbyData.locations[0]);

        if (!closestLoc || !closestLoc.region_id) {
            console.log('[PinballMap] Could not determine region from nearby search.');
            return [];
        }

        const regionId = closestLoc.region_id;
        console.log(`[PinballMap] User is in Region ID: ${regionId}. resolving name...`);

        // 2b. Map Region ID to Name (API requires Name for region dump)
        const regionsResponse = await fetch(`${PINBALL_MAP_API}/regions.json`);
        if (!regionsResponse.ok) return [];

        const regionsData = await regionsResponse.json();
        const regionObj = regionsData.regions?.find((r: any) => r.id === regionId);

        if (!regionObj || !regionObj.name) {
            console.log('[PinballMap] Could not resolve region name.');
            return [];
        }

        const regionName = regionObj.name;
        console.log(`[PinballMap] Region resolved to: ${regionName}`);

        // 3. Fetch ALL locations for this region using NAME
        const regionResponse = await fetch(`${PINBALL_MAP_API}/region/${regionName}/locations.json`);
        if (!regionResponse.ok) return [];

        const regionData = await regionResponse.json();
        const allLocations = regionData.locations || [];
        console.log(`[PinballMap] Fetched ${allLocations.length} locations in region.`);

        // 4. Filter locally
        const results: { location: PinballMapLocation; matchingMachines: string[]; distance: number }[] = [];

        for (const loc of allLocations) {
            // Calculate distance manually
            const locLat = parseFloat(loc.lat);
            const locLon = parseFloat(loc.lon);
            const dist = getDistance(lat, lon, locLat, locLon);

            if (dist > maxDistance) continue;

            // Check for matching machines
            // Standard search returns `machine_ids` (array of numbers).
            // Region dump returns `location_machine_xrefs` (array of objects).
            // IMPORTANT: Explicitly handle empty array case for machine_ids
            let locMachineIds: number[] = loc.machine_ids || [];

            if (locMachineIds.length === 0 && loc.location_machine_xrefs) {
                locMachineIds = loc.location_machine_xrefs.map((xref: any) => xref.machine_id);
            }

            // Backfill for compatibility
            loc.machine_ids = locMachineIds;

            const matches: string[] = [];

            // Debug log for Kiitos Brewing
            if (loc.id === 9266) {
                console.log(`[PinballMap] DEBUG: Checking Kiitos Brewing (9266). IDs found: ${locMachineIds.length}`);
                console.log(`[PinballMap] DEBUG: Location Xrefs count: ${loc.location_machine_xrefs?.length}`);
            }

            for (const favId of favoriteIds) {
                if (locMachineIds.includes(favId)) {
                    matches.push(machineIdToName[favId]);
                }
            }

            if (matches.length > 0) {
                // Deduplicate matches just in case
                const uniqueMatches = Array.from(new Set(matches));

                // Construct the result object
                // We add 'distance' to the location object if it's not there, or rely on our calculated one for sorting
                const locWithDist = { ...loc, distance: dist };

                results.push({
                    location: locWithDist,
                    matchingMachines: uniqueMatches,
                    distance: dist
                });
            }
        }

        console.log(`[PinballMap] Found ${results.length} matching locations.`);

        // 5. Sort by (matches DESC, distance ASC)
        return results.sort((a, b) => {
            const matchesDiff = b.matchingMachines.length - a.matchingMachines.length;
            if (matchesDiff !== 0) return matchesDiff;
            return a.distance - b.distance;
        }).map(item => ({
            location: item.location,
            matchingMachines: item.matchingMachines
        }));

    } catch (error) {
        console.error('Error finding favorite locations:', error);
        return [];
    }
}
