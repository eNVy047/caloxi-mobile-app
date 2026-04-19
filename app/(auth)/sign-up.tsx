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
  StatusBar,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import * as NavigationBar from 'expo-navigation-bar';
import { useFocusEffect } from 'expo-router';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
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

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setApiError(null);
    try {
      const response = await api.post(`/api/v1/auth/register`, {
        fullName: data.fullName,
        email: data.email,
        password: data.password,
      });

      if (response.data.success) {
        const { token } = response.data.data;
        await AsyncStorage.setItem('authToken', token);
        router.replace('/(auth)/setup');
      }
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.message) {
        setApiError(err.response.data.message);
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={[styles.logoContainer, { backgroundColor: isDark ? 'rgba(255,107,0,0.1)' : 'rgba(255,107,0,0.05)' }]}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logoImage}
            contentFit="contain"
            transition={200}
          />
        </View>
        <Text style={[styles.logoText, { color: colors.text }]}>Caloxi</Text>
      </View>

      {/* ── Form Card ── */}
      <View style={[styles.formContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Join Caloxi today</Text>

        {apiError && <Text style={styles.apiError}>{apiError}</Text>}

        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
          <Controller
            control={control}
            name="fullName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                  errors.fullName && styles.inputError
                ]}
                placeholder="John Doe"
                placeholderTextColor={colors.textMuted}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                autoCapitalize="words"
              />
            )}
          />
          {errors.fullName && <Text style={styles.errorText}>{errors.fullName.message}</Text>}
        </View>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
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

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                  errors.password && styles.inputError
                ]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                secureTextEntry
              />
            )}
          />
          {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
        </View>

        {/* Confirm Password */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm Password</Text>
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[
                  styles.input, 
                  { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                  errors.confirmPassword && styles.inputError
                ]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                secureTextEntry
              />
            )}
          />
          {errors.confirmPassword && (
            <Text style={styles.errorText}>{errors.confirmPassword.message}</Text>
          )}
        </View>

        {/* Submit action */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.pillText} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.pillText }]}>Sign Up</Text>
          )}
        </TouchableOpacity>

        {/* Privacy Policy Link */}
        <View style={styles.agreementContainer}>
          <Text style={[styles.agreementText, { color: colors.textSecondary }]}>By registering you agree to our </Text>
          <Text style={[styles.agreementText, { color: colors.textSecondary }]}>Terms of Service and </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://envy047.github.io/privacy-policy-caloxi/')}>
            <Text style={[styles.agreementLink, { color: colors.primary }]}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation back to login */}
        <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={[styles.linkText, { color: colors.primary }]}>Already have an account? Log in</Text>
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
    paddingBottom: 16,
    flexDirection: 'column',
    gap: 6,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 0,
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 26,
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

  // ── Heading ───────────────────────────────────────────
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
    fontWeight: '500',
  },

  // ── Input group ───────────────────────────────────────
  inputGroup: {
    marginBottom: 10,
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
    paddingVertical: 10,
    fontSize: 15,
    elevation: 0,
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
    marginBottom: 16,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
  },

  // ── Primary button ────────────────────────────────────
  button: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    elevation: 0,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Log-in link ───────────────────────────────────────
  linkButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  agreementContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    flexWrap: 'wrap',
  },
  agreementText: {
    fontSize: 12,
    fontWeight: '500',
  },
  agreementLink: {
    fontSize: 12,
    fontWeight: '800',
  },
});