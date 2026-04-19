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

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function SignInScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { colors, isDark } = useTheme();
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setApiError(null);
    try {
      const response = await api.post(`/api/v1/auth/login`, {
        email: data.email,
        password: data.password,
      });

      if (response.data.success) {
        const { token, user } = response.data.data;
        // Save token & set user state via AuthContext — it handles navigation
        await login(token, user);
      }
    } catch (err: any) {

      if (err.response) {
        if (err.response.data && err.response.data.message) {
          setApiError(err.response.data.message);
        } else {
          setApiError('Server returned an error.');
        }
      } else if (err.request) {
        setApiError(`Network Error: ${err.message}. Check your API_BASE_URL inside lib/api.ts.`);
      } else {
        setApiError(`Unexpected error: ${err.message}`);
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
        <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Log in to Caloxi</Text>

        {apiError && <Text style={styles.apiError}>{apiError}</Text>}

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
          <View style={[
            styles.passwordContainer, 
            { backgroundColor: colors.input, borderColor: colors.border },
            errors.password && styles.inputError
          ]}>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.passwordInput, { color: colors.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  secureTextEntry={!showPassword}
                />
              )}
            />
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={[styles.toggleText, { color: colors.primary }]}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
          
          <TouchableOpacity 
            style={styles.forgotPasswordButton} 
            onPress={() => router.push('/(auth)/forgot-password')}
          >
            <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Forgot Password?</Text>
          </TouchableOpacity>
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
            <Text style={[styles.buttonText, { color: colors.pillText }]}>Log In</Text>
          )}
        </TouchableOpacity>

        {/* Privacy Policy Link */}
        <View style={styles.agreementContainer}>
          <Text style={[styles.agreementText, { color: colors.textSecondary }]}>By continuing you agree to our </Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://envy047.github.io/privacy-policy-caloxi/')}>
            <Text style={[styles.agreementLink, { color: colors.primary }]}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(auth)/sign-up')}>
          <Text style={[styles.linkText, { color: colors.primary }]}>Don&apos;t have an account? Sign up</Text>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    flexDirection: 'column',
    gap: 8,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 0,
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
    paddingTop: 28,
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
    marginBottom: 20,
    fontWeight: '500',
  },

  // ── Input group ───────────────────────────────────────
  inputGroup: {
    marginBottom: 12,
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
    elevation: 0,
  },

  // ── Password row ──────────────────────────────────────
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 0,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 2,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '700',
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
    marginTop: 8,
    elevation: 0,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ── Sign-up link ──────────────────────────────────────
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  agreementContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
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