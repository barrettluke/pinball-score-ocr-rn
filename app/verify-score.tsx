import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getDatabase } from '../utils/database';
import { OPDBMachine, searchMachines } from '../utils/opdb';

export default function VerifyScoreScreen() {
    const { imageUri, ocrValue } = useLocalSearchParams<{ imageUri: string, ocrValue: string }>();
    const [score, setScore] = useState(ocrValue || '');
    const [machines, setMachines] = useState<any[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<OPDBMachine[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const router = useRouter();

    useEffect(() => {
        loadMachines();
    }, []);

    const loadMachines = async () => {
        const db = await getDatabase();
        const result = (await db.getAllAsync('SELECT * FROM machines ORDER BY name ASC')) as any[];
        setMachines(result);
        // Auto-select first if available
        if (result.length > 0 && !selectedMachine) {
            setSelectedMachine(result[0].opdb_id);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        const results = await searchMachines(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
    };

    const handleSelectSearchedMachine = (machine: OPDBMachine) => {
        // Add to local list temporarily (visual only, saved on confirm)
        const newMachine = {
            opdb_id: machine.opdb_id,
            name: machine.name,
            manufacturer: machine.manufacturer,
            year: machine.manufacture_date,
            image_url: machine.image
        };

        // Check if already in list to avoid dupes
        if (!machines.find(m => m.opdb_id === newMachine.opdb_id)) {
            setMachines(prev => [newMachine, ...prev]);
        }

        setSelectedMachine(newMachine.opdb_id);
        setSearchResults([]); // Clear results to show selection
        setSearchQuery('');
    };

    const handleSave = async () => {
        if (!score) {
            Alert.alert('Error', 'Please enter a score.');
            return;
        }
        if (!selectedMachine && machines.length > 0) {
            // If machines exist but none selected (shouldn't happen with auto-select, but checking)
            Alert.alert('Error', 'Please select a machine.');
            return;
        }

        try {
            const db = await getDatabase();

            // 1. Ensure machine exists in DB (for "one-off" searches)
            const machineToSave = machines.find(m => m.opdb_id === selectedMachine);
            if (machineToSave) {
                await db.runAsync(
                    'INSERT OR IGNORE INTO machines (opdb_id, name, manufacturer, year, image_url) VALUES (?, ?, ?, ?, ?)',
                    machineToSave.opdb_id,
                    machineToSave.name,
                    machineToSave.manufacturer,
                    machineToSave.year,
                    machineToSave.image_url
                );
            }

            // 2. Save Score
            await db.runAsync(
                'INSERT INTO scores (value, machine_id, image_uri, date) VALUES (?, ?, ?, ?)',
                parseInt(score.replace(/[^0-9]/g, ''), 10), // Sanitize non-numeric
                selectedMachine,
                imageUri,
                new Date().toISOString()
            );
            Alert.alert('Success', 'Score saved!', [
                { text: 'OK', onPress: () => router.navigate('/(tabs)') }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save score.');
        }
    };

    const handleDeleteMachine = (machineId: string, machineName: string) => {
        Alert.alert(
            'Remove Machine',
            `Are you sure you want to remove "${machineName}" from your list?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const db = await getDatabase();
                            await db.runAsync('DELETE FROM machines WHERE opdb_id = ?', machineId);
                            setMachines(prev => prev.filter(m => m.opdb_id !== machineId));
                            if (selectedMachine === machineId) {
                                setSelectedMachine(null);
                            }
                        } catch (e) {
                            console.error(e);
                            Alert.alert('Error', 'Failed to remove machine.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />

            <View style={styles.form}>
                <Text style={styles.label}>Score:</Text>
                <TextInput
                    style={styles.input}
                    value={score}
                    onChangeText={setScore}
                    keyboardType="numeric"
                    placeholder="ENTER SCORE"
                />

                <Text style={styles.label}>Machine:</Text>

                {/* Instant Search Box */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search OPDB..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={isSearching}>
                        <Text style={styles.searchButtonText}>{isSearching ? '...' : 'Find'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <View style={styles.searchResults}>
                        <Text style={styles.resultsLabel}>Search Results:</Text>
                        {searchResults.map(m => (
                            <TouchableOpacity key={m.opdb_id} style={styles.resultItem} onPress={() => handleSelectSearchedMachine(m)}>
                                <Text style={styles.resultText}>{m.name} ({m.manufacture_date})</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {machines.length === 0 && searchResults.length === 0 ? (
                    <TouchableOpacity onPress={() => router.push('/(tabs)/search')} style={styles.linkButton}>
                        <Text style={styles.linkText}>No saved machines. Search above or click here.</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.machineList}>
                        {machines.map((m) => (
                            <TouchableOpacity
                                key={m.opdb_id}
                                style={[styles.machineOption, selectedMachine === m.opdb_id && styles.selectedMachine]}
                                onPress={() => setSelectedMachine(m.opdb_id)}
                                onLongPress={() => handleDeleteMachine(m.opdb_id, m.name)}
                                delayLongPress={500}
                            >
                                <Text style={[styles.machineText, selectedMachine === m.opdb_id && styles.selectedMachineText]}>
                                    {m.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Save Score</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#fff',
        padding: 20,
    },
    image: {
        width: '100%',
        height: 200,
        borderRadius: 10,
        marginBottom: 20,
    },
    form: {
        gap: 15,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    input: {
        fontSize: 24,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    saveButton: {
        backgroundColor: '#28a745',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    linkButton: {
        padding: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        alignItems: 'center',
    },
    linkText: {
        color: '#007AFF',
    },
    machineList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    machineOption: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ddd',
        backgroundColor: '#f9f9f9',
    },
    selectedMachine: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    machineText: {
        color: '#333',
    },
    selectedMachineText: {
        color: '#fff',
    },
    searchContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 8,
        backgroundColor: '#f9f9f9',
    },
    searchButton: {
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        paddingHorizontal: 15,
        borderRadius: 8,
    },
    searchButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    searchResults: {
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        padding: 5,
    },
    resultsLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 5,
    },
    resultItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    resultText: {
        fontWeight: '600',
    }
});
