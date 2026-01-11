import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { PinballSVG } from '../../components/ui/PinballSVG';
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
  machine_id: string;
  machine_name: string;
  date: string;
}

interface MachineBest {
  machine_id: string; // Add this
  machine_name: string;
  machine_image: string | null;
  best_score: number;
  last_played: string;
  trend: 'up' | 'down' | 'neutral';
}

export default function DashboardScreen() {
  const router = useRouter();
  const [totalGames, setTotalGames] = useState(0);
  const [allTimeBest, setAllTimeBest] = useState<{ value: number, machine: string } | null>(null);
  const [topMachines, setTopMachines] = useState<MachineBest[]>([]);
  const [last10Scores, setLast10Scores] = useState<number[]>([]);
  const [improvement, setImprovement] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Default chart data if no scores
  const chartData = {
    labels: Array(10).fill(''),
    datasets: [{ data: last10Scores.length > 0 ? last10Scores.reverse() : [0, 0, 0, 0, 0] }],
  };

  const loadData = async () => {
    try {
      const db = await getDatabase();

      // 1. Total Games Played
      const countRes: any = await db.getAllAsync('SELECT COUNT(*) as count FROM scores');
      setTotalGames(countRes[0]?.count || 0);

      // 2. All-Time Best Score
      const bestRes: any = await db.getAllAsync(`
        SELECT s.value, m.name 
        FROM scores s 
        JOIN machines m ON s.machine_id = m.opdb_id 
        ORDER BY s.value DESC 
        LIMIT 1
      `);
      if (bestRes.length > 0) {
        setAllTimeBest({ value: bestRes[0].value, machine: bestRes[0].name });
      }

      // 3. Last 20 Scores (for Chart + Improvement calc)
      const last20Res: any[] = await db.getAllAsync('SELECT value FROM scores ORDER BY date DESC LIMIT 20');
      const last20Scores = last20Res.map(r => r.value);
      setLast10Scores(last20Scores.slice(0, 10));

      // Calculate improvement: compare last 10 avg vs previous 10 avg
      if (last20Scores.length >= 15) {
        const recentAvg = last20Scores.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
        const previousAvg = last20Scores.slice(10, 20).reduce((a, b) => a + b, 0) / Math.min(10, last20Scores.length - 10);
        if (previousAvg > 0) {
          const pctChange = ((recentAvg - previousAvg) / previousAvg) * 100;
          setImprovement(Math.round(pctChange));
        } else {
          setImprovement(null);
        }
      } else {
        setImprovement(null);
      }

      // 4. Top Machines Summary
      // This complex query gets the MAX score for each machine
      const topRes: any[] = await db.getAllAsync(`
        SELECT m.opdb_id, m.name, m.image_url, MAX(s.value) as best, MAX(s.date) as last_date
        FROM scores s
        JOIN machines m ON s.machine_id = m.opdb_id
        GROUP BY m.opdb_id, m.name, m.image_url
        ORDER BY last_date DESC
        LIMIT 5
      `);

      setTopMachines(topRes.map(r => ({
        machine_id: r.opdb_id,
        machine_name: r.name,
        machine_image: r.image_url,
        best_score: r.best,
        last_played: r.last_date,
        trend: 'neutral'
      })));

    } catch (e) {
      console.error(e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>Wizard</Text>
        </View>

      </View>

      {/* Stats Cards Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <MaterialCommunityIcons name="trophy" size={24} color="#f9c74f" />
          </View>
          <Text style={styles.statLabel}>ALL-TIME BEST</Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {allTimeBest ? allTimeBest.value.toLocaleString() : '-'}
          </Text>
          <Text style={styles.statSubtext} numberOfLines={1}>
            {allTimeBest ? allTimeBest.machine : 'No scores yet'}
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: 'rgba(0, 180, 216, 0.2)' }]}>
            <PinballSVG width={24} height={24} color={THEME.accent} />
          </View>
          <Text style={styles.statLabel}>GAMES PLAYED</Text>
          <Text style={styles.statValue}>{totalGames}</Text>
        </View>
      </View>

      {/* Call To Action */}
      <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/scan')}>
        <MaterialCommunityIcons name="plus-circle" size={24} color="#fff" />
        <Text style={styles.ctaText}>Log New Score</Text>
      </TouchableOpacity>

      {/* Performance Trend */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Performance Trend</Text>
      </View>
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartLabel}>Avg. Score (Last 10)</Text>
            <Text style={styles.chartValue}>
              {last10Scores.length > 0
                ? (last10Scores.reduce((a, b) => a + b, 0) / last10Scores.length).toLocaleString(undefined, { maximumFractionDigits: 0 })
                : '0'}
            </Text>
          </View>
          {improvement !== null && (
            <View style={[styles.badge, improvement < 0 && { backgroundColor: 'rgba(220, 53, 69, 0.2)' }]}>
              <Text style={[styles.badgeText, improvement < 0 && { color: '#dc3545' }]}>
                {improvement >= 0 ? '+' : ''}{improvement}%
              </Text>
            </View>
          )}
        </View>

        <LineChart
          data={chartData}
          width={SCREEN_WIDTH - 64}
          height={100}
          withDots={false}
          withInnerLines={false}
          withOuterLines={false}
          withHorizontalLabels={false}
          withVerticalLabels={false}
          chartConfig={{
            backgroundGradientFrom: THEME.card,
            backgroundGradientTo: THEME.card,
            color: (opacity = 1) => `rgba(0, 180, 216, ${opacity})`,
            strokeWidth: 3,
          }}
          bezier
          style={{ paddingRight: 0, paddingLeft: 0 }}
        />

        <View style={styles.chartFooter}>
          <Text style={styles.chartFooterText}>JAN 1</Text>
          <Text style={styles.chartFooterText}>TODAY</Text>
        </View>
      </View>

      {/* Top Machine Records */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Machine Records</Text>
      </View>

      {topMachines.length === 0 ? (
        <View style={[styles.listCard, { alignItems: 'center', padding: 20 }]}>
          <Text style={{ color: THEME.textSecondary }}>No records found</Text>
        </View>
      ) : (
        topMachines.map((m, index) => (
          <TouchableOpacity key={index} style={styles.listCard} onPress={() => router.push(`/machine/${m.machine_id}`)}>
            <View style={styles.machineIcon}>
              {m.machine_image ? (
                <Image source={{ uri: m.machine_image }} style={{ width: '100%', height: '100%', borderRadius: 8 }} contentFit="cover" />
              ) : (
                <MaterialCommunityIcons name="gamepad-circle" size={24} color={THEME.textSecondary} />
              )}
            </View>
            <View style={styles.listContent}>
              <Text style={styles.listTitle}>{m.machine_name}</Text>
              <Text style={styles.listSubtitle}>{m.best_score.toLocaleString()}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={THEME.textSecondary} />
          </TouchableOpacity>
        ))
      )}

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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    color: THEME.textSecondary,
    fontSize: 14,
  },
  username: {
    color: THEME.text,
    fontSize: 24,
    fontWeight: 'bold',
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(249, 199, 79, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    color: THEME.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statSubtext: {
    color: THEME.textSecondary,
    fontSize: 12,
  },
  ctaButton: {
    backgroundColor: THEME.accent,
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkText: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: THEME.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  chartLabel: {
    color: THEME.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  chartValue: {
    color: THEME.text,
    fontSize: 32,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: THEME.success,
    fontSize: 12,
    fontWeight: 'bold',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartFooterText: {
    color: THEME.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  listCard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  machineIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    color: THEME.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  listSubtitle: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
