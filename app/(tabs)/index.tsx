import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { PinballSVG } from '../../components/ui/PinballSVG';
import { THEME } from '../../constants/theme';
import { getDatabase } from '../../utils/database';



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

const PerformanceChart = React.memo(({ last10Scores, improvement }: { last10Scores: number[], improvement: number | null }) => {
  // Prepare Data
  const rawData = last10Scores.length > 0 ? last10Scores.slice().reverse() : [0];
  const average = rawData.reduce((a, b) => a + b, 0) / rawData.length;

  const lineData = rawData.map(val => ({
    value: val,
    dataPointText: val.toString(),
    textColor: THEME.textSecondary,
    textShiftY: -8,
    textShiftX: 0,
    textFontSize: 10,
  }));

  // Calculate spacing to ensure fit
  // We need to account for initialSpacing (20) AND end padding for the last dot/label.
  // Reduce total width by 60 to be safe.
  const availableWidth = SCREEN_WIDTH - 64;
  const computedSpacing = (availableWidth - 60) / Math.max(rawData.length - 1, 1);
  const maxScore = Math.max(...rawData);

  const avgData = rawData.map((_, i) => ({
    value: average,
    // Dynamic Positioning for Start:
    // Check collision with the FIRST point (index 0)
    dataPointText: i === 0 ? 'Avg' : '',
    textColor: 'rgba(255,255,255,0.5)',
    textShiftY: (rawData[0] > average) ? 25 : -25,
    textShiftX: 0,
    textFontSize: 10,
  }));

  return (
    <>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartLabel}>Scores vs Average (Last {rawData.length})</Text>
          <Text style={styles.chartValue}>
            {last10Scores.length > 0
              ? average.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : '0'}
          </Text>
        </View>
        {improvement !== null && (
          <View style={[styles.badge, improvement < 0 && styles.badgeNegative]}>
            <Text style={[styles.badgeText, improvement < 0 && styles.badgeTextNegative]}>
              {improvement >= 0 ? '+' : ''}{improvement}%
            </Text>
          </View>
        )}
      </View>

      <View style={{ overflow: 'visible' }}>
        <LineChart
          data={lineData}
          data2={avgData}
          height={140}
          width={availableWidth}
          maxValue={maxScore * 1.1} // Add 10% headroom for labels
          spacing={computedSpacing}
          initialSpacing={20}
          color1={THEME.accent}
          color2="rgba(255,255,255,0.3)"
          strokeDashArray2={[10, 5]}
          thickness1={3}
          thickness2={2}
          dataPointsColor1={THEME.accent}
          dataPointsColor2="rgba(255,255,255,0.0)"
          hideDataPoints2={false}
          curved
          curveType={0}
          hideRules
          hideYAxisText
          hideAxesAndRules
          yAxisThickness={0}
          xAxisThickness={0}
          isAnimated
          animationDuration={1200}
          disableScroll
        />
      </View>

      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterText}>PAST</Text>
        <Text style={styles.chartFooterText}>TODAY</Text>
      </View>
    </>
  );
});

export default function DashboardScreen() {
  const router = useRouter();
  const [totalGames, setTotalGames] = useState(0);
  const [allTimeBest, setAllTimeBest] = useState<{ value: number, machine: string } | null>(null);
  const [topMachines, setTopMachines] = useState<MachineBest[]>([]);
  const [last10Scores, setLast10Scores] = useState<number[]>([]);
  const [recentActivity, setRecentActivity] = useState<Score[]>([]);
  const [showRecent, setShowRecent] = useState(true);
  const [improvement, setImprovement] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);



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

      // 4. Recent Activity Feed (Last 3)
      const recentRes: any[] = await db.getAllAsync(`
        SELECT s.id, s.value, s.machine_id, m.name as machine_name, s.date
        FROM scores s
        LEFT JOIN machines m ON s.machine_id = m.opdb_id
        ORDER BY s.date DESC
        LIMIT 3
      `);
      setRecentActivity(recentRes);

      // 5. Top Machines Summary
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
          <View style={[styles.statIconContainer, styles.statIconContainerAlt]}>
            <PinballSVG width={24} height={24} color={THEME.accent} />
          </View>
          <Text style={styles.statLabel}>GAMES PLAYED</Text>
          <Text style={styles.statValue}>{totalGames}</Text>
        </View>
      </View>



      {/* Performance Trend */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Performance Trend</Text>
      </View>
      <View style={styles.chartCard}>
        <PerformanceChart last10Scores={last10Scores} improvement={improvement} />
      </View>

      {/* Recent Activity Feed */}
      {
        recentActivity.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowRecent(!showRecent)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <MaterialCommunityIcons
                name={showRecent ? "chevron-up" : "chevron-down"}
                size={24}
                color={THEME.textSecondary}
              />
            </TouchableOpacity>

            {showRecent && (
              <View style={styles.recentList}>
                {recentActivity.map((score) => (
                  <View key={score.id} style={styles.recentItem}>
                    <View style={styles.recentDateBox}>
                      <Text style={styles.recentDateText}>
                        {new Date(score.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                      <Text style={styles.recentTimeText}>
                        {new Date(score.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentMachine} numberOfLines={1}>
                        {score.machine_name || 'Unknown Machine'}
                      </Text>
                      <Text style={styles.recentScore}>
                        {score.value.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )
      }

      {/* Top Machine Records */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Machine Records</Text>
      </View>

      {
        topMachines.length === 0 ? (
          <View style={styles.listCardEmpty}>
            <Text style={styles.emptyText}>No records found</Text>
          </View>
        ) : (
          topMachines.map((m, index) => (
            <TouchableOpacity key={index} style={styles.listCard} onPress={() => router.push(`/machine/${m.machine_id}`)}>
              <View style={styles.machineIcon}>
                {m.machine_image ? (
                  <Image source={{ uri: m.machine_image }} style={styles.machineImage} contentFit="cover" />
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
        )
      }

    </ScrollView >
  );
}

import { styles } from '../../styles/dashboard.styles';
