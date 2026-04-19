import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  withDelay,
  useAnimatedStyle,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_COLORS = {
  calories: ['#00D1FF', '#00BFFF'],
  burnt: ['#FFD700', '#FFA500'],
  water: ['#4FACFE', '#00F2FE'],
  steps: ['#BB86FC', '#9C27B0'],
  protein: ['#FF4081', '#E91E63'],
};

interface RingProps {
  progress: number;
  size: number;
  strokeWidth: number;
  colors: string[];
  radius: number;
  index: number;
}

const ProgressRing = ({ progress, size, strokeWidth, colors, radius, index }: RingProps) => {
  const { isDark } = useTheme();
  const animatedProgress = useSharedValue(0);
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    animatedProgress.value = withDelay(index * 150, withTiming(progress, { duration: 1200 }));
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  const gradId = `grad-${index}`;

  return (
    <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={colors[0]} />
          <Stop offset="100%" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors[0]}
        strokeWidth={strokeWidth}
        fill="transparent"
        opacity={isDark ? 0.1 : 0.05}
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={`${circumference} ${circumference}`}
        animatedProps={animatedProps}
        strokeLinecap="round"
      />
    </G>
  );
};

const StatCard = ({ label, val, goal, icon, colors: gradColors, index }: any) => {
  const { colors, isDark } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(index * 100 + 500, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(index * 100 + 500, withTiming(0, { duration: 600 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const progress = Math.min(val / goal, 1);

  return (
    <Animated.View style={[
      styles.statCard, 
      { backgroundColor: colors.card, borderColor: colors.border },
      animatedStyle
    ]}>
      <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.divider }]}>
        <Ionicons name={icon} size={22} color={gradColors[0]} />
      </View>
      
      <View style={styles.cardInfo}>
        <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.cardVal, { color: colors.text }]}>{val.toLocaleString()}</Text>
        <Text style={[styles.cardGoal, { color: colors.textMuted }]}>Goal: {goal.toLocaleString()}</Text>
      </View>

      <View style={styles.miniProgressContainer}>
        <View style={[styles.miniProgressBar, { backgroundColor: isDark ? '#222' : colors.divider }]}>
          <View style={[styles.miniProgressFill, { backgroundColor: gradColors[0], width: `${progress * 100}%` }]} />
        </View>
      </View>
    </Animated.View>
  );
};

export default function TodayTab({ data, goals }: any) {
  const { colors, isDark } = useTheme();
  const latestLog = data?.logs?.[0] || {};
  
  const metrics = React.useMemo(() => [
    { id: 'calories', label: 'Consumed', val: latestLog.caloriesConsumed || 0, goal: goals?.calorieGoal || 2000, colors: RING_COLORS.calories, icon: 'nutrition' },
    { id: 'burnt', label: 'Burnt', val: latestLog.caloriesBurnt || 0, goal: goals?.caloriesBurntGoal || 300, colors: RING_COLORS.burnt, icon: 'flame' },
    { id: 'water', label: 'Water', val: latestLog.waterGlasses || 0, goal: goals?.waterGoal || 8, colors: RING_COLORS.water, icon: 'water' },
    { id: 'steps', label: 'Steps', val: latestLog.steps || 0, goal: goals?.stepGoal || 10000, colors: RING_COLORS.steps, icon: 'walk' },
    { id: 'protein', label: 'Protein', val: latestLog.proteinConsumed || 0, goal: goals?.proteinGoal || 150, colors: RING_COLORS.protein, icon: 'fitness' },
  ], [latestLog, goals]);

  const { overallPct, message } = React.useMemo(() => {
    const overallAvg = metrics.reduce((acc, m) => acc + Math.min(m.val / m.goal, 1), 0) / metrics.length;
    const pct = Math.round(overallAvg * 100);
    
    let msg = "Keep it up! You're making progress.";
    if (pct >= 100) msg = "Amazing! You crushed your goals today! 🔥";
    else if (pct >= 80) msg = "Great job! Almost at your goal! 🌟";
    else if (pct >= 50) msg = "Halfway there! Keep pushing! 💪";
    
    return { overallPct: pct, message: msg };
  }, [metrics]);

  const size = width * 0.75;

  return (
    <View style={styles.container}>
      {/* RINGS SECTION */}
      <View style={styles.visualSection}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {metrics.map((m, i) => {
            const rad = (size / 2) - 15 - (i * 24);
            return (
              <ProgressRing
                key={m.id}
                index={i}
                progress={Math.min(m.val / m.goal, 1)}
                size={size}
                strokeWidth={18}
                colors={m.colors}
                radius={rad}
              />
            );
          })}
        </Svg>
        <View style={styles.centerText}>
          <Text style={[styles.centerPct, { color: colors.text }]}>{overallPct}%</Text>
          <Text style={[styles.centerSub, { color: colors.textSecondary }]}>Daily Goal</Text>
        </View>
      </View>

      {/* MESSAGE BOX */}
      <View style={[styles.messageBox, { backgroundColor: isDark ? colors.surface : colors.card, borderColor: colors.border }]}>
        <Ionicons name="sparkles" size={18} color={colors.secondary} style={{ marginBottom: 6 }} />
        <Text style={[styles.msgText, { color: colors.text }]}>{message}</Text>
      </View>

      {/* STAT CARDS */}
      <View style={styles.statsGrid}>
        {metrics.map((m, i) => (
          <StatCard
            key={m.id}
            index={i}
            {...m}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  visualSection: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
  },
  centerPct: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  centerSub: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.6,
  },
  messageBox: {
    padding: 20,
    borderRadius: 24,
    width: width - 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  msgText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  statsGrid: {
    width: width - 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: (width - 24 - 12) / 2,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 4,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardInfo: {
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardVal: {
    fontSize: 20,
    fontWeight: '800',
  },
  cardGoal: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  miniProgressContainer: {
    height: 4,
    width: '100%',
  },
  miniProgressBar: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
