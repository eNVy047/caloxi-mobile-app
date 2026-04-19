import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
  Easing,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar,
  Modal,
  TextInput
} from 'react-native';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions, FlashMode } from 'expo-camera';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useGoalStore } from '../../store/useGoalStore';
import { useSubscriptionStore } from '../../store/useSubscriptionStore';
import { useTheme } from '../../hooks/useTheme';
import { CrashService } from '../../lib/crashlytics';

const { width, height } = Dimensions.get('window');
const SCAN_FRAME_SIZE = width * 0.7;

type NutritionInfo = {
  foodName: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  description: string;
  ingredients: string[];
  emoji?: string;
};

const IngredientCard = ({ name }: { name: string }) => {
  const { colors } = useTheme();
  const imageUrl = `https://loremflickr.com/200/200/food,${name.replace(/ /g, ',')}`;

  return (
    <View style={[styles.ingredientCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.ingredientImageContainer}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.ingredientImage}
          contentFit="cover"
          transition={200}
        />
      </View>
      <Text style={[styles.ingredientName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
    </View>
  );
};

export default function ScanScreen() {
  const { colors, isDark } = useTheme();
  const { isPro, scansUsedToday, checkScanLimit, trialUsed } = useSubscriptionStore();
  const { refreshUser } = useAuth();
  const router = useRouter();
  const store = useGoalStore();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Camera States
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [zoom, setZoom] = useState(0);

  // UI States
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [nutritionData, setNutritionData] = useState<NutritionInfo | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);

  // Animation States
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(height)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualData, setManualData] = useState({ foodName: '', calories: '', protein: '', carbs: '', fat: '' });

  // Slider Logic
  const sliderWidth = width - 80;
  const zoomPan = useRef(new Animated.Value(sliderWidth / 2)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        let newX = gestureState.moveX - 40;
        if (newX < 0) newX = 0;
        if (newX > sliderWidth) newX = sliderWidth;
        zoomPan.setValue(newX);
        const newZoom = newX / sliderWidth;
        setZoom(newZoom);
      },
    })
  ).current;

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_FRAME_SIZE],
  });

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (!photoUri) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    }
    return () => animation?.stop();
  }, [photoUri, scanLineAnim]);


  const toggleFacing = () => setFacing(prev => prev === 'back' ? 'front' : 'back');
  const toggleFlash = () => setFlash(prev => prev === 'off' ? 'on' : 'off');

  const hideSheet = useCallback((callback?: () => void) => {
    Animated.parallel([
      Animated.spring(sheetAnim, {
        toValue: height,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
    });
  }, [sheetAnim, overlayOpacity]);

  const showSheet = useCallback(() => {
    Animated.parallel([
      Animated.spring(sheetAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [sheetAnim, overlayOpacity]);

  const retake = useCallback(() => {
    hideSheet(() => {
      setPhotoUri(null);
      setImageBase64(null);
      setNutritionData(null);
      setAnalyzing(false);
      setDescriptionExpanded(false);
      refreshUser();
    });
  }, [hideSheet, refreshUser]);

  const analyzeImage = useCallback(async (base64: string) => {
    CrashService.log('🤖 Sending image for Gemini analysis');
    setAnalyzing(true);
    try {
      const resp = await api.post('/api/v1/food/analyze', {
        imageBase64: base64,
      });
      if (resp.data?.success && resp.data?.data) {
        const data = resp.data.data.data || resp.data.data;
        setNutritionData(data);
        showSheet();
        refreshUser(); // Refresh count after successful scan
      }
    } catch (error: any) {
      CrashService.recordError(error, 'GeminiAnalysisError');
      if (!error.response && error.code !== 'ECONNABORTED') {
        Alert.alert(
          'Offline',
          'AI scan requires internet. You can manually log food instead.',
          [
            { text: 'Manual Log', onPress: () => setShowManualForm(true) },
            { text: 'Cancel', onPress: retake, style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('Analysis Failed', 'Could not analyze the food image.');
        retake();
      }
    } finally {
      setAnalyzing(false);
    }
  }, [showSheet, retake]);

  const showLimitAlert = useCallback((message?: string) => {
    Alert.alert(
      "Daily Scan Limit",
      message || "You have used your free scan for today. Upgrade to Pro for unlimited scans.",
      [
        { text: "Maybe later", style: "cancel" },
        { text: "Upgrade to Pro", onPress: () => router.push('/paywall') }
      ]
    );
  }, [router]);

  const takePicture = useCallback(async () => {
    setAnalyzing(true);
    const limitCheck = await checkScanLimit();
    if (!limitCheck.allowed) {
      setAnalyzing(false);
      showLimitAlert(limitCheck.message);
      return;
    }
    setAnalyzing(false);
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.7,
        });
        if (photo) {
          CrashService.log('📸 Photo captured via camera');
          setPhotoUri(photo.uri);
          setLastImage(photo.uri);
          setImageBase64(photo.base64 || null);
          analyzeImage(photo.base64 || '');
        }
      } catch (e) {
      }
    }
  }, [showLimitAlert, analyzeImage]);

  const pickFromGallery = useCallback(async () => {
    const limitCheck = await checkScanLimit();
    if (!limitCheck.allowed) {
      showLimitAlert(limitCheck.message);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled) {
      CrashService.log('🖼️ Photo selected from library');
      setPhotoUri(result.assets[0].uri);
      setLastImage(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      analyzeImage(result.assets[0].base64 || '');
    }
  }, [showLimitAlert, analyzeImage]);

  const handleAction = useCallback(async (type: 'eat' | 'test') => {
    if (!nutritionData || !imageBase64) return;
    CrashService.log(`🍽️ Action: ${type === 'eat' ? 'Log Meal' : 'Save Test'}`);
    try {
      await api.post('/api/v1/food/save', {
        ...nutritionData,
        imageBase64,
        type,
      });
      if (type === 'eat') {
        const cal = nutritionData.calories || 0;
        const pro = nutritionData.protein || 0;
        const carb = nutritionData.carbs || 0;
        const fat = nutritionData.fat || 0;

        const currentStore = useGoalStore.getState();
        currentStore.updateConsumed({
          caloriesConsumed: currentStore.caloriesConsumed + cal,
          proteinConsumed: currentStore.proteinConsumed + pro,
          carbsConsumed: currentStore.carbsConsumed + carb,
          fatConsumed: currentStore.fatConsumed + fat,
        });
        Alert.alert('Success', 'Food logged successfully!');
      } else {
        Alert.alert('Test Saved', 'Scan saved as test for 7 days.');
      }
      router.canGoBack() ? router.back() : router.replace('/');
    } catch (error) {
      Alert.alert('Error', 'Failed to save food scan.');
    }
  }, [nutritionData, imageBase64, router]);

  const handleManualSave = useCallback(async () => {
    const { foodName, calories, protein, carbs, fat } = manualData;
    if (!foodName || !calories) {
      Alert.alert('Error', 'Please enter food name and calories.');
      return;
    }

    const cal = parseInt(calories) || 0;
    const pro = parseInt(protein) || 0;
    const carb = parseInt(carbs) || 0;
    const f = parseInt(fat) || 0;

    const nutrition = {
      foodName,
      calories: cal,
      protein: pro,
      carbs: carb,
      fat: f,
      description: 'Manually logged food',
      ingredients: [],
    };

    try {
      await api.post('/api/v1/food/save', {
        ...nutrition,
        type: 'eat',
      });

      const currentStore = useGoalStore.getState();
      currentStore.updateConsumed({
        caloriesConsumed: currentStore.caloriesConsumed + cal,
        proteinConsumed: currentStore.proteinConsumed + pro,
        carbsConsumed: currentStore.carbsConsumed + carb,
        fatConsumed: currentStore.fatConsumed + f,
      });

      Alert.alert('Success', 'Food logged successfully!');
      setShowManualForm(false);
      router.canGoBack() ? router.back() : router.replace('/');
    } catch (error) {
      Alert.alert('Error', 'Failed to save food log.');
    }
  }, [manualData, router]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centerAll, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionText, { color: colors.text }]}>We need your permission to show the camera</Text>
        <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: colors.secondary }]} onPress={requestPermission}>
          <Text style={[styles.btnPrimaryText, { color: colors.pillText }]}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {!photoUri ? (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            zoom={zoom}
          />

          {/* Header Controls */}
          <View style={styles.topHeader}>
            <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={[styles.circleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFlash} style={[styles.circleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons
                name={flash === 'on' ? "flash" : "flash-off"}
                size={24}
                color={flash === 'on' ? colors.secondary : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Locked Overlay for Free Users who reached limit */}
          {!isPro && scansUsedToday >= 1 && (
            <View style={StyleSheet.absoluteFill}>
              <View style={[styles.lockedOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)' }]}>
                <View style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.secondary }]}>
                  <View style={[styles.proBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.proBadgeText, { color: colors.pillText }]}>LIMIT REACHED 🔒</Text>
                  </View>
                  <Text style={[styles.lockedTitle, { color: colors.text }]}>Daily Limit Reached</Text>
                  <Text style={[styles.lockedSubtitle, { color: colors.textSecondary }]}>
                    You&apos;ve used your 1 free scan for today. Upgrade to PRO for unlimited AI scans and advanced analytics.
                  </Text>
                  
                  {!trialUsed ? (
                    <TouchableOpacity 
                      style={[styles.primaryBtn, { backgroundColor: colors.secondary }]}
                      onPress={async () => {
                        const result = await useSubscriptionStore.getState().startTrial();
                        if (result.success) {
                          Alert.alert("Success", "Your 7-day free trial has started! Enjoy premium features.");
                        } else {
                          Alert.alert("Error", result.message || "Could not start trial.");
                        }
                      }}
                    >
                      <Text style={[styles.primaryBtnText, { color: colors.pillText }]}>Start 7-Day Free Trial</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.primaryBtn, { backgroundColor: colors.secondary }]}
                      onPress={() => router.push('/paywall')}
                    >
                      <Text style={[styles.primaryBtnText, { color: colors.pillText }]}>Unlock with Pro</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={[styles.secondaryBtn, { borderColor: colors.border }]}
                    onPress={() => router.back()}
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Go Back</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Scan Overlay */}
          <View style={styles.overlayContainer}>
            <View style={styles.scanTarget}>
              {/* Corner Brackets */}
              <Svg height={SCAN_FRAME_SIZE} width={SCAN_FRAME_SIZE} style={styles.brackets}>
                <Path d="M 0 40 L 0 0 L 40 0" stroke="white" strokeWidth="4" fill="transparent" />
                <Path d={`M ${SCAN_FRAME_SIZE - 40} 0 L ${SCAN_FRAME_SIZE} 0 L ${SCAN_FRAME_SIZE} 40`} stroke="white" strokeWidth="4" fill="transparent" />
                <Path d={`M 0 ${SCAN_FRAME_SIZE - 40} L 0 ${SCAN_FRAME_SIZE} L 40 ${SCAN_FRAME_SIZE}`} stroke="white" strokeWidth="4" fill="transparent" />
                <Path d={`M ${SCAN_FRAME_SIZE - 40} ${SCAN_FRAME_SIZE} L ${SCAN_FRAME_SIZE} ${SCAN_FRAME_SIZE} L ${SCAN_FRAME_SIZE} ${SCAN_FRAME_SIZE - 40}`} stroke="white" strokeWidth="4" fill="transparent" />
              </Svg>
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLineTranslateY }] }
                ]}
              />
            </View>
          </View>

          {/* Bottom Panel */}
          <View style={[styles.bottomPanel, { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }]}>
            <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={styles.blurBg} />

            {/* Zoom Slider */}
            <View style={styles.zoomContainer}>
              <Text style={[styles.zoomText, { color: colors.text }]}>{(zoom * 2 + 1).toFixed(1)}x</Text>
              <View style={styles.sliderTrack}>
                {[...Array(21)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.sliderTick,
                      { backgroundColor: colors.textMuted },
                      i === 10 && [styles.sliderTickMain, { backgroundColor: colors.text }],
                      { height: i % 5 === 0 ? 15 : 8 }
                    ]}
                  />
                ))}
                <Animated.View
                  style={[styles.sliderHandle, { left: zoomPan, backgroundColor: colors.secondary }]}
                  {...panResponder.panHandlers}
                />
              </View>
            </View>

            {/* Bottom Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={pickFromGallery} style={[styles.thumbBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {lastImage ? (
                  <Image source={{ uri: lastImage }} style={styles.thumbImg} transition={200} />
                ) : (
                  <Ionicons name="images" size={24} color={colors.text} />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={takePicture} style={[styles.captureOuter, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]}>
                <View style={[styles.captureInner, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.captureSquare, { backgroundColor: colors.secondary }]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleFacing} style={[styles.flipBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                <Ionicons name="camera-reverse" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} contentFit="cover" transition={200} />
          <BlurView intensity={Platform.OS === 'ios' ? 20 : 40} tint="light" style={StyleSheet.absoluteFill} />

          <StatusBar barStyle="light-content" />

          {analyzing && (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="large" color={colors.secondary} />
              <Text style={[styles.analyzingText, { color: '#FFF' }]}>Analyzing macros...</Text>
            </View>
          )}

          {/* RESULTS BOTTOM SHEET */}
          {nutritionData && !analyzing && (
            <Animated.View
              style={[
                styles.resultSheet,
                { backgroundColor: colors.card, transform: [{ translateY: sheetAnim }] }
              ]}
            >
              <View style={[styles.sheetHandle, { backgroundColor: colors.divider }]} />

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                <View style={styles.headerRow}>
                  <Text style={[styles.foodTitle, { color: colors.text }]}>{nutritionData.foodName}</Text>
                  <View style={[styles.caloriePill, { backgroundColor: isDark ? 'rgba(255,107,0,0.2)' : 'rgba(255,107,0,0.1)' }]}>
                    <Text style={[styles.calorieText, { color: colors.secondary }]}>🔥 {nutritionData.calories} kcal</Text>
                  </View>
                </View>
                <Text style={[styles.goalPercent, { color: colors.textSecondary }]}>
                  {store.calorieGoal > 0 ? `${Math.round((nutritionData.calories / store.calorieGoal) * 100)}% of your daily ${store.calorieGoal} kcal goal` : ''}
                </Text>

                <View style={styles.macroRow}>
                  <View style={[styles.macroPill, { backgroundColor: isDark ? '#222' : colors.divider }]}><Text style={[styles.macroPillText, { color: colors.textSecondary }]}>Protein: {nutritionData.protein}g</Text></View>
                  <View style={[styles.macroPill, { backgroundColor: isDark ? '#222' : colors.divider }]}><Text style={[styles.macroPillText, { color: colors.textSecondary }]}>Carbs: {nutritionData.carbs}g</Text></View>
                  <View style={[styles.macroPill, { backgroundColor: isDark ? '#222' : colors.divider }]}><Text style={[styles.macroPillText, { color: colors.textSecondary }]}>Fat: {nutritionData.fat}g</Text></View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                  style={styles.descriptionSection}
                >
                  <Text
                    style={[styles.descriptionText, { color: colors.textSecondary }]}
                    numberOfLines={descriptionExpanded ? undefined : 2}
                  >
                    {nutritionData.description}
                  </Text>
                  {!descriptionExpanded && <Text style={[styles.readMore, { color: colors.secondary }]}>Read more</Text>}
                </TouchableOpacity>

                <View style={styles.ingredientsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Ingredients</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.ingredientsList}
                  >
                    {nutritionData.ingredients.map((ing, idx) => (
                      <IngredientCard key={idx} name={ing} />
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[styles.btnLog, { backgroundColor: colors.secondary }]}
                    onPress={() => handleAction('eat')}
                  >
                    <Text style={[styles.btnLogText, { color: colors.pillText }]}>Add meal</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnBookmark, { backgroundColor: isDark ? '#222' : colors.divider, borderColor: colors.border }]}
                    onPress={() => handleAction('test')}
                  >
                    <Ionicons name="bookmark" size={24} color={colors.secondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.cancelBtn} onPress={retake}>
                  <Text style={[styles.cancelText, { color: colors.textMuted }]}>Retake Photo</Text>
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          )}

          {/* MANUAL ENTRY MODAL */}
          <Modal visible={showManualForm} animationType="slide" transparent={true}>
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
              <View style={[styles.manualCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.manualTitle, { color: colors.text }]}>Manual Food Log</Text>

                <TextInput
                  placeholder="Food Name (e.g. Apple)"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={manualData.foodName}
                  onChangeText={(txt: string) => setManualData({ ...manualData, foodName: txt })}
                />
                <TextInput
                  placeholder="Calories (kcal)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={manualData.calories}
                  onChangeText={(txt: string) => setManualData({ ...manualData, calories: txt })}
                />

                <View style={styles.inputGrid}>
                  <TextInput
                    placeholder="Protein (g)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { flex: 1, marginRight: 8, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    value={manualData.protein}
                    onChangeText={(txt: string) => setManualData({ ...manualData, protein: txt })}
                  />
                  <TextInput
                    placeholder="Carbs (g)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { flex: 1, marginRight: 8, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    value={manualData.carbs}
                    onChangeText={(txt: string) => setManualData({ ...manualData, carbs: txt })}
                  />
                  <TextInput
                    placeholder="Fat (g)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={[styles.input, { flex: 1, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    value={manualData.fat}
                    onChangeText={(txt: string) => setManualData({ ...manualData, fat: txt })}
                  />
                </View>

                <TouchableOpacity style={[styles.btnLog, { backgroundColor: colors.secondary }]} onPress={handleManualSave}>
                  <Text style={[styles.btnLogText, { color: colors.pillText }]}>Save & Log</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cancelBtn, { marginTop: 15 }]} onPress={() => { setShowManualForm(false); retake(); }}>
                  <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerAll: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  btnPrimary: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTarget: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: 'relative',
  },
  brackets: {
    position: 'absolute',
  },
  scanLine: {
    height: 2,
    width: '100%',
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 220,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    padding: 20,
  },
  blurBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  zoomContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  zoomText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  sliderTrack: {
    width: width - 80,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  sliderTick: {
    width: 1,
    backgroundColor: '#888',
  },
  sliderTickMain: {
    width: 2,
    backgroundColor: '#000',
    height: 20,
  },
  sliderHandle: {
    position: 'absolute',
    width: 2,
    height: 40,
    backgroundColor: '#000',
    zIndex: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  thumbBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  flipBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  captureSquare: {
    width: 24,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 6,
  },
  limitBanner: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    alignSelf: 'center',
    borderRadius: 20,
    zIndex: 100,
  },
  limitBannerText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
  },
  resultSheet: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  foodTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
    color: '#FFF',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: 10,
  },
  cancelText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  // New Styles
  sheetContent: {
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  caloriePill: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  calorieText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00D1FF',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  macroPill: {
    backgroundColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  macroPillText: {
    fontSize: 12,
    color: '#AAA',
    fontWeight: '500',
  },
  descriptionSection: {
    marginBottom: 25,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#888',
  },
  readMore: {
    color: '#00D1FF',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  ingredientsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  manualCard: {
    backgroundColor: '#0F1014',
    width: '100%',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1C1C1E',
  },
  manualTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#FFF',
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
    color: '#FFF',
  },
  inputGrid: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  ingredientsList: {
    gap: 15,
    paddingRight: 20,
  },
  ingredientCard: {
    alignItems: 'center',
    width: 70,
  },
  ingredientImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  ingredientImage: {
    width: '100%',
    height: '100%',
  },
  ingredientName: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  btnLog: {
    flex: 1,
    backgroundColor: '#00D1FF',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnLogText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  btnBookmark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  goalPercent: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '600',
    marginBottom: 16,
    marginTop: -8,
  },

  // LOCKED OVERLAY
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 1000,
  },
  lockedCard: {
    width: '100%',
    borderRadius: 30,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  proBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 20,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  lockedSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 30,
  },
  primaryBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
