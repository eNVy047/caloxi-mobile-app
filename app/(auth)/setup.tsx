import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  TextInput,
  ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../lib/api';
import * as NavigationBar from 'expo-navigation-bar';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

type StepData = {
  age: string;
  gender: 'male' | 'female' | 'other' | '';
  heightCm: string;
  weightKg: string;
  fitnessGoal: 'lose_weight' | 'build_muscle' | 'stay_fit' | '';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '';
  dietPreference: 'veg' | 'non_veg' | 'vegan' | '';
  targetWeight: string;
  workoutTimePreference: 'morning' | 'afternoon' | 'evening' | 'night' | 'flexible' | '';
};

export default function SetupScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('hidden');
      }
      return () => {
        if (Platform.OS === 'android') {
          NavigationBar.setVisibilityAsync('visible');
        }
      };
    }, [])
  );

  const [formData, setFormData] = useState<StepData>({
    age: '',
    gender: '',
    heightCm: '',
    weightKg: '',
    fitnessGoal: '',
    activityLevel: '',
    dietPreference: '',
    targetWeight: '',
    workoutTimePreference: 'flexible',
  });

  const nextStep = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };
  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.age && formData.gender;
      case 2:
        return formData.heightCm && formData.weightKg;
      case 3:
        return formData.fitnessGoal && formData.activityLevel;
      case 4:
        return formData.dietPreference !== '' && formData.targetWeight !== '';
      case 5:
        return formData.workoutTimePreference !== '';
      default:
        return false;
    }
  };

  const onSubmit = async () => {
    setApiError(null);
    setIsSubmitting(true);
    try {
      const response = await api.post(`/api/v1/profile/setup`, {
        age: Number(formData.age),
        gender: formData.gender,
        heightCm: Number(formData.heightCm),
        weightKg: Number(formData.weightKg),
        fitnessGoal: formData.fitnessGoal,
        activityLevel: formData.activityLevel,
        dietPreference: formData.dietPreference,
        targetWeight: Number(formData.targetWeight),
        workoutTimePreference: formData.workoutTimePreference,
      });

      if (response.data.success) {
        // Setup complete, move to Paywall
        router.replace('/paywall');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setApiError(err.response?.data?.message || 'Failed to sync profile. Try again.');
    }
  };

  const renderProgressBar = () => (
    <View style={[styles.progressBarContainer, { backgroundColor: colors.divider }]}>
      <View style={[styles.progressBarFill, { width: `${(currentStep / totalSteps) * 100}%`, backgroundColor: colors.secondary }]} />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {renderProgressBar()}

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Let&apos;s personalize your plan</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Step {currentStep} of {totalSteps}</Text>
        </View>

        {apiError && <Text style={styles.apiError}>{apiError}</Text>}

        <View style={styles.mainContent}>

          {/* STEP 1: Age & Gender */}
          {currentStep === 1 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.question, { color: colors.text }]}>What is your age and gender?</Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Age (years)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="25"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={formData.age}
                onChangeText={(text) => setFormData({ ...formData, age: text.replace(/[^0-9]/g, '') })}
                maxLength={3}
              />

              <Text style={[styles.label, { marginTop: 24, color: colors.textSecondary }]}>Gender</Text>
              <View style={styles.optionsRow}>
                {['male', 'female', 'other'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.optionCard, 
                      { backgroundColor: colors.surface, borderColor: colors.border }, 
                      formData.gender === g && [styles.optionCardActive, { borderColor: colors.secondary, backgroundColor: isDark ? 'rgba(0,209,255,0.1)' : 'rgba(0,209,255,0.05)' }]
                    ]}
                    onPress={() => setFormData({ ...formData, gender: g as any })}
                  >
                    <Text style={[
                      styles.optionText, 
                      { color: colors.textSecondary }, 
                      formData.gender === g && { color: colors.secondary, fontWeight: '700' }
                    ]}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* STEP 2: Height & Weight */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.question, { color: colors.text }]}>What are your current body metrics?</Text>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Height (cm)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="175"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={formData.heightCm}
                onChangeText={(text) => setFormData({ ...formData, heightCm: text.replace(/[^0-9]/g, '') })}
                maxLength={3}
              />

              <Text style={[styles.label, { marginTop: 24, color: colors.textSecondary }]}>Weight (kg)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="70"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={formData.weightKg}
                onChangeText={(text) => setFormData({ ...formData, weightKg: text.replace(/[^0-9]/g, '') })}
                maxLength={3}
              />
            </View>
          )}

          {/* STEP 3: Goals & Activity Level */}
          {currentStep === 3 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.question, { color: colors.text }]}>What is your primary goal?</Text>
              <View style={styles.optionsColumn}>
                {[
                  { id: 'lose_weight', label: 'Lose Weight (-500 cal/day)' },
                  { id: 'build_muscle', label: 'Build Muscle (+500 cal/day)' },
                  { id: 'stay_fit', label: 'Stay Fit (Maintenance)' }
                ].map((goal) => (
                  <TouchableOpacity
                    key={goal.id}
                    style={[
                      styles.optionRowList, 
                      { backgroundColor: colors.surface, borderColor: colors.border }, 
                      formData.fitnessGoal === goal.id && [styles.optionCardActive, { borderColor: colors.secondary, backgroundColor: isDark ? 'rgba(0,209,255,0.1)' : 'rgba(0,209,255,0.05)' }]
                    ]}
                    onPress={() => setFormData({ ...formData, fitnessGoal: goal.id as any })}
                  >
                    <Text style={[
                      styles.optionRowText, 
                      { color: colors.text }, 
                      formData.fitnessGoal === goal.id && { color: colors.secondary, fontWeight: '700' }
                    ]}>
                      {goal.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.question, { marginTop: 32, color: colors.text }]}>How active are you?</Text>
              <View style={styles.optionsColumn}>
                {[
                  { id: 'sedentary', label: 'Sedentary (Little to no exercise)' },
                  { id: 'light', label: 'Lightly Active (1-3 days/wk)' },
                  { id: 'moderate', label: 'Moderately Active (3-5 days/wk)' },
                  { id: 'active', label: 'Very Active (6-7 days/wk)' },
                ].map((act) => (
                  <TouchableOpacity
                    key={act.id}
                    style={[
                      styles.optionRowList, 
                      { backgroundColor: colors.surface, borderColor: colors.border }, 
                      formData.activityLevel === act.id && [styles.optionCardActive, { borderColor: colors.secondary, backgroundColor: isDark ? 'rgba(0,209,255,0.1)' : 'rgba(0,209,255,0.05)' }]
                    ]}
                    onPress={() => setFormData({ ...formData, activityLevel: act.id as any })}
                  >
                    <Text style={[
                      styles.optionRowText, 
                      { color: colors.text }, 
                      formData.activityLevel === act.id && { color: colors.secondary, fontWeight: '700' }
                    ]}>
                      {act.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* STEP 4: Diet Preferences */}
          {currentStep === 4 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.question, { color: colors.text }]}>Do you have a diet preference?</Text>
              <View style={styles.optionsColumn}>
                {[
                  { id: 'veg', label: 'Vegetarian' },
                  { id: 'non_veg', label: 'Non-Vegetarian (Omnivore)' },
                  { id: 'vegan', label: 'Vegan' },
                ].map((diet) => (
                  <TouchableOpacity
                    key={diet.id}
                    style={[
                      styles.optionRowList, 
                      { backgroundColor: colors.surface, borderColor: colors.border }, 
                      formData.dietPreference === diet.id && [styles.optionCardActive, { borderColor: colors.secondary, backgroundColor: isDark ? 'rgba(0,209,255,0.1)' : 'rgba(0,209,255,0.05)' }]
                    ]}
                    onPress={() => setFormData({ ...formData, dietPreference: diet.id as any })}
                  >
                    <Text style={[
                      styles.optionRowText, 
                      { color: colors.text }, 
                      formData.dietPreference === diet.id && { color: colors.secondary, fontWeight: '700' }
                    ]}>
                      {diet.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { marginTop: 32, color: colors.textSecondary }]}>Target Weight (kg)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="65"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={formData.targetWeight}
                onChangeText={(text) => setFormData({ ...formData, targetWeight: text.replace(/[^0-9]/g, '') })}
                maxLength={3}
              />
            </View>
          )}

          {/* STEP 5: Workout Preference */}
          {currentStep === 5 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.question, { color: colors.text }]}>When do you prefer to workout?</Text>
              <View style={styles.optionsColumn}>
                {[
                  { id: 'morning', label: '🌅 Morning (6–9 AM)' },
                  { id: 'afternoon', label: '☀️ Afternoon (12–3 PM)' },
                  { id: 'evening', label: '🌆 Evening (5–8 PM)' },
                  { id: 'night', label: '🌙 Night (8–11 PM)' },
                  { id: 'flexible', label: '⚡ Flexible' },
                ].map((pref) => (
                  <TouchableOpacity
                    key={pref.id}
                    style={[
                      styles.optionRowList, 
                      { backgroundColor: colors.surface, borderColor: colors.border }, 
                      formData.workoutTimePreference === pref.id && [styles.optionCardActive, { borderColor: colors.secondary, backgroundColor: isDark ? 'rgba(0,209,255,0.1)' : 'rgba(0,209,255,0.05)' }]
                    ]}
                    onPress={() => setFormData({ ...formData, workoutTimePreference: pref.id as any })}
                  >
                    <Text style={[
                      styles.optionRowText, 
                      { color: colors.text }, 
                      formData.workoutTimePreference === pref.id && { color: colors.secondary, fontWeight: '700' }
                    ]}>
                      {pref.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

        </View>

        {/* Navigation Buttons */}
        <View style={styles.footer}>
          {currentStep > 1 ? (
            <TouchableOpacity 
              style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} 
              onPress={prevStep} 
              disabled={isSubmitting}
            >
              <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
            </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}

          <TouchableOpacity
            style={[
              styles.nextButton, 
              { backgroundColor: colors.secondary }, 
              !isStepValid() && [styles.nextButtonDisabled, { backgroundColor: `${colors.secondary}40` }]
            ]}
            onPress={currentStep === totalSteps ? onSubmit : nextStep}
            disabled={!isStepValid() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.pillText} />
            ) : (
              <Text style={[styles.nextText, { color: colors.pillText }]}>
                {currentStep === totalSteps ? 'Finish Setup' : 'Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 40,
    paddingHorizontal: 28,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    marginBottom: 40,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  header: {
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  apiError: {
    backgroundColor: 'rgba(231,76,60,0.1)',
    color: '#e74c3c',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '600',
    overflow: 'hidden',
  },
  mainContent: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },
  question: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardActive: {
    borderWidth: 2,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionsColumn: {
    gap: 14,
  },
  optionRowList: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  optionRowText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 48,
    gap: 16,
    alignItems: 'center',
  },
  backButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
  },
  nextButton: {
    flex: 2,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonDisabled: {
    elevation: 0,
    shadowOpacity: 0,
  },
  nextText: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
