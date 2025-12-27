import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScoreGraph from '../../components/ScoreGraph';
import { getDatabase } from '../../utils/database';

interface Score {
    id: number;
    value: number;
    machine_id: string;
    machine_name: string;
    date: string;
}

interface MachineScores {
    [key: string]: {
        name: string;
        scores: { value: number; date: string }[];
    };
}

export default function DashboardScreen() {
    const [recentScores, setRecentScores] = useState<Score[]>([]);
    const [machineStats, setMachineStats] = useState<MachineScores>({});
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const db = await getDatabase();

            // Get Recent Scores
            const scores: any[] = await db.getAllAsync(`
        SELECT s.id, s.value, s.date, s.machine_id, m.name as machine_name 
        FROM scores s 
        JOIN machines m ON s.machine_id = m.opdb_id 
        ORDER BY s.date DESC 
        LIMIT 10
      `);
            setRecentScores(scores);

            // Get All Scores for Graphs
            const allScores: any[] = await db.getAllAsync(`
        SELECT s.value, s.date, s.machine_id, m.name as machine_name 
        FROM scores s 
        JOIN machines m ON s.machine_id = m.opdb_id 
        ORDER BY s.date ASC
      `);

            const stats: MachineScores = {};
            allScores.forEach(s => {
                if (!stats[s.machine_id]) {
                    stats[s.machine_id] = { name: s.machine_name, scores: [] };
                }
                stats[s.machine_id].scores.push({ value: s.value, date: s.date });
            });
            setMachineStats(stats);

        } catch (e) {
            console.error(e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Scores</Text>
                {recentScores.length === 0 ? (
                    <Text style={styles.emptyText}>No scores yet. Go scan some!</Text>
                ) : (
                    recentScores.map((score) => (
                        <View key={score.id} style={styles.scoreItem}>
                            <Text style={styles.machineName}>{score.machine_name}</Text>
                            <Text style={styles.scoreValue}>{score.value.toLocaleString()}</Text>
                            <Text style={styles.date}>{new Date(score.date).toLocaleDateString()}</Text>
                        </View>
                    ))
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance</Text>
                {Object.values(machineStats).map((machine) => (
                    <ScoreGraph key={machine.name} machineName={machine.name} scores={machine.scores} />
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    section: {
        padding: 16,
        backgroundColor: '#fff',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    scoreItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    machineName: {
        flex: 2,
        fontSize: 16,
        fontWeight: '500',
    },
    scoreValue: {
        flex: 1,
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'right',
    },
    date: {
        flex: 1,
        fontSize: 14,
        color: '#888',
        textAlign: 'right',
    },
    emptyText: {
        fontStyle: 'italic',
        color: '#666',
    },
});
