import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
  Alert,
  Modal,
  Switch,
  PanResponder
} from 'react-native';
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useGoalStore } from '../../../store/useGoalStore';
import TodayTab from '../../../components/progress_tabs/TodayTab';
import WeekTab from '../../../components/progress_tabs/WeekTab';
import MonthTab from '../../../components/progress_tabs/MonthTab';
import YearTab from '../../../components/progress_tabs/YearTab';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../../lib/api';

const { width } = Dimensions.get('window');

// --- PREMIUM MATH HELPERS (Aligned with Activities) ---
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const getArcPath = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = (endAngle - startAngle + 360) % 360 <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
};

export default function ProgressScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  // --- Optimized Zustand Selectors (Prevents re-render loops) ---
  const calorieGoal = useGoalStore(s => s.calorieGoal);
  const caloriesBurntGoal = useGoalStore(s => s.caloriesBurntGoal);
  const proteinGoal = useGoalStore(s => s.proteinGoal);
  const carbsGoal = useGoalStore(s => s.carbsGoal);
  const fatGoal = useGoalStore(s => s.fatGoal);
  const stepGoal = useGoalStore(s => s.stepGoal);
  const waterGoal = useGoalStore(s => s.waterGoal);
  const sleepGoal = useGoalStore(s => s.sleepGoal);

  const goals = useMemo(() => ({
    calorieGoal, caloriesBurntGoal, proteinGoal, carbsGoal, fatGoal, stepGoal, waterGoal, sleepGoal
  }), [calorieGoal, caloriesBurntGoal, proteinGoal, carbsGoal, fatGoal, stepGoal, waterGoal, sleepGoal]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Today');
  const [data, setData] = useState<any>(null);

  // Sleep Drawer State
  const [showSleepDrawer, setShowSleepDrawer] = useState(false);
  const [isDaily, setIsDaily] = useState(false);
  
  // Angle Refs for stable dragging
  const [bedAngle, setBedAngle] = useState((22.5 / 24) * 360); // 10:30 PM
  const [wakeAngle, setWakeAngle] = useState((7.5 / 24) * 360);  // 7:30 AM
  const draggingHandRef = useRef<'bed' | 'wake' | null>(null);
  const bedAngleRef = useRef(bedAngle);
  const wakeAngleRef = useRef(wakeAngle);

  useEffect(() => { bedAngleRef.current = bedAngle; }, [bedAngle]);
  useEffect(() => { wakeAngleRef.current = wakeAngle; }, [wakeAngle]);

  const timeFromAngle = (angle: number) => {
    let hr = (angle / 360) * 24;
    let totalMins = Math.round((hr * 60) / 10) * 10;
    let h = Math.floor(totalMins / 60);
    let m = totalMins % 60;
    if (h >= 24) h -= 24;
    return { h, m, totalMins };
  };

  const formatTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'pm' : 'am';
    let hr12 = h % 12;
    if (hr12 === 0) hr12 = 12;
    return `${hr12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const bedTimeData = timeFromAngle(bedAngle);
  const wakeTimeData = timeFromAngle(wakeAngle);

  let sleepMins = wakeTimeData.totalMins - bedTimeData.totalMins;
  if (sleepMins < 0) sleepMins += 24 * 60;
  const sleepHrs = Math.floor(sleepMins / 60);
  const sleepM = sleepMins % 60;

  const clockPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const dx = locationX - 150;
        const dy = locationY - 150;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 80 && dist < 160) {
          let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
          if (angle < 0) angle += 360;
          const bAngle = bedAngleRef.current;
          const wAngle = wakeAngleRef.current;
          const distBed = Math.min(Math.abs(angle - bAngle), 360 - Math.abs(angle - bAngle));
          const distWake = Math.min(Math.abs(angle - wAngle), 360 - Math.abs(angle - wAngle));
          draggingHandRef.current = distBed < distWake ? 'bed' : 'wake';
          return true;
        }
        return false;
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const dx = locationX - 150;
        const dy = locationY - 150;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        if (angle < 0) angle += 360;
        if (draggingHandRef.current === 'bed') setBedAngle(angle);
        else if (draggingHandRef.current === 'wake') setWakeAngle(angle);
      },
      onPanResponderRelease: () => { draggingHandRef.current = null; }
    })
  ).current;

  // --- Wrapped in useCallback to prevent infinite lifecycle loops ---
  const fetchProgress = useCallback(async () => {
    try {
      const response = await api.get(`/api/v1/progress?filter=${activeTab.toLowerCase()}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useFocusEffect(useCallback(() => {
    fetchProgress();
  }, [fetchProgress]));

  const saveNewSleep = async () => {
    try {
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const bedH = bedTimeData.h.toString().padStart(2, '0');
      const bedM = bedTimeData.m.toString().padStart(2, '0');
      const wakeH = wakeTimeData.h.toString().padStart(2, '0');
      const wakeM = wakeTimeData.m.toString().padStart(2, '0');

      await api.post('/api/v1/activity/sleep', {
        date: dateStr,
        bedtime: `${bedH}:${bedM}`,
        wakeTime: `${wakeH}:${wakeM}`,
        isDaily
      });
      
      setShowSleepDrawer(false);
      fetchProgress();
    } catch (error) {
      Alert.alert('Error', 'Could not save sleep');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  const latestLog = data?.logs?.[data.logs.length - 1] || {};

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={[styles.fixedHeader, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Stats</Text>
          <View style={[styles.tabContainer, { backgroundColor: isDark ? '#141414' : colors.divider, borderColor: colors.border }]}>
            {['Today', 'Week', 'Month', 'Year'].map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && [styles.activeTab, { backgroundColor: isDark ? '#222' : '#FFF' }]]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, { color: activeTab === tab ? colors.text : colors.textSecondary }]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Platform.OS === 'ios' ? 170 : 150 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProgress(); }} tintColor={colors.secondary} />}
      >
        {activeTab === 'Today' ? (
          <>
            <TodayTab data={data} goals={goals} />

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Sleep Logger</Text>
                <TouchableOpacity onPress={() => setShowSleepDrawer(true)} style={[styles.sleepBtn, { backgroundColor: isDark ? '#222' : colors.divider, borderColor: colors.border }]}>
                  <Ionicons name="moon-outline" size={18} color={colors.secondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.sleepStatsRow}>
                <View style={styles.sleepStatItem}>
                  <Text style={[styles.bigVal, { color: colors.text }]}>{latestLog.sleepScore || 0}%</Text>
                  <Text style={[styles.subVal, { color: colors.textSecondary }]}>Sleep Score</Text>
                </View>
                <View style={styles.sleepDivider} />
                <View style={styles.sleepStatItem}>
                  <Text style={[styles.bigVal, { color: colors.text }]}>{latestLog.sleepHours || 0}h</Text>
                  <Text style={[styles.subVal, { color: colors.textSecondary }]}>Duration</Text>
                </View>
              </View>
              {latestLog.bedtime && <Text style={[styles.statSub, { color: colors.textSecondary, textAlign: 'center' }]}>Last recorded: {latestLog.bedtime} - {latestLog.wakeTime}</Text>}
            </View>
          </>
        ) : activeTab === 'Week' ? (
          <WeekTab data={data} goals={goals} />
        ) : activeTab === 'Month' ? (
          <MonthTab data={data} goals={goals} />
        ) : (
          <YearTab data={data} goals={goals} />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* REFINED SLEEP DRAWER (Matched to Activities Tab) */}
      <Modal visible={showSleepDrawer} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.drawerPill} />
            
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Log Sleep Cycle</Text>
              <TouchableOpacity onPress={() => setShowSleepDrawer(false)} style={styles.closeIconCircle}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.todayBadge}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>TRACKING FOR TODAY</Text>
            </View>
            
            <View style={styles.clockContainer} {...clockPanResponder.panHandlers}>
              <Svg width="300" height="300">
                <Circle cx="150" cy="150" r="120" stroke={isDark ? '#222' : colors.divider} strokeWidth="28" fill="none" />
                <Path d={getArcPath(150, 150, 120, bedAngle, wakeAngle)} stroke={colors.secondary} strokeWidth="28" fill="none" strokeLinecap="round" />
                {[0, 6, 12, 18].map(h => {
                  let a = (h / 24) * 360;
                  let tPos = polarToCartesian(150, 150, 100, a);
                  let lPos = polarToCartesian(150, 150, 80, a);
                  return (
                    <G key={h}>
                      <Circle cx={tPos.x} cy={tPos.y} r="2" fill={colors.textMuted} />
                      <SvgText x={lPos.x} y={lPos.y + 4} fill={colors.textSecondary} fontSize="11" fontWeight="800" textAnchor="middle">{h}</SvgText>
                    </G>
                  );
                })}
                {(() => {
                  const bPos = polarToCartesian(150, 150, 120, bedAngle);
                  const wPos = polarToCartesian(150, 150, 120, wakeAngle);
                  return (
                    <>
                      <Circle cx={bPos.x} cy={bPos.y} r="20" fill={colors.card} stroke={draggingHandRef.current === 'bed' ? colors.secondary : colors.border} strokeWidth="2" />
                      <SvgText x={bPos.x} y={bPos.y + 6} fontSize="16" textAnchor="middle">🛏️</SvgText>
                      <Circle cx={wPos.x} cy={wPos.y} r="20" fill={colors.card} stroke={draggingHandRef.current === 'wake' ? colors.secondary : colors.border} strokeWidth="2" />
                      <SvgText x={wPos.x} y={wPos.y + 6} fontSize="16" textAnchor="middle">⏰</SvgText>
                    </>
                  );
                })()}
              </Svg>
              <View style={styles.clockCenter} pointerEvents="none">
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 4 }}>🛏️ {formatTime(bedTimeData.h, bedTimeData.m)}</Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>⏰ {formatTime(wakeTimeData.h, wakeTimeData.m)}</Text>
              </View>
            </View>

            <View style={styles.durationSummary}>
              <Text style={{ color: colors.secondary, fontSize: 20, fontWeight: '800' }}>{sleepHrs}h {sleepM}m <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>total sleep</Text></Text>
            </View>

            <View style={styles.repeatRow}>
              <View>
                <Text style={[styles.repeatTitle, { color: colors.text }]}>Set Daily Routine</Text>
                <Text style={[styles.repeatSub, { color: colors.textSecondary }]}>Save this as your default schedule</Text>
              </View>
              <Switch value={isDaily} onValueChange={setIsDaily} trackColor={{ false: '#333', true: colors.secondary }} thumbColor="#FFF" />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.footerBtn, { backgroundColor: isDark ? '#222' : colors.divider }]} onPress={() => setShowSleepDrawer(false)}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.footerBtn, { backgroundColor: colors.secondary, flex: 2 }]} onPress={saveNewSleep}>
                <Text style={{ color: '#FFF', fontWeight: '900' }}>Log Sleep Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fixedHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15 },
  header: { paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: '900', marginBottom: 16, letterSpacing: -0.8 },
  tabContainer: { flexDirection: 'row', borderRadius: 22, padding: 4, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 18 },
  activeTab: { shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '800' },
  content: { paddingHorizontal: 16 },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 32, padding: 24, marginBottom: 20, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  sleepBtn: { width: 44, height: 44, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  sleepStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40, marginVertical: 10 },
  sleepStatItem: { alignItems: 'center' },
  sleepDivider: { width: 1, height: 40, backgroundColor: 'rgba(150,150,150,0.1)' },
  bigVal: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subVal: { fontSize: 12, fontWeight: '600' },
  statSub: { fontSize: 12, marginTop: 15 },

  // MODAL STYLES (Aligned with index.tsx)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, minHeight: '80%', borderWidth: 1 },
  drawerPill: { width: 40, height: 5, backgroundColor: 'rgba(150,150,150,0.2)', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  closeIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(150,150,150,0.1)', alignItems: 'center', justifyContent: 'center' },
  todayBadge: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(150,150,150,0.05)', marginBottom: 20 },
  clockContainer: { alignSelf: 'center', width: 300, height: 300, position: 'relative' },
  clockCenter: { position: 'absolute', top: 0, left: 0, width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  durationSummary: { alignItems: 'center', marginTop: 30 },
  repeatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(150,150,150,0.1)', marginTop: 30 },
  repeatTitle: { fontSize: 16, fontWeight: '800' },
  repeatSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 'auto', paddingBottom: 20 },
  footerBtn: { height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flex: 1 },
});
