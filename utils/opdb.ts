import { supabase } from './matchplay';

export interface OPDBMachine {
    opdb_id: string;
    name: string;
    manufacturer: string | null;
    manufacture_date: string | null;
    image?: string | null;
    type?: string;
    display?: string;
    player_count?: number;
}

export interface OPDBMachineDetails extends OPDBMachine {
    shortname?: string;
    type?: string;
    display?: string;
    player_count?: number;
    description?: string;
    manufacturer_full_name?: string;
}

export const getTopManufacturers = async (): Promise<Array<{ label: string, query: string, count: number }>> => {
    try {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;

        // Loop to fetch all rows (Supabase default limit is 1000)
        while (true) {
            const { data, error } = await supabase
                .from('opdb_machines')
                .select('manufacturer_name')
                .range(from, from + step - 1);

            if (error) throw error;
            if (!data || data.length === 0) break;

            allData = [...allData, ...data];
            if (data.length < step) break; // Finished
            from += step;
        }

        const counts: Record<string, number> = {};
        allData.forEach((row: any) => {
            const name = row.manufacturer_name;
            if (name) counts[name] = (counts[name] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([name, count]) => ({ label: name, count, query: name })) // query matches label for now
            .sort((a, b) => b.count - a.count);

    } catch (e) {
        console.error('Error fetching manufacturers:', e);
        return [];
    }
};

export const searchMachines = async (query: string, manufacturerFilter?: string, page: number = 0, limit: number = 50): Promise<OPDBMachine[]> => {
    // If empty query and no filter, we DO return results now (for 'All' browse), but paginated.
    // if (!query && !manufacturerFilter) return []; // REMOVED constraint

    try {
        const from = page * limit;
        const to = from + limit - 1;

        let dbQuery = supabase
            .from('opdb_machines')
            .select('opdb_id, name, manufacturer_name, year, image_url, type, display, player_count')
            .range(from, to);

        if (manufacturerFilter) {
            // Precise manufacturer filter
            dbQuery = dbQuery.ilike('manufacturer_name', `%${manufacturerFilter}%`);
            // If we have a text query too, add it
            if (query && query !== manufacturerFilter) {
                dbQuery = dbQuery.textSearch('search_vector', query, { type: 'websearch' });
            } else {
                // Just sort by name if only filtering by manufacturer
                dbQuery = dbQuery.order('name');
            }
        } else {
            if (query) {
                // Standard text search using websearch logic (handles spaces naturally)
                dbQuery = dbQuery.textSearch('search_vector', query, { type: 'websearch' });
            } else {
                // No query, no manufacturer -> Browse Mode
                // Order by name
                dbQuery = dbQuery.order('name');
            }
        }

        const { data, error } = await dbQuery;

        if (error) {
            console.error('Supabase Search Error:', error);
            return [];
        }

        return (data || []).map((item: any) => ({
            opdb_id: item.opdb_id,
            name: item.name,
            manufacturer: item.manufacturer_name,
            manufacture_date: item.year,
            image: item.image_url,
            type: item.type,
            display: item.display,
            player_count: item.player_count
        }));
    } catch (error) {
        console.error('Search Exception:', error);
        return [];
    }


};





export const fetchMachineDetails = async (opdb_id: string): Promise<OPDBMachineDetails | null> => {
    try {
        const apiKey = process.env.EXPO_PUBLIC_OPDB_API_KEY;
        if (!apiKey) {
            console.warn('Missing OPDB API Key');
            return null;
        }

        const response = await fetch(`https://opdb.org/api/machines/${opdb_id}?api_token=${apiKey}`);
        if (!response.ok) return null;

        const data = await response.json();
        return {
            opdb_id: data.opdb_id,
            name: data.name,
            shortname: data.shortname,
            manufacturer: data.manufacturer?.name,
            manufacturer_full_name: data.manufacturer?.full_name,
            manufacture_date: data.manufacture_date,
            image: data.images?.find((img: any) => img.primary)?.urls?.medium,
            type: data.type,
            display: data.display,
            player_count: data.player_count,
            description: data.description
        };
    } catch (e) {
        console.error('Error fetching extended details:', e);
        return null;
    }
};
