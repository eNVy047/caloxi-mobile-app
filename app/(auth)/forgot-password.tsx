import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { api } from '../../lib/api';
import { useTheme } from '../../hooks/useTheme';
import * as NavigationBar from 'expo-navigation-bar';
import { useFocusEffect } from 'expo-router';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    setApiError(null);
    try {
      const response = await api.post(`/api/v1/auth/forgot-password`, {
        email: data.email,
      });

      if (response.data.success) {
        setIsSuccess(true);
      }
    } catch (err: any) {
      if (err.response?.data?.message) {
        setApiError(err.response.data.message);
      } else {
        setApiError('Unable to process request. Please try again.');
      }
    }
  };

  if (isSuccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: isDark ? 'rgba(255,107,0,0.1)' : 'rgba(255,107,0,0.05)' }]}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.logoText, { color: colors.text }]}>Caloxi</Text>
        </View>

        <View style={[styles.formContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.successContainer}>
            <Text style={[styles.successTitle, { color: colors.text }]}>Check Your Email 📧</Text>
            <Text style={[styles.successText, { color: colors.textSecondary }]}>
              If an account exists for that email, we&apos;ve sent a temporary password.
            </Text>
            
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary, width: '100%' }]} 
              onPress={() => router.replace('/(auth)/sign-in')}
            >
              <Text style={[styles.buttonText, { color: colors.pillText }]}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <View style={[styles.logoContainer, { backgroundColor: isDark ? 'rgba(255,107,0,0.1)' : 'rgba(255,107,0,0.05)' }]}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logoImage}
            contentFit="contain"
          />
        </View>
        <Text style={[styles.logoText, { color: colors.text }]}>Caloxi</Text>
      </View>

      <View style={[styles.formContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/sign-in')}>
          <Text style={[styles.backText, { color: colors.primary }]}>← Back to Login</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>Forgot Password</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter your email to receive a temporary password.
        </Text>

        {apiError && <Text style={styles.apiError}>{apiError}</Text>}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email Address</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                  errors.email && styles.inputError
                ]}
                placeholder="john@example.com"
                placeholderTextColor={colors.textMuted}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
          />
          {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.pillText} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.pillText }]}>Send Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // ── Root ──────────────────────────────────────────────
  container: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 20,
    flexDirection: 'column',
    gap: 10,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  // ── Card ──────────────────────────────────────────────
  formContainer: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
  },

  // ── Action Row ────────────────────────────────────────
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Heading ───────────────────────────────────────────
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
    fontWeight: '500',
  },

  // ── Input group ───────────────────────────────────────
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 2,
    elevation: 1,
  },

  // ── Validation states ─────────────────────────────────
  inputError: {
    borderColor: '#FF3B30',
    backgroundColor: 'rgba(255,59,48,0.05)',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 11,
    marginTop: 2,
    marginLeft: 6,
    fontWeight: '700',
  },
  apiError: {
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    color: '#FF3B30',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },

  // ── Primary button ────────────────────────────────────
  button: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Success State ─────────────────────────────────────
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 10,
    fontWeight: '500',
  },
});
