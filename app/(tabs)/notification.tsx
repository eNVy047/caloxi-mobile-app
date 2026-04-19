import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Platform, Alert, Animated,
  StatusBar, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';
import { useNotifications } from '../../context/NotificationContext';
import { Swipeable } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Notification {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { decrementUnreadCount, clearUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/api/v1/notifications');
      if (response.data.success) {
        setNotifications(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAllRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      clearUnreadCount();
      await api.patch('/api/v1/notifications/read-all');
    } catch (error) {
      Alert.alert('Error', 'Could not mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const notifToDelete = notifications.find(n => n._id === id);
      setNotifications(prev => prev.filter(n => n._id !== id));
      if (notifToDelete && !notifToDelete.isRead) {
        decrementUnreadCount();
      }
      await api.delete(`/api/v1/notifications/${id}`);
    } catch (error) {
      Alert.alert('Error', 'Could not delete notification');
    }
  };

  const markRead = async (id: string, currentlyRead: boolean) => {
    if (currentlyRead) return;
    try {
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      decrementUnreadCount();
      await api.patch(`/api/v1/notifications/${id}/read`);
    } catch (error) {
      // Silent error
    }
  };

  const groupedNotifications = useMemo(() => {
    const groups = [
      { title: 'Today', data: [] as Notification[] },
      { title: 'Yesterday', data: [] as Notification[] },
      { title: 'Past 7 Days', data: [] as Notification[] },
    ];

    notifications.forEach(n => {
      const date = parseISO(n.createdAt);
      if (isToday(date)) groups[0].data.push(n);
      else if (isYesterday(date)) groups[1].data.push(n);
      else groups[2].data.push(n);
    });

    return groups.filter(g => g.data.length > 0);
  }, [notifications]);

  const hasUnread = notifications.some(n => !n.isRead);

  const NotificationCard = React.memo(({ item }: { item: Notification }) => {
    const renderRightActions = (progress: any, dragX: any) => {
      const trans = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });
      return (
        <TouchableOpacity style={styles.deleteBtnWrapper} onPress={() => deleteNotification(item._id)}>
          <Animated.View style={[styles.deleteBtnAction, { opacity: trans }]}>
            <Ionicons name="trash-outline" size={24} color="#FFF" />
          </Animated.View>
        </TouchableOpacity>
      );
    };

    return (
      <Swipeable renderRightActions={renderRightActions}>
        <TouchableOpacity
          style={[
            styles.notificationCard,
            { backgroundColor: colors.card, borderColor: colors.border },
            !item.isRead && { borderColor: `${colors.secondary}40`, backgroundColor: `${colors.secondary}05` },
          ]}
          onPress={() => markRead(item._id, item.isRead)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }, !item.isRead && { backgroundColor: `${colors.secondary}15` }]}>
              <Ionicons name={item.isRead ? "mail-open-outline" : "mail-outline"} size={18} color={!item.isRead ? colors.secondary : colors.textMuted} />
            </View>
            <View style={styles.contentContainer}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: colors.text }, !item.isRead && styles.boldText]} numberOfLines={1}>{item.title}</Text>
                {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.secondary }]} />}
              </View>
              <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>{item.message}</Text>
              <Text style={[styles.time, { color: colors.textMuted, marginTop: 6 }]}>
                {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  });
  NotificationCard.displayName = 'NotificationCard';

  if (loading && notifications.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* HEADER SECTION */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>

        <View style={styles.headerRight}>
          {hasUnread && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Ionicons name="checkmark-done" size={20} color={colors.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* NOTIFICATION FEED */}
      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="notifications-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>All caught up!</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Your notifications will appear here as they arrive.</Text>
        </View>
      ) : (
        <FlatList
          data={groupedNotifications}
          keyExtractor={(item) => item.title}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondary} />}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={styles.groupContainer}>
              <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{item.title}</Text>
              {item.data.map(notif => (
                <NotificationCard key={notif._id} item={notif} />
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 16,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markAllBtn: {
    padding: 8,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  groupContainer: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 16,
    marginLeft: 4,
  },
  notificationCard: {
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    flex: 1,
    marginRight: 10,
  },
  boldText: {
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  time: {
    fontSize: 12,
  },
  deleteBtnWrapper: {
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'flex-end',
    borderRadius: 28,
    marginBottom: 16,
    width: 80,
  },
  deleteBtnAction: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});

