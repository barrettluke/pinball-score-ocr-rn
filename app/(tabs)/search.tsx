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
                'INSERT OR REPLACE INTO machines (opdb_id, name, manufacturer, year) VALUES (?, ?, ?, ?)',
                machine.opdb_id,
                machine.name,
                machine.manufacturer,
                machine.manufacture_date
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#fff',
    },
    searchBar: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 10,
    },
    input: {
        flex: 1,
        height: 50,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    item: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    empty: {
        textAlign: 'center',
        color: '#999',
        marginTop: 20,
    },
});
