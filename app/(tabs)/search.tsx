import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getDatabase } from '../../utils/database';
import { OPDBMachine, searchMachines } from '../../utils/opdb';

export default function SearchScreen() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<OPDBMachine[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        const machines = await searchMachines(query);
        setResults(machines);
        setLoading(false);
    };

    const handleSelectMachine = async (machine: OPDBMachine) => {
        try {
            const db = await getDatabase();
            await db.runAsync(
                'INSERT OR REPLACE INTO machines (opdb_id, name, manufacturer, year, image_url) VALUES (?, ?, ?, ?, ?)',
                machine.opdb_id,
                machine.name,
                machine.manufacturer,
                machine.manufacture_date,
                machine.image || null
            );
            Alert.alert('Success', `Saved ${machine.name} to your list!`);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save machine.');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.searchBar}>
                <TextInput
                    style={styles.input}
                    placeholder="Search for a machine..."
                    placeholderTextColor="#778da9"
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSearch}
                />
                <TouchableOpacity style={styles.button} onPress={handleSearch} disabled={loading}>
                    <Text style={styles.buttonText}>{loading ? '...' : 'Search'}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={results}
                keyExtractor={(item) => item.opdb_id}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.item} onPress={() => handleSelectMachine(item)}>
                        <Text style={styles.title}>{item.name}</Text>
                        <Text style={styles.subtitle}>{item.manufacturer} {item.manufacture_date ? `(${item.manufacture_date})` : ''}</Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    !loading && query ? <Text style={styles.empty}>No results found.</Text> : null
                }
            />
        </View>
    );
}

const THEME = {
    background: '#0d1b2a',
    card: '#1b263b',
    accent: '#00b4d8',
    text: '#e0e1dd',
    textSecondary: '#778da9',
    success: '#28a745',
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: THEME.background,
        paddingTop: 60,
    },
    searchBar: {
        flexDirection: 'row',
        marginBottom: 24,
        gap: 12,
    },
    input: {
        flex: 1,
        height: 50,
        backgroundColor: THEME.card,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: THEME.text,
    },
    button: {
        backgroundColor: THEME.accent,
        justifyContent: 'center',
        paddingHorizontal: 20,
        borderRadius: 12,
        shadowColor: THEME.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    item: {
        padding: 16,
        backgroundColor: THEME.card,
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.text,
    },
    subtitle: {
        fontSize: 14,
        color: THEME.textSecondary,
        marginTop: 4,
    },
    empty: {
        textAlign: 'center',
        color: THEME.textSecondary,
        marginTop: 40,
        fontSize: 16,
    },
});
