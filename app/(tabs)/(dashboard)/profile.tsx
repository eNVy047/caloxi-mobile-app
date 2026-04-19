import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  StatusBar,
  Linking
} from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { api, API_BASE_URL } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useGoalStore } from '../../../store/useGoalStore';
import { useSubscriptionStore } from '../../../store/useSubscriptionStore';
import { useNotifications } from '../../../context/NotificationContext';

type UserData = {
  _id: string;
  fullName?: string;
  email: string;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  tdee: number;
  subscriptionStatus?: 'trial' | 'active' | 'expired' | 'none';
  subscriptionEndDate?: string;
};


type ProfileData = {
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
  fitnessGoal: string;
  activityLevel: string;
  dietPreference: string;
  bmi: number;
  dailyCalories: number;
  targetWeight?: number;
  workoutTimePreference: string;
  profileImage?: string;
};

const GENDER_OPTIONS = ['male', 'female', 'other'];
const ACTIVITY_OPTIONS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOAL_OPTIONS = ['lose_weight', 'stay_fit', 'build_muscle'];
const DIET_OPTIONS = ['veg', 'non_veg', 'vegan'];
const WORKOUT_TIME_OPTIONS = ['morning', 'afternoon', 'evening', 'night', 'flexible'];

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { isPro, trialUsed, startTrial } = useSubscriptionStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [user, setUser] = useState<UserData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Edit states
  const [editAge, setEditAge] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editActivity, setEditActivity] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editDiet, setEditDiet] = useState('');
  const [editName, setEditName] = useState('');
  const [editTargetWeight, setEditTargetWeight] = useState('');
  const [editWorkoutPreference, setEditWorkoutPreference] = useState('');

  const CACHE_KEY = '@profile_data';

  const fetchProfile = async () => {
    try {
      // 1. Try to load from cache first for immediate rendering
      const cachedString = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedString) {
        const cachedData = JSON.parse(cachedString);
        populateProfileState(cachedData);
        setLoading(false); // Stop loading immediately if cache exists
      }

      // 2. Fetch fresh data from network in background
      const res = await api.get('/api/v1/profile');
      if (res.data.success) {
        const newData = res.data.data;
        populateProfileState(newData);

        // Save fresh data to cache
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newData));
      }
    } catch (err: any) {
      if (!user) {
        Alert.alert("Error", "Could not load profile. Please sign in again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const populateProfileState = (data: { user: UserData; profile: ProfileData }) => {
    setUser(data.user);
    if (data.profile) {
      setProfile(data.profile);
      setEditName(data.user.fullName || '');
      setEditAge(String(data.profile.age));
      setEditHeight(String(data.profile.heightCm));
      setEditWeight(String(data.profile.weightKg));
      setEditGender(data.profile.gender);
      setEditActivity(data.profile.activityLevel);
      setEditGoal(data.profile.fitnessGoal);
      setEditDiet(data.profile.dietPreference);
      setEditTargetWeight(data.profile.targetWeight ? String(data.profile.targetWeight) : '');
      setEditWorkoutPreference(data.profile.workoutTimePreference || 'flexible');
    }
  };


  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      setLoading(true);
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      const formData = new FormData();
      formData.append('file', { uri, name: filename, type } as any);

      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/api/v1/profile/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setProfile(prev => prev ? { ...prev, profileImage: data.data.profileImage } : null);
      } else {
        Alert.alert('Upload Failed', data.message);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoalsSummary, setNewGoalsSummary] = useState({ calories: 0, protein: 0 });

  const saveChanges = async () => {
    try {
      setSaving(true);
      const isWeightChanged = Number(editWeight) !== profile?.weightKg;

      const payload = {
        fullName: editName,
        age: Number(editAge),
        heightCm: Number(editHeight),
        weightKg: Number(editWeight),
        gender: editGender,
        activityLevel: editActivity,
        fitnessGoal: editGoal,
        dietPreference: editDiet,
        targetWeight: Number(editTargetWeight),
        workoutTimePreference: editWorkoutPreference,
      };

      const res = await api.put('/api/v1/profile/update', payload);
      if (res.data.success) {
        const newData = res.data.data;
        setUser(newData.user);
        setProfile(newData.profile);

        // Update Zustand store in real-time
        if (newData.goals) {
          useGoalStore.getState().setGoals({
            calorieGoal: newData.goals.calorieGoal,
            proteinGoal: newData.goals.proteinGoal,
            carbsGoal: newData.goals.carbsGoal,
            fatGoal: newData.goals.fatGoal,
            waterGoal: newData.goals.waterGlasses,
            stepGoal: newData.goals.stepGoal,
          });

          setNewGoalsSummary({
            calories: newData.goals.calorieGoal,
            protein: newData.goals.proteinGoal,
          });
        }

        if (isWeightChanged) {
          setShowGoalModal(true);
        } else {
          setIsEditMode(false);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', 'Could not save profile changes');
    } finally {
      setSaving(false);
    }
  };

  const performLogout = async () => {
    await AsyncStorage.removeItem(CACHE_KEY);
    await logout();
  };

  const performDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      "Are you sure? This action is permanent and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await api.delete('/api/v1/profile/delete');
              await AsyncStorage.removeItem(CACHE_KEY);
              await logout();
            } catch (err) {
              Alert.alert('Error', 'Could not delete account');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading && !profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
      </View>
    );
  }

  const renderChipOptions = (options: string[], selectedValue: string, onSelect: (v: string) => void) => (
    <View style={styles.chipRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, { backgroundColor: isDark ? colors.surface : colors.divider, borderColor: colors.border }, selectedValue === opt && [styles.chipSelected, { backgroundColor: colors.secondary, borderColor: colors.secondary }]]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.chipText, { color: colors.textSecondary }, selectedValue === opt && [styles.chipTextSelected, { color: colors.pillText }]]}>
            {opt.replace('_', ' ')}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      {/* TOP HEADER */}
      <View style={styles.header}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Profile</Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/notification')}
            style={[
              styles.headerIconBtn, 
              { 
                backgroundColor: colors.surface, 
                borderColor: unreadCount > 0 ? colors.secondary : colors.border 
              }
            ]}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            {unreadCount > 0 && (
              <View style={[styles.badgeDot, { backgroundColor: colors.secondary, borderColor: isDark ? '#0F1014' : '#FFF' }]} />
            )}
          </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* HERO SECTION */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper}>
              {profile?.profileImage ? (
                <Image
                  source={{ uri: profile.profileImage }}
                  style={[styles.avatarImage, { borderColor: colors.border }]}
                  contentFit="cover"
                  transition={300}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#333' : colors.divider }]}>
                  <Text style={[styles.avatarLetter, { color: colors.text }]}>{user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}</Text>
                </View>
              )}
              
              {/* Subscription Badge */}
              <View style={[
                styles.subBadge, 
                { backgroundColor: isPro ? colors.secondary : '#8E8E93' }
              ]}>
                <Text style={styles.subBadgeText}>{isPro ? 'PRO' : 'FREE'}</Text>
              </View>

              <View style={[styles.cameraBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="camera" size={14} color={colors.secondary} />
              </View>
            </TouchableOpacity>

            <View style={styles.heroInfo}>
              {isEditMode ? (
                <TextInput
                  style={[styles.nameInputInline, { color: colors.text, borderBottomColor: colors.secondary }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your Name"
                  placeholderTextColor={colors.textMuted}
                />
              ) : (
                <Text style={[styles.userName, { color: colors.text }]}>{user?.fullName || 'Anonymous User'}</Text>
              )}
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
              {!isEditMode && (
                <TouchableOpacity
                  onPress={() => setIsEditMode(true)}
                  style={[styles.editProfileBtnSmall, { backgroundColor: isDark ? '#222' : colors.divider, borderColor: colors.border }]}
                >
                  <Ionicons name="create-outline" size={14} color={colors.secondary} />
                  <Text style={[styles.editProfileBtnTextSmall, { color: colors.secondary }]}>Edit Profile</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* USER STATS QUICK VIEW */}
          <View style={[styles.statsOverview, { backgroundColor: isDark ? '#222' : colors.divider, borderColor: colors.border }]}>
            <View style={styles.miniStat}>
              <Text style={[styles.miniStatLabel, { color: colors.textSecondary }]}>Weight</Text>
              <Text style={[styles.miniStatVal, { color: colors.text }]}>{profile?.weightKg}<Text style={[styles.miniStatUnit, { color: colors.textSecondary }]}>kg</Text></Text>
            </View>
            <View style={[styles.statSeparator, { backgroundColor: colors.border }]} />
            <View style={styles.miniStat}>
              <Text style={[styles.miniStatLabel, { color: colors.textSecondary }]}>Goal BMI</Text>
              <Text style={[styles.miniStatVal, { color: colors.text }]}>{profile?.bmi}</Text>
            </View>
            <View style={[styles.statSeparator, { backgroundColor: colors.border }]} />
            <View style={styles.miniStat}>
              <Text style={[styles.miniStatLabel, { color: colors.textSecondary }]}>Daily</Text>
              <Text style={[styles.miniStatVal, { color: colors.text }]}>{profile?.dailyCalories}<Text style={[styles.miniStatUnit, { color: colors.textSecondary }]}>kcal</Text></Text>
            </View>
          </View>
        </View>

        {isEditMode && (
          <View style={styles.editHeaderRow}>
            <Text style={[styles.editHeaderSubtitle, { color: colors.textMuted }]}>Updating your personal details...</Text>
            <TouchableOpacity onPress={() => setIsEditMode(false)} style={styles.cancelLink}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}


        {/* SUBSCRIPTION CARD */}
        {isPro ? (
          <View style={[styles.card, styles.proCard, { backgroundColor: colors.card, borderColor: colors.secondary }]}>
            <View style={styles.proHeader}>
              <Text style={[styles.proTitle, { color: colors.secondary }]}>✅ PRO Member</Text>
              <View><Text style={styles.crownIcon}>👑</Text></View>
            </View>
            {user?.subscriptionEndDate && (
              <Text style={[styles.proExpiry, { color: colors.textSecondary }]}>
                Expires on: {new Date(user.subscriptionEndDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.card, styles.upgradeCard, { backgroundColor: colors.card, borderColor: colors.secondary }]}
            onPress={() => router.push('/paywall')}
          >
            <View style={styles.upgradeBadgeRow}>
              <Text style={[styles.upgradeTitle, { color: colors.text }]}>Upgrade to PRO 👑</Text>
              {!trialUsed ? (
                <View style={[styles.savingBadge, { backgroundColor: colors.secondary }]}><Text style={[styles.savingBadgeText, { color: colors.pillText }]}>7 DAY TRIAL</Text></View>
              ) : (
                <View style={[styles.savingBadge, { backgroundColor: '#FF3B30' }]}><Text style={[styles.savingBadgeText, { color: colors.pillText }]}>UPGRADE</Text></View>
              )}
            </View>
            <Text style={[styles.upgradeSubtitle, { color: colors.textSecondary }]}>AI Food Scanner, Unlimited meal logging, AI Analytics and more!</Text>
            <View style={[styles.saveBtn, { marginTop: 12, paddingVertical: 12, backgroundColor: colors.secondary }]}>
              <Text style={[styles.saveBtnText, { color: colors.pillText }]}>Upgrade Now</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* AI CHAT NAVIGATION BUTTON */}
        {!isEditMode && (
          <TouchableOpacity
            style={[styles.aiChatBtn, { backgroundColor: colors.card, borderColor: colors.secondary }]}
            onPress={() => router.push('/(tabs)/chat')}
            activeOpacity={0.8}
          >
            <View style={[styles.aiChatIconContainer, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.secondary} />
            </View>
            <View style={styles.aiChatTextContainer}>
              <View style={styles.aiChatTitleRow}>
                <Text style={[styles.aiChatTitle, { color: colors.text }]}>Ask Caloxi AI</Text>
                <View style={[styles.aiChatBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.aiChatBadgeText, { color: colors.pillText }]}>NEW ✨</Text>
                </View>
              </View>
              <Text style={[styles.aiChatSubtitle, { color: colors.textSecondary }]}>Plan meals, workouts & get health advice</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* INFO SECTION */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Personal Info</Text>


          {/* Age */}
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                <Ionicons name="calendar-outline" size={18} color={colors.secondary} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: colors.text }]}>Age</Text>
                {!isEditMode && <Text style={[styles.infoSubLabel, { color: colors.textSecondary }]}>Your age in years</Text>}
              </View>
            </View>
            {isEditMode ? (
              <TextInput style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} value={editAge} onChangeText={setEditAge} keyboardType="numeric" />
            ) : (
              <Text style={[styles.infoVal, { color: colors.text }]}>{profile?.age} yrs</Text>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Height */}
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                <Ionicons name="resize-outline" size={18} color={colors.secondary} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: colors.text }]}>Height</Text>
              </View>
            </View>
            {isEditMode ? (
              <View style={styles.inputGroup}>
                <TextInput style={[styles.textInputShort, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} value={editHeight} onChangeText={setEditHeight} keyboardType="numeric" />
                <Text style={{ color: colors.textSecondary }}> cm</Text>
              </View>
            ) : (
              <Text style={[styles.infoVal, { color: colors.text }]}>{profile?.heightCm} cm</Text>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Weight */}
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                <Ionicons name="fitness-outline" size={18} color={colors.secondary} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: colors.text }]}>Weight</Text>
              </View>
            </View>
            {isEditMode ? (
              <View style={styles.inputGroup}>
                <TextInput style={[styles.textInputShort, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} value={editWeight} onChangeText={setEditWeight} keyboardType="numeric" />
                <Text style={{ color: colors.textSecondary }}> kg</Text>
              </View>
            ) : (
              <Text style={[styles.infoVal, { color: colors.text }]}>{profile?.weightKg} kg</Text>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Target Weight */}
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                <Ionicons name="flag-outline" size={18} color={colors.secondary} />
              </View>
              <View>
                <Text style={[styles.infoLabel, { color: colors.text }]}>Target Weight</Text>
              </View>
            </View>
            {isEditMode ? (
              <View style={styles.inputGroup}>
                <TextInput style={[styles.textInputShort, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} value={editTargetWeight} onChangeText={setEditTargetWeight} keyboardType="numeric" />
                <Text style={{ color: colors.textSecondary }}> kg</Text>
              </View>
            ) : (
              <Text style={[styles.infoVal, { color: colors.text }]}>{profile?.targetWeight || '--'} kg</Text>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Workout Preference */}
          <View style={styles.infoCol}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                <Ionicons name="time-outline" size={18} color={colors.secondary} />
              </View>
              <Text style={[styles.infoLabel, { color: colors.text }]}>Workout Preference</Text>
            </View>
            {isEditMode ? renderChipOptions(WORKOUT_TIME_OPTIONS, editWorkoutPreference, setEditWorkoutPreference) : <Text style={[styles.infoVal, { color: colors.text, marginTop: 4, marginLeft: 51 }]}>{profile?.workoutTimePreference}</Text>}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Gender */}
          <View style={styles.infoCol}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                <Ionicons name="person-outline" size={18} color={colors.secondary} />
              </View>
              <Text style={[styles.infoLabel, { color: colors.text }]}>Gender</Text>
            </View>
            {isEditMode ? renderChipOptions(GENDER_OPTIONS, editGender, setEditGender) : <Text style={[styles.infoVal, { color: colors.text, marginTop: 4, marginLeft: 51 }]}>{profile?.gender}</Text>}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Fitness Goal */}
          <View style={styles.infoCol}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                <Ionicons name="trophy-outline" size={18} color={colors.secondary} />
              </View>
              <Text style={[styles.infoLabel, { color: colors.text }]}>Goal</Text>
            </View>
            {isEditMode ? renderChipOptions(GOAL_OPTIONS, editGoal, setEditGoal) : <Text style={[styles.infoVal, { color: colors.text, marginTop: 4, marginLeft: 51 }]}>{profile?.fitnessGoal.replace('_', ' ')}</Text>}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Activity Level */}
          <View style={styles.infoCol}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                <Ionicons name="walk-outline" size={18} color={colors.secondary} />
              </View>
              <Text style={[styles.infoLabel, { color: colors.text }]}>Activity Level</Text>
            </View>
            {isEditMode ? renderChipOptions(ACTIVITY_OPTIONS, editActivity, setEditActivity) : <Text style={[styles.infoVal, { color: colors.text, marginTop: 4, marginLeft: 51 }]}>{profile?.activityLevel.replace('_', ' ')}</Text>}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Diet Preference */}
          <View style={styles.infoCol}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                <Ionicons name="nutrition-outline" size={18} color={colors.secondary} />
              </View>
              <Text style={[styles.infoLabel, { color: colors.text }]}>Diet Preference</Text>
            </View>
            {isEditMode ? renderChipOptions(DIET_OPTIONS, editDiet, setEditDiet) : <Text style={[styles.infoVal, { color: colors.text, marginTop: 4, marginLeft: 51 }]}>{profile?.dietPreference.replace('_', ' ')}</Text>}
          </View>

          {isEditMode && (
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.secondary }]} onPress={saveChanges} disabled={saving}>
              {saving ? <ActivityIndicator color={colors.pillText} /> : <Text style={[styles.saveBtnText, { color: colors.pillText }]}>Save Changes</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* SUPPORT & LEGAL SECTION */}
        {!isEditMode && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Support & Legal</Text>

            <TouchableOpacity style={styles.menuRow} onPress={() => Alert.alert('Help & Support', 'Contact us at support@caloxi.com for any assistance.')}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                  <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.text }]}>Help & Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.divider }]} />

            <TouchableOpacity style={styles.menuRow} onPress={() => Linking.openURL('https://envy047.github.io/privacy-policy-caloxi/')}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.infoIconBox, { backgroundColor: isDark ? '#1C1C1E' : colors.divider }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                </View>
                <Text style={[styles.menuLabel, { color: colors.text }]}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* DANGER ZONE */}
        {!isEditMode && (
          <View style={styles.dangerZone}>
            <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.border }]} onPress={performLogout}>
              <Text style={[styles.logoutText, { color: colors.secondary }]}>Logout</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={performDeleteAccount}>
              <Text style={styles.deleteText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>Caloxi v1.0.0 (1)</Text>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>Made with ❤️ for a healthier you</Text>
        </View>
      </ScrollView>

      {/* GOAL SUMMARY MODAL */}
      <Modal
        visible={showGoalModal}
        transparent={true}
        animationType="fade"
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Goals Calculated!</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Based on your new weight, we&apos;ve updated your daily targets:</Text>

            <View style={styles.modalStatRow}>
              <View style={[styles.modalStat, { backgroundColor: isDark ? '#222' : colors.divider }]}>
                <Text style={styles.modalStatSymbol}>🔥</Text>
                <Text style={[styles.modalStatLabel, { color: colors.textSecondary }]}>Calorie Goal</Text>
                <Text style={[styles.modalStatVal, { color: colors.text }]}>{newGoalsSummary.calories} kcal</Text>
              </View>
              <View style={[styles.modalStat, { backgroundColor: isDark ? '#222' : colors.divider }]}>
                <Text style={styles.modalStatSymbol}>🥩</Text>
                <Text style={[styles.modalStatLabel, { color: colors.textSecondary }]}>Protein Goal</Text>
                <Text style={[styles.modalStatVal, { color: colors.text }]}>{newGoalsSummary.protein}g</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: colors.secondary }]}
              onPress={() => {
                setShowGoalModal(false);
                setIsEditMode(false);
              }}
            >
              <Text style={[styles.modalCloseBtnText, { color: colors.pillText }]}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 15,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#141414',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  badgeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
  },
  heroCard: {
    backgroundColor: '#141414',
    borderRadius: 30,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  subBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#141414',
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  subBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFF',
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#333',
  },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#141414',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  heroInfo: {
    flex: 1,
    marginLeft: 20,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  nameInputInline: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    borderBottomWidth: 2,
    borderBottomColor: '#00D1FF',
    paddingBottom: 2,
    marginBottom: 6,
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  editProfileBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  editProfileBtnTextSmall: {
    fontSize: 12,
    color: '#00D1FF',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  statsOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#222',
    borderRadius: 20,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  aiChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    shadowColor: '#00D1FF',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  aiChatIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiChatTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  aiChatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  aiChatTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  aiChatSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  aiChatBadge: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiChatBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  miniStat: {
    alignItems: 'center',
    flex: 1,
  },
  miniStatLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  miniStatVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  miniStatUnit: {
    fontSize: 11,
    color: '#888',
    fontWeight: 'normal',
  },
  statSeparator: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  editHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 4,
  },
  editHeaderSubtitle: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
  },
  cancelLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelLinkText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoCol: {
    paddingVertical: 12,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  infoSubLabel: {
    fontSize: 12,
    color: '#666',
  },
  infoVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#888',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    width: '100%',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#FFF',
    width: 100,
    textAlign: 'right',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  textInputShort: {
    backgroundColor: '#222',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#FFF',
    width: 80,
    textAlign: 'right',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    marginLeft: 50,
    gap: 8,
  },
  chip: {
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: 'rgba(0,209,255,0.1)',
    borderColor: '#00D1FF',
  },
  chipText: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  chipTextSelected: {
    color: '#00D1FF',
  },
  saveBtn: {
    backgroundColor: '#00D1FF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 25,
    shadowColor: '#00D1FF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: 'bold',
  },
  upgradeCard: {
    backgroundColor: '#141414',
    borderColor: '#00D1FF',
    borderWidth: 1,
  },
  upgradeBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  savingBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  upgradeSubtitle: {
    fontSize: 14,
    color: '#AAA',
    lineHeight: 20,
  },
  proCard: {
    backgroundColor: '#141414',
    borderColor: '#FFD700',
    borderWidth: 1,
  },
  proHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  crownIcon: {
    fontSize: 24,
  },
  proExpiry: {
    fontSize: 14,
    color: '#888',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  dangerZone: {
    marginTop: 10,
    gap: 12,
  },
  logoutBtn: {
    backgroundColor: '#222',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  deleteText: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 50,
  },
  footerText: {
    color: '#444',
    fontSize: 12,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#141414',
    borderRadius: 30,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00D1FF',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  modalStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 30,
  },
  modalStat: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  modalStatSymbol: {
    fontSize: 32,
    marginBottom: 10,
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  modalStatVal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalCloseBtn: {
    backgroundColor: '#00D1FF',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: '#00D1FF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  modalCloseBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

