import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function MonthTab({ data, goals }: any) {
  const { colors, isDark } = useTheme();
  const [selectedDay, setSelectedDay] = useState<any>(null);

  const logs = data?.logs || [];
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const goalsValues = {
    calories: goals?.calorieGoal || 2000,
    protein: goals?.proteinGoal || 150,
    carbs: goals?.carbsGoal || 200,
    fat: goals?.fatGoal || 67,
    steps: goals?.stepGoal || 10000,
    water: goals?.waterGoal || 8,
  };

  const logMap = logs.reduce((acc: any, log: any) => {
    acc[log.date] = log;
    return acc;
  }, {});

  const startDayOfWeek = getDay(monthStart);
  const blankDays = Array.from({ length: startDayOfWeek }).map((_, i) => <View key={`blank-${i}`} style={styles.cell} />);

  const daysGoalMetCount = logs.filter((l: any) => l.goalMet).length;
  const totalSteps = logs.reduce((sum: number, l: any) => sum + (l.steps || 0), 0);
  const avgCals = logs.length > 0 ? logs.reduce((sum: number, l: any) => sum + (l.caloriesConsumed || 0), 0) / logs.length : 0;

  const getProgressStatus = (log: any) => {
    if (!log) return 'none';
    const progress = log.caloriesConsumed / goalsValues.calories;
    if (log.goalMet || progress >= 0.9) return 'full';
    if (progress >= 0.5) return 'partial';
    return 'minimal';
  };

  const MacroBar = ({ label, current, goal, color }: any) => (
    <View style={styles.macroBarContainer}>
      <View style={styles.macroBarHeader}>
        <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.macroValue, { color: colors.text }]}>{current}g / {goal}g</Text>
      </View>
      <View style={[styles.progressBarBG, { backgroundColor: isDark ? '#222' : colors.divider }]}>
        <View style={[styles.progressBarFill, { width: `${Math.min(100, (current / goal) * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>

      {/* HEADER OVERVIEW */}
      <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.overviewHeader}>
          <View>
            <Text style={[styles.overviewTitle, { color: colors.text }]}>{format(now, 'MMMM yyyy')}</Text>
            <Text style={[styles.overviewSub, { color: colors.textSecondary }]}>Monthly Progress</Text>
          </View>
          <View style={[styles.achievementBadge, { backgroundColor: `${colors.secondary}15` }]}>
            <Ionicons name="trophy" size={20} color={colors.secondary} />
            <Text style={[styles.achievementText, { color: colors.secondary }]}>{daysGoalMetCount} Days</Text>
          </View>
        </View>
      </View>

      {/* CALENDAR */}
      <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.weekDays}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={[styles.weekDayText, { color: colors.textMuted }]}>{d}</Text>
          ))}
        </View>
        <View style={styles.grid}>
          {blankDays}
          {daysInMonth.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const log = logMap[dateStr];
            const status = getProgressStatus(log);
            const isToday = isSameDay(date, new Date());

            return (
              <TouchableOpacity
                key={dateStr}
                style={[styles.cell, isToday && { borderColor: colors.secondary, borderWidth: 1.5 }]}
                onPress={() => log && setSelectedDay(log)}
              >
                <Text style={[styles.cellText, { color: isToday ? colors.secondary : colors.text }, !log && { color: colors.textMuted }]}>
                  {format(date, 'd')}
                </Text>
                {log && (
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: status === 'full' ? colors.secondary : status === 'partial' ? `${colors.secondary}80` : `${colors.secondary}30` }
                  ]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* STATS GRID */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <SummaryCard
            title="Total Steps"
            val={totalSteps.toLocaleString()}
            unit="steps"
            icon="walk"
            color="#A855F7"
          />
          <SummaryCard
            title="Avg Calories"
            val={Math.round(avgCals).toString()}
            unit="kcal/day"
            icon="flame"
            color="#F97316"
          />
        </View>
        <View style={styles.statsRow}>
          <SummaryCard
            title="Goals Met"
            val={`${daysGoalMetCount}`}
            unit="days success"
            icon="checkmark-circle"
            color="#10B981"
          />
          <SummaryCard
            title="Avg Water"
            val={(logs.length > 0 ? (logs.reduce((s: any, l: any) => s + (l.waterGlasses || 0), 0) / logs.length).toFixed(1) : '0')}
            unit="glasses/day"
            icon="water"
            color="#3B82F6"
          />
        </View>
      </View>

      {/* DETAIL MODAL */}
      <Modal animationType="slide" transparent={true} visible={!!selectedDay} onRequestClose={() => setSelectedDay(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalDate, { color: colors.text }]}>{selectedDay && format(parseISO(selectedDay.date), 'EEEE, MMM do')}</Text>
                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>Daily Breakdown</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDay(null)} style={[styles.closeBtn, { backgroundColor: isDark ? '#222' : colors.divider }]}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedDay && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutrition</Text>
                  <MacroBar label="Protein" current={selectedDay.proteinConsumed} goal={goalsValues.protein} color="#FF4081" />
                  <MacroBar label="Carbs" current={selectedDay.carbsConsumed} goal={goalsValues.carbs} color="#00D1FF" />
                  <MacroBar label="Fats" current={selectedDay.fatConsumed} goal={goalsValues.fat} color="#FFD700" />
                </View>

                <View style={styles.modalStatsRow}>
                  <ModalStat label="Steps" val={selectedDay.steps} icon="walk" color="#A855F7" />
                  <ModalStat label="Calories" val={`${selectedDay.caloriesConsumed} kcal`} icon="flame" color="#F97316" />
                </View>
                <View style={styles.modalStatsRow}>
                  <ModalStat label="Water" val={`${selectedDay.waterGlasses} gl`} icon="water" color="#3B82F6" />
                  <ModalStat label="Sleep" val={`${selectedDay.sleepHours} hrs`} icon="moon" color="#6366F1" />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const SummaryCard = ({ title, val, unit, icon, color }: any) => {
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

const ModalStat = ({ label, val, icon, color }: any) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.modalStatBox, { backgroundColor: isDark ? '#1A1A1A' : '#F9F9FB', borderColor: colors.border }]}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={{ marginLeft: 12 }}>
        <Text style={[styles.modalStatVal, { color: colors.text }]}>{val}</Text>
        <Text style={[styles.modalStatLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0 },
  overviewCard: {
    borderRadius: 30,
    padding: 24,
    borderWidth: 1.5,
    marginBottom: 20,
    marginTop: 10
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  overviewSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  achievementText: { fontSize: 14, fontWeight: 'bold' },
  calendarCard: {
    borderRadius: 30,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  weekDayText: { fontSize: 13, fontWeight: '700', width: 40, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginVertical: 4,
  },
  cellText: { fontSize: 15, fontWeight: '700' },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: (width - 36) / 2, // (width - (12 * 2) - 12) / 2
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    padding: 24,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    minHeight: '60%',
    borderWidth: 1.5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  modalDate: { fontSize: 22, fontWeight: '900' },
  modalSub: { fontSize: 14, fontWeight: '600' },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  macroBarContainer: { marginBottom: 16 },
  macroBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  macroLabel: { fontSize: 14, fontWeight: '700' },
  macroValue: { fontSize: 14, fontWeight: '800' },
  progressBarBG: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  modalStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modalStatBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalStatVal: { fontSize: 16, fontWeight: '800' },
  modalStatLabel: { fontSize: 12, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
});
