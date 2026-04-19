import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  if (!state || !state.routes) return null;

  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options as any;
  
  if (focusedOptions?.tabBarStyle?.display === 'none') return null;

  // Filter routes for the pill: Home, Stats, Profile
  const pillRoutes = state.routes.filter((route) => {
    const options: any = descriptors[route.key]?.options;
    return options?.href !== null && !['scan', 'chat', 'notification', 'workout'].includes(route.name);
  });

  const PILL_WIDTH = SCREEN_WIDTH * 0.72;
  const SLOT_WIDTH = PILL_WIDTH / pillRoutes.length;
  const ACTION_SIZE = 58;

  const handleScanPress = () => {
    navigation.navigate('scan');
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.barWrapper}>
        {/* TAB PILL */}
        <BlurView 
          intensity={40} 
          tint={isDark ? "dark" : "light"} 
          style={[
            styles.pillContainer, 
            { 
              width: PILL_WIDTH,
              backgroundColor: isDark ? 'rgba(10, 10, 10, 0.95)' : 'rgba(255, 255, 255, 0.9)',
              borderColor: colors.border
            }
          ]}
        >
          {pillRoutes.map((route) => {
            const originalIndex = state.routes.findIndex(r => r.key === route.key);
            const isFocused = state.index === originalIndex;
            const options: any = descriptors[route.key]?.options;
            const label = options?.title ?? route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            let iconName: any = 'home-outline';
            const n = route.name;
            if (n.includes('index')) iconName = isFocused ? 'home' : 'home-outline';
            else if (n.includes('progress')) iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
            else if (n.includes('profile')) iconName = isFocused ? 'person' : 'person-outline';

            return (
              <TabSlot
                key={route.key}
                isFocused={isFocused}
                onPress={onPress}
                iconName={iconName}
                label={label}
                slotWidth={SLOT_WIDTH}
                colors={colors}
              />
            );
          })}
        </BlurView>

        {/* ORANGE ACTION BUTTON */}
        <TouchableOpacity
          onPress={handleScanPress}
          activeOpacity={0.8}
          style={[
            styles.actionButton, 
            { 
              width: ACTION_SIZE, 
              height: ACTION_SIZE, 
              borderRadius: ACTION_SIZE / 2,
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            }
          ]}
        >
          <Ionicons name="add" size={32} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TabSlot({ isFocused, onPress, iconName, label, slotWidth, colors }: any) {
  const scaleAnim = useRef(new Animated.Value(isFocused ? 1 : 0.9)).current;
  const opacityAnim = useRef(new Animated.Value(isFocused ? 1 : 0.6)).current;
  const widthAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isFocused ? 1 : 0.95,
        useNativeDriver: true,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: isFocused ? 1 : 0.6,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(widthAnim, {
        toValue: isFocused ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isFocused]);

  return (
    <View style={[styles.slot, { width: slotWidth }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={[
          styles.tabItem, 
          isFocused && [styles.activeTabPill, { backgroundColor: colors.pill }]
        ]}
      >
        <Animated.View style={{ 
          transform: [{ scale: scaleAnim }], 
          opacity: opacityAnim, 
          flexDirection: 'row', 
          alignItems: 'center' 
        }}>
          <Ionicons 
            name={iconName} 
            size={isFocused ? 20 : 24} 
            color={isFocused ? colors.pillText : colors.textSecondary} 
          />
          {isFocused && (
            <Animated.Text 
              style={[styles.activeLabel, { color: colors.pillText }]} 
              numberOfLines={1}
            >
              {label}
            </Animated.Text>
          )}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 500,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 40,
    height: 64,
    paddingHorizontal: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  slot: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    minWidth: 48,
    borderRadius: 24,
  },
  activeTabPill: {
    paddingHorizontal: 16,
    height: 42,
  },
  activeLabel: {
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 8,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});