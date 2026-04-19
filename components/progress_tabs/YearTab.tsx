import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import Svg, { Rect, G, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function YearTab({ data }: any) {
  const { colors, isDark } = useTheme();
  const [activeMetric, setActiveMetric] = useState('avgCalories');

  const metrics = [
    { key: 'avgCalories', label: 'Calories', color: '#F97316', icon: 'flame' },
    { key: 'avgSteps', label: 'Steps', color: '#A855F7', icon: 'walk' },
    { key: 'avgWeight', label: 'Weight', color: '#10B981', icon: 'body' },
    { key: 'avgSleep', label: 'Sleep', color: '#6366F1', icon: 'moon' },
    { key: 'avgWater', label: 'Water', color: '#3B82F6', icon: 'water' },
  ];

  const logs = data?.logs || [];
  const activeMetricObj = metrics.find(m => m.key === activeMetric) || metrics[0];
  const activeColor = activeMetricObj.color;

  // Summaries
  const totalStepsYear = logs.reduce((sum: number, l: any) => sum + (l.totalSteps || 0), 0);
  const avgCalsYear = logs.length > 0 ? Math.round(logs.reduce((sum: number, l: any) => sum + (l.avgCalories || 0), 0) / logs.length) : 0;

  const startWeight = logs.find((l: any) => l.weightAtMonthEnd)?.weightAtMonthEnd || 0;
  const endWeight = logs.length > 0 ? logs[logs.length - 1].weightAtMonthEnd || 0 : 0;
  const weightChange = endWeight - startWeight;

  const bestMonth = [...logs].sort((a: any, b: any) => (b.avgSteps || 0) - (a.avgSteps || 0))[0]?.month || '-';

  // Bar Chart Configuration
  const chartHeight = 200;
  const chartWidth = SCREEN_WIDTH - 24; // Align with 12px side padding
  const barWidth = (chartWidth / 12) - 8;
  const barGap = 8;

  const validLogs = logs.filter((log: any) => log[activeMetric] !== undefined);
  const maxValue = validLogs.length > 0 ? Math.max(...validLogs.map((l: any) => l[activeMetric])) : 100;
  const scaleY = (val: number) => (val / (maxValue || 1)) * (chartHeight - 40);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>

      {/* METRIC SELECTOR CHIPS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        {metrics.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[
              styles.chip,
              activeMetric === m.key ? { backgroundColor: m.color, borderColor: m.color } : { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            onPress={() => setActiveMetric(m.key)}
          >
            <Ionicons name={m.icon as any} size={16} color={activeMetric === m.key ? '#FFF' : colors.textSecondary} />
            <Text style={[styles.chipText, { color: activeMetric === m.key ? '#FFF' : colors.textSecondary }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* MODERN BAR CHART CARD */}
      <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>{activeMetricObj.label} Trends</Text>
          <Text style={[styles.chartSub, { color: colors.textSecondary }]}>Monthly Averages</Text>
        </View>

        <View style={styles.chartWrapper}>
          <Svg width={chartWidth} height={chartHeight}>
            <Defs>
              <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={activeColor} stopOpacity="1" />
                <Stop offset="1" stopColor={activeColor} stopOpacity="0.4" />
              </LinearGradient>
            </Defs>

            {/* Render Bars for 12 months */}
            {Array.from({ length: 12 }).map((_, i) => {
              const monthLabel = formatMonthLabel(i + 1);
              const log = logs.find((l: any) => l.month?.endsWith(`-${String(i + 1).padStart(2, '0')}`));
              const val = log ? log[activeMetric] : 0;
              const barHeight = scaleY(val);
              const x = i * (barWidth + barGap) + (barGap / 2);

              return (
                <G key={i}>
                  {/* Background Track */}
                  <Rect
                    x={x}
                    y={0}
                    width={barWidth}
                    height={chartHeight - 30}
                    rx={barWidth / 2}
                    fill={isDark ? '#222' : '#F0F0F0'}
                    opacity={0.5}
                  />
                  {/* Data Bar */}
                  <Rect
                    x={x}
                    y={chartHeight - 30 - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={barWidth / 2}
                    fill="url(#barGrad)"
                  />
                  {/* Month Text */}
                  <SvgText
                    x={x + barWidth / 2}
                    y={chartHeight - 5}
                    fontSize="10"
                    fontWeight="bold"
                    fill={colors.textMuted}
                    textAnchor="middle"
                  >
                    {monthLabel}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
      </View>

      {/* EQUAL SIZE SUMMARY GRID */}
      <View style={styles.gridContainer}>
        <View style={styles.statsRow}>
          <SummaryCard
            title="Yearly Steps"
            val={totalStepsYear.toLocaleString()}
            icon="walk"
            color="#A855F7"
            unit="steps"
          />
          <SummaryCard
            title="Avg Calories"
            val={avgCalsYear.toString()}
            icon="flame"
            color="#F97316"
            unit="kcal"
          />
        </View>
        <View style={styles.statsRow}>
          <SummaryCard
            title="Weight Delta"
            val={`${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)}`}
            icon="analytics"
            color="#10B981"
            unit="kg"
          />
          <SummaryCard
            title="Peak Month"
            val={bestMonth.substring(5, 7)}
            icon="trophy"
            color="#3B82F6"
            unit="month"
          />
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const formatMonthLabel = (m: number) => {
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  return months[m - 1];
};

const SummaryCard = ({ title, val, icon, color, unit }: any) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.cardIconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.cardVal, { color: colors.text }]}>{val}</Text>
      <Text style={[styles.cardUnit, { color: colors.textSecondary }]}>{unit.toUpperCase()}</Text>
      <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0 },
  chipScroll: { paddingBottom: 16, paddingTop: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 10,
  },
  chipText: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
  chartCard: {
    borderRadius: 30,
    padding: 20,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  chartHeader: { marginBottom: 20 },
  chartTitle: { fontSize: 18, fontWeight: '900' },
  chartSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  chartWrapper: { alignItems: 'center' },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: (SCREEN_WIDTH - 36) / 2, // (SCREEN_WIDTH - (12 * 2) - 12) / 2
    padding: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    aspectRatio: 1,
    justifyContent: 'center',
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardVal: { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  cardUnit: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 2, marginBottom: 4 },
  cardLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
});
