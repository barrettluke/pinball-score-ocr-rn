import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getDatabase } from '../utils/database';

export default function VerifyScoreScreen() {
    const { imageUri, ocrValue } = useLocalSearchParams<{ imageUri: string, ocrValue: string }>();
    const [score, setScore] = useState(ocrValue || '');
    const [machines, setMachines] = useState<any[]>([]);
    const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        loadMachines();
    }, []);

    const loadMachines = async () => {
        const db = await getDatabase();
        const result = (await db.getAllAsync('SELECT * FROM machines ORDER BY name ASC')) as any[];
        setMachines(result);
        // Auto-select first if available
        if (result.length > 0) {
            setSelectedMachine(result[0].opdb_id);
        }
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
            await db.runAsync(
                'INSERT INTO scores (value, machine_id, image_uri, date) VALUES (?, ?, ?, ?)',
                parseInt(score.replace(/[^0-9]/g, ''), 10), // Sanitize non-numeric
                selectedMachine,
                imageUri,
                new Date().toISOString()
            );
            Alert.alert('Success', 'Score saved!', [
                { text: 'OK', onPress: () => router.navigate('/(tabs)/dashboard') }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to save score.');
        }
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
                {machines.length === 0 ? (
                    <TouchableOpacity onPress={() => router.push('/(tabs)/search')} style={styles.linkButton}>
                        <Text style={styles.linkText}>No machines found. Tap to add one.</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.machineList}>
                        {machines.map((m) => (
                            <TouchableOpacity
                                key={m.opdb_id}
                                style={[styles.machineOption, selectedMachine === m.opdb_id && styles.selectedMachine]}
                                onPress={() => setSelectedMachine(m.opdb_id)}
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
});
