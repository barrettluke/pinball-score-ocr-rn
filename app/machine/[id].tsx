import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getDatabase } from '../../utils/database';

const THEME = {
    background: '#0d1b2a',
    card: '#1b263b',
    accent: '#00b4d8',
    text: '#e0e1dd',
    textSecondary: '#778da9',
    success: '#28a745',
};

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Score {
    id: number;
    value: number;
    date: string;
}

export default function MachineStatsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [machineName, setMachineName] = useState('Loading...');
    const [bestScore, setBestScore] = useState(0);
    const [avgScore, setAvgScore] = useState(0);
    const [gamesPlayed, setGamesPlayed] = useState(0);
    const [recentScores, setRecentScores] = useState<Score[]>([]);
    const [chartScores, setChartScores] = useState<number[]>([]);

    useEffect(() => {
        if (id) {
            loadMachineStats();
        }
    }, [id]);

    const loadMachineStats = async () => {
        try {
            const db = await getDatabase();

            // 1. Get Machine Name
            const machineRes: any = await db.getAllAsync('SELECT name FROM machines WHERE opdb_id = ?', id);
            if (machineRes.length > 0) {
                setMachineName(machineRes[0].name);
            }

            // 2. Stats (Best, Count, Avg)
            const statsRes: any = await db.getAllAsync(`
                SELECT MAX(value) as best, AVG(value) as avg, COUNT(*) as count 
                FROM scores WHERE machine_id = ?
            `, id);

            if (statsRes.length > 0) {
                setBestScore(statsRes[0].best || 0);
                setAvgScore(statsRes[0].avg || 0);
                setGamesPlayed(statsRes[0].count || 0);
            }

            // 3. Recent Scores (List)
            const listRes: any[] = await db.getAllAsync(`
                SELECT id, value, date FROM scores 
                WHERE machine_id = ? 
                ORDER BY date DESC LIMIT 20
            `, id);
            setRecentScores(listRes);

            // 4. Chart Data (Last 10 reversed)
            const chartRes: any[] = await db.getAllAsync(`
                SELECT value FROM scores 
                WHERE machine_id = ? 
                ORDER BY date DESC LIMIT 10
            `, id);
            setChartScores(chartRes.map(r => r.value).reverse());

        } catch (e) {
            console.error(e);
        }
    };

    const chartData = {
        labels: Array(chartScores.length).fill(''),
        datasets: [{ data: chartScores.length > 0 ? chartScores : [0] }],
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={THEME.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{machineName}</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Top Stats Cards */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>BEST SCORE</Text>
                    <Text style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>
                        {bestScore.toLocaleString()}
                    </Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>AVG SCORE</Text>
                    <Text style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>
                        {Math.round(avgScore).toLocaleString()}
                    </Text>
                </View>
            </View>

            {/* Chart */}
            <View style={styles.chartCard}>
                <Text style={styles.sectionTitle}>Performance Trend</Text>
                <LineChart
                    data={chartData}
                    width={SCREEN_WIDTH - 64}
                    height={180}
                    withDots={true}
                    withInnerLines={false}
                    withOuterLines={false}
                    withHorizontalLabels={false}
                    withVerticalLabels={false}
                    chartConfig={{
                        backgroundGradientFrom: THEME.card,
                        backgroundGradientTo: THEME.card,
                        color: (opacity = 1) => `rgba(0, 180, 216, ${opacity})`,
                        labelColor: () => THEME.textSecondary,
                        strokeWidth: 2,
                        propsForDots: {
                            r: "4",
                            strokeWidth: "2",
                            stroke: THEME.accent
                        }
                    }}
                    bezier
                    style={{ marginTop: 16, paddingRight: 0, paddingLeft: 0 }}
                />
            </View>

            {/* History List */}
            <Text style={styles.sectionTitle}>Recent Games ({gamesPlayed})</Text>
            {recentScores.map((score) => (
                <View key={score.id} style={styles.scoreItem}>
                    <View>
                        <Text style={styles.scoreValue}>{score.value.toLocaleString()}</Text>
                        <Text style={styles.scoreDate}>{new Date(score.date).toLocaleDateString()} {new Date(score.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    <MaterialCommunityIcons name="trophy-variant-outline" size={20} color={score.value >= bestScore ? '#ffd700' : 'transparent'} />
                </View>
            ))}

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
        padding: 16,
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        color: THEME.text,
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: THEME.card,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statLabel: {
        color: THEME.textSecondary,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 8,
    },
    statValue: {
        color: THEME.text,
        fontSize: 20,
        fontWeight: 'bold',
    },
    chartCard: {
        backgroundColor: THEME.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 32,
    },
    sectionTitle: {
        color: THEME.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    scoreItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: THEME.card,
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    scoreValue: {
        color: THEME.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    scoreDate: {
        color: THEME.textSecondary,
        fontSize: 12,
        marginTop: 4,
    }
});
