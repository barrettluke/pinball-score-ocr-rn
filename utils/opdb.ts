const OPDB_BASE_URL = 'https://opdb.org/api';

export interface OPDBMachine {
    opdb_id: string;
    name: string;
    manufacturer: string | null;
    manufacture_date: string | null;
}

export const searchMachines = async (query: string): Promise<OPDBMachine[]> => {
    if (!query) return [];
    try {
        const response = await fetch(`${OPDB_BASE_URL}/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            console.error('OPDB API Error:', response.status);
            return [];
        }
        const data = await response.json();
        return data.map((item: any) => ({
            opdb_id: item.opdb_id,
            name: item.name,
            manufacturer: item.manufacturer?.name || null,
            manufacture_date: item.manufacture_date || null,
        }));
    } catch (error) {
        console.error('OPDB Search Error:', error);
        return [];
    }
};
