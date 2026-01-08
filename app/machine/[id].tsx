import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
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

interface ChartScore {
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
    const [chartScores, setChartScores] = useState<ChartScore[]>([]);
    const [selectedPoint, setSelectedPoint] = useState<{ index: number; x: number; y: number } | null>(null);

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

            // 4. Chart Data (Last 10 reversed) - include date for labels
            const chartRes: any[] = await db.getAllAsync(`
                SELECT value, date FROM scores 
                WHERE machine_id = ? 
                ORDER BY date DESC LIMIT 10
            `, id);
            setChartScores(chartRes.map(r => ({ value: r.value, date: r.date })).reverse());

        } catch (e) {
            console.error(e);
        }
    };

    // Format Y-axis labels (abbreviated scores like 1.2M, 500K)
    const formatScore = (yValue: string): string => {
        const score = parseFloat(yValue);
        if (isNaN(score)) return yValue;
        if (score >= 1_000_000_000) return `${(score / 1_000_000_000).toFixed(1)}B`;
        if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
        if (score >= 1_000) return `${(score / 1_000).toFixed(0)}K`;
        return score.toString();
    };

    // Format X-axis labels (short date)
    const getChartLabels = (): string[] => {
        if (chartScores.length === 0) return [''];
        // Show first, middle, last labels to avoid crowding
        return chartScores.map((s, i) => {
            if (i === 0 || i === chartScores.length - 1 || i === Math.floor(chartScores.length / 2)) {
                const d = new Date(s.date);
                return `${d.getMonth() + 1}/${d.getDate()}`;
            }
            return '';
        });
    };

    const chartData = {
        labels: getChartLabels(),
        datasets: [{ data: chartScores.length > 0 ? chartScores.map(s => s.value) : [0] }],
    };

    const handleDataPointClick = (data: { index: number; x: number; y: number; value: number }) => {
        setSelectedPoint({ index: data.index, x: data.x, y: data.y });
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

                {chartScores.length === 0 ? (
                    <Text style={styles.chartHint}>No scores yet - play some games!</Text>
                ) : (
                    <>
                        <Text style={styles.chartHint}>Tap or slide to see details</Text>
                        <LineChart
                            data={chartScores.map((s, i) => ({
                                value: s.value,
                                label: i === 0 || i === chartScores.length - 1 ?
                                    `${new Date(s.date).getMonth() + 1}/${new Date(s.date).getDate()}` : '',
                                dataPointLabelComponent: () => null,
                            }))}
                            width={SCREEN_WIDTH - 80}
                            height={180}
                            curved
                            areaChart
                            color={THEME.accent}
                            startFillColor={THEME.accent}
                            endFillColor={THEME.card}
                            startOpacity={0.4}
                            endOpacity={0.1}
                            thickness={3}
                            dataPointsColor={THEME.accent}
                            dataPointsRadius={6}
                            xAxisLabelTextStyle={{ color: THEME.textSecondary, fontSize: 10 }}
                            yAxisTextStyle={{ color: THEME.textSecondary, fontSize: 10 }}
                            yAxisLabelWidth={50}
                            formatYLabel={formatScore}
                            hideRules
                            backgroundColor={THEME.card}
                            xAxisColor={'rgba(255,255,255,0.1)'}
                            yAxisColor={'rgba(255,255,255,0.1)'}
                            noOfSections={4}
                            maxValue={Math.max(...chartScores.map(d => d.value)) * 1.1}
                            spacing={(SCREEN_WIDTH - 130) / Math.max(chartScores.length - 1, 1)}
                            initialSpacing={15}
                            endSpacing={15}
                            pointerConfig={{
                                pointerStripHeight: 160,
                                pointerStripColor: 'rgba(0,180,216,0.3)',
                                pointerStripWidth: 2,
                                pointerColor: THEME.accent,
                                radius: 8,
                                pointerLabelWidth: 120,
                                pointerLabelHeight: 60,
                                activatePointersOnLongPress: false,
                                autoAdjustPointerLabelPosition: true,
                                pointerLabelComponent: (items: any) => {
                                    const item = items[0];
                                    const idx = chartScores.findIndex(s => s.value === item.value);
                                    const dateStr = idx >= 0 ? new Date(chartScores[idx].date).toLocaleDateString(undefined, {
                                        month: 'short', day: 'numeric'
                                    }) : '';
                                    return (
                                        <View style={{
                                            backgroundColor: THEME.accent,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 8,
                                            marginBottom: 6,
                                        }}>
                                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                                                {item.value.toLocaleString()}
                                            </Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                                                {dateStr}
                                            </Text>
                                        </View>
                                    );
                                },
                            }}
                        />
                    </>
                )}
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
    },
    chartHint: {
        color: THEME.textSecondary,
        fontSize: 12,
        marginBottom: 8,
    },
    tooltip: {
        position: 'absolute',
        backgroundColor: THEME.accent,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        zIndex: 10,
    },
    tooltipScore: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    tooltipDate: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
    },
    selectedInfo: {
        backgroundColor: THEME.accent,
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
        alignItems: 'center',
    },
    selectedScore: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    selectedDate: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        marginTop: 4,
    }
});
