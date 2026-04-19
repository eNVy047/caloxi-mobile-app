import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, G, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');


export default function WeekTab({ data, goals }: any) {
  const { colors, isDark } = useTheme();
  const [activeMetric, setActiveMetric] = useState('Calories');
  const metrics = ['Calories', 'Steps', 'Water', 'Sleep'];

  const logs = data?.logs || [];
  const summary = data?.summary || {};

  const safeCalorieGoal = goals?.calorieGoal || 2000;
  const safeStepGoal = goals?.stepGoal || 10000;
  const safeWaterGoal = goals?.waterGoal || 8;
  const safeSleepGoal = goals?.sleepGoal || 8;

  const getMetricData = (metric: string) => {
    return logs.map((log: any) => {
      let y = 0;
      let goal = 1;
      let label = '';
      let gradColors = [colors.error, '#FF7B7B'];

      switch (metric) {
        case 'Calories':
          y = log.caloriesConsumed || 0;
          goal = safeCalorieGoal;
          label = `${y}`;
          break;
        case 'Steps':
          y = log.steps || 0;
          goal = safeStepGoal;
          label = `${y}`;
          break;
        case 'Water':
          y = log.waterGlasses || 0;
          goal = safeWaterGoal;
          label = `${y}`;
          break;
        case 'Sleep':
          y = log.sleepHours || 0;
          goal = safeSleepGoal;
          label = `${y}`;
          break;
      }

      const pct = y / goal;
      if (pct >= 1) gradColors = [colors.secondary, colors.primary];
      else if (pct >= 0.6) gradColors = [colors.secondary, isDark ? 'rgba(0,209,255,0.6)' : 'rgba(0,180,255,0.6)'];
      else if (pct >= 0.3) gradColors = [colors.secondary, isDark ? 'rgba(0,209,255,0.2)' : 'rgba(0,180,255,0.2)'];
      else gradColors = [colors.error, isDark ? '#E05252' : '#FF4B4B'];

      return {
        x: format(parseISO(log.date), 'EEE'),
        y,
        pct: Math.min(pct, 1.2), // Allow slight overflow for visual flair, but will cap rect
        fillColors: gradColors,
        label,
        goal
      };
    });
  };

  const chartData = getMetricData(activeMetric);

  // Chart setup
  const chartHeight = 220;
  const chartWidth = width - 24;
  const barWidth = 24;
  const spacing = (chartWidth - (chartData.length * barWidth)) / (chartData.length + 1);

  // Summaries
  const avgCals = logs.length > 0 ? Math.round(logs.reduce((sum: number, l: any) => sum + (l.caloriesConsumed || 0), 0) / logs.length) : 0;
  const totalSteps = logs.reduce((sum: number, l: any) => sum + (l.steps || 0), 0);
  const avgSleep = logs.length > 0 ? (logs.reduce((sum: number, l: any) => sum + (l.sleepHours || 0), 0) / logs.length).toFixed(1) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.streakIconWrap, { backgroundColor: colors.secondary }]}>
          <Ionicons name="flame" size={28} color={colors.pillText} />
        </View>
        <View>
          <Text style={[styles.streakTitle, { color: colors.text }]}>{summary.currentStreak || 0} Day Streak!</Text>
          <Text style={[styles.streakSub, { color: colors.textSecondary }]}>You&apos;re on fire! Keep hitting those goals.</Text>
        </View>
      </View>

      <View style={styles.chipContainer}>
        {metrics.map(m => (
          <TouchableOpacity
            key={m}
            style={[
              styles.chip,
              { backgroundColor: colors.card, borderColor: colors.border },
              activeMetric === m && [styles.activeChip, { backgroundColor: colors.secondary, borderColor: colors.secondary }]
            ]}
            onPress={() => setActiveMetric(m)}
          >
            <Text style={[
              styles.chipText,
              { color: activeMetric === m ? colors.pillText : colors.textSecondary }
            ]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]} >
        <Svg width={chartWidth} height={chartHeight + 40}>
          <Defs>
            {chartData.map((d: any, i: number) => (
              <LinearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={d.fillColors[0]} />
                <Stop offset="1" stopColor={d.fillColors[1]} />
              </LinearGradient>
            ))}
          </Defs>

          {/* Grid Lines */}
          {[0.25, 0.5, 0.75, 1].map((p, idx) => (
            <Line
              key={idx}
              x1="0"
              y1={chartHeight - (p * (chartHeight - 40))}
              x2={chartWidth}
              y2={chartHeight - (p * (chartHeight - 40))}
              stroke={colors.border}
              strokeWidth="1"
              strokeDasharray="4, 4"
            />
          ))}

          {chartData.map((d: any, i: number) => {
            const xOffset = spacing + (i * (barWidth + spacing));
            const availableHeight = chartHeight - 40;
            const barHeight = Math.min(d.pct, 1) * availableHeight;
            const yOffset = chartHeight - barHeight;

            return (
              <G key={i}>
                {/* Background Track */}
                <Rect
                  x={xOffset}
                  y={40}
                  width={barWidth}
                  height={availableHeight}
                  fill={colors.divider}
                  rx={barWidth / 2}
                />

                {/* Active Bar */}
                {barHeight > 0 && (
                  <Rect
                    x={xOffset}
                    y={yOffset}
                    width={barWidth}
                    height={barHeight}
                    fill={`url(#grad-${i})`}
                    rx={barWidth / 2}
                  />
                )}

                <SvgText
                  x={xOffset + barWidth / 2}
                  y={chartHeight + 20}
                  fontSize="10"
                  fontWeight="600"
                  fill={colors.textSecondary}
                  textAnchor="middle"
                >
                  {d.x.toUpperCase()}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard title="Avg Calories" val={`${avgCals}`} unit="kcal" icon="flame-outline" color="#F97316" />
        <SummaryCard title="Total Steps" val={totalSteps.toLocaleString()} unit="steps" icon="walk-outline" color="#A855F7" />
        {activeMetric === 'Steps' && (
          <>
            <SummaryCard title="Est. Distance" val={(totalSteps * 0.0008).toFixed(2)} unit="km" icon="navigate-outline" color="#3B82F6" />
            <SummaryCard title="Est. Burned" val={Math.round(totalSteps * 0.04)} unit="kcal" icon="flash-outline" color="#FACC15" />
          </>
        )}
        <SummaryCard title="Avg Sleep" val={`${avgSleep}`} unit="hrs" icon="moon-outline" color="#6366F1" />
      </View>
    </View>
  );
}

const SummaryCard = ({ title, val, unit, icon, color }: any) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.summaryIconBox, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.summaryContent}>
        <Text style={[styles.cardVal, { color: colors.text }]}>{val}<Text style={[styles.cardUnit, { color: colors.textSecondary }]}> {unit}</Text></Text>
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>{title}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    marginTop: 10
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  streakIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  streakSub: {
    fontSize: 12,
    marginTop: 2,
  },
  chipContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 30,
    borderWidth: 1.5,
  },
  activeChip: {},
  chipText: {
    fontWeight: '600',
    fontSize: 13,
  },
  activeChipText: {},
  chartCard: {
    borderRadius: 30,
    padding: 20,
    paddingBottom: 10,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 3,
    marginBottom: 24,
    alignItems: 'center',
  },
  summaryGrid: {
    gap: 12,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  summaryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryContent: {
    flex: 1,
  },
  cardVal: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardUnit: {
    fontSize: 12,
    fontWeight: '400',
  },
  cardTitle: {
    fontSize: 12,
    marginTop: 2,
  },
});

