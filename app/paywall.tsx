import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { PaymentStore } from '../lib/paymentService';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

const { width, height } = Dimensions.get('window');

export default function PaywallScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<'monthly' | 'yearly'>('monthly');
  const { refreshUser } = useAuth();
  const { trialUsed, startTrial, loading: subscriptionLoading } = useSubscriptionStore();

  const handleClose = () => {
    router.replace('/(tabs)/(dashboard)');
  };

  const handleStartTrial = async () => {
    if (trialUsed) {
      Alert.alert("Trial Already Used", "You have already used your one-time free trial. Please choose a subscription plan.");
      return;
    }

    setLoading(true);
    try {
      const result = await startTrial();
      if (result.success) {
        Alert.alert("Trial Started", "Your 7-day free trial is now active. Enjoy PRO features!");
        router.replace('/(tabs)/(dashboard)');
      } else {
        Alert.alert("Error", result.message || "Failed to start trial");
      }
    } catch (error: any) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };
  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const orderResponse = await api.post('/api/v1/payment/create-order', { planType: selected });
      const { orderId, amount, currency, keyId } = orderResponse.data.data;

      const options = {
        description: `${selected === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
        image: 'https://i.imgur.com/3g7nmJC.png',
        currency,
        key: keyId,
        amount,
        name: 'FitApp Pro',
        order_id: orderId,
        prefill: { email: '', contact: '', name: '' },
        theme: { color: colors.secondary },
      };

      try {
        const data = await PaymentStore.openCheckout(options);
        const verifyResponse = await api.post('/api/v1/payment/verify', {
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          planType: selected,
        });

        if (verifyResponse.data.success) {
          Alert.alert('Success', 'You are now a PRO member.');
          await refreshUser();
          router.replace('/(tabs)/(dashboard)');
        }
      } catch (error: any) {
        if (error.message !== 'NATIVE_MODULE_UNAVAILABLE') {
          Alert.alert('Payment Error', error.description || 'Payment failed or was cancelled');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Close Button */}
      <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.surface }]} onPress={handleClose}>
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Hero */}
      <View style={styles.heroSection}>
        <View style={[styles.iconWrap, { backgroundColor: isDark ? '#222' : colors.divider }]}>
          <Text style={styles.heroEmoji}>🏋️</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Reach your Goals{'\n'}<Text style={[styles.accent, { color: colors.secondary }]}>3.5×</Text> Faster
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Unlock everything. Cancel anytime.</Text>
      </View>

      {/* Features */}
      <View style={styles.featuresRow}>
        {['AI Food Scanner', 'Analytics', 'Workouts', 'Priority Support'].map((f, i) => (
          <View key={i} style={[styles.featureChip, { backgroundColor: isDark ? '#222' : colors.divider }]}>
            <Ionicons name="checkmark" size={12} color={colors.secondary} />
            <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Plan Cards */}
      <View style={styles.cardsRow}>
        {/* Monthly */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, selected === 'monthly' && [styles.cardSelected, { borderColor: colors.secondary, backgroundColor: isDark ? '#222' : '#F5F5F5' }]]}
          onPress={() => setSelected('monthly')}
          activeOpacity={0.85}
        >
          <View style={styles.badgeRow}>
            {!trialUsed && (
              <View style={[styles.trialBadge, { backgroundColor: isDark ? 'rgba(255,140,0,0.2)' : '#FFE4CC' }]}>
                <Text style={[styles.trialBadgeText, { color: isDark ? colors.secondary : '#555' }]}>7-day free</Text>
              </View>
            )}
          </View>
          <Text style={[styles.planPrice, { color: colors.text }]}>₹29</Text>
          <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>per month</Text>
          <View style={[styles.discountPill, { backgroundColor: isDark ? 'rgba(255,140,0,0.2)' : '#FFE4CC' }]}>
            <Text style={[styles.discountText, { color: isDark ? colors.secondary : '#444' }]}>50% OFF</Text>
          </View>
        </TouchableOpacity>

        {/* Yearly */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, selected === 'yearly' && [styles.cardSelected, { borderColor: colors.secondary, backgroundColor: isDark ? '#222' : '#F5F5F5' }]]}
          onPress={() => setSelected('yearly')}
          activeOpacity={0.85}
        >
          <View style={styles.badgeRow}>
            <View style={[styles.trialBadge, styles.bestValueBadge, { backgroundColor: isDark ? 'rgba(76,175,80,0.2)' : '#D4F5D4' }]}>
              <Text style={[styles.trialBadgeText, { color: isDark ? '#4CAF50' : '#555' }]}>Best Value</Text>
            </View>
          </View>
          <Text style={[styles.planPrice, { color: colors.text }]}>₹299</Text>
          <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>per year</Text>
          <View style={[styles.discountPill, styles.greenPill, { backgroundColor: isDark ? 'rgba(76,175,80,0.2)' : '#D4F5D4' }]}>
            <Text style={[styles.discountText, { color: isDark ? '#4CAF50' : '#444' }]}>SAVE 15%</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.ctaButton, { backgroundColor: colors.secondary }]}
        onPress={selected === 'monthly' && !trialUsed ? handleStartTrial : handleSubscribe}
        disabled={loading}
        activeOpacity={0.9}
      >
        {loading ? (
          <ActivityIndicator color={colors.pillText} />
        ) : (
          <Text style={[styles.ctaText, { color: colors.pillText }]}>
            {selected === 'monthly' && !trialUsed ? 'Start 7-day Free Trial' : `Subscribe Now (₹${selected === 'monthly' ? '99' : '999'})`}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.footerNote, { color: colors.textMuted }]}>
        {selected === 'monthly' && !trialUsed ? 'No charge for 7 days · Cancel anytime' : (trialUsed ? 'Free trial already used · Secure payment' : 'Secure payment via Razorpay')}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 28,
  },

  /* Close */
  closeButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hero */
  heroSection: {
    alignItems: 'center',
    flex: 0,
    paddingTop: 4,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroEmoji: {
    fontSize: 42,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  accent: {
    color: '#FF6B00',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    fontWeight: '400',
  },

  /* Features */
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    rowGap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  featureText: {
    fontSize: 12,
    color: '#222',
    fontWeight: '500',
  },

  /* Cards */
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    alignItems: 'flex-start',
  },
  cardSelected: {
    borderColor: '#111',
    backgroundColor: '#F5F5F5',
  },
  badgeRow: {
    marginBottom: 10,
    minHeight: 24,
  },
  trialBadge: {
    backgroundColor: '#FFE4CC',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bestValueBadge: {
    backgroundColor: '#D4F5D4',
  },
  trialBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
  },
  planPrice: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111',
    letterSpacing: -0.5,
  },
  planPeriod: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    marginBottom: 12,
  },
  discountPill: {
    backgroundColor: '#FFE4CC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  greenPill: {
    backgroundColor: '#D4F5D4',
  },
  discountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#444',
    letterSpacing: 0.5,
  },

  /* CTA */
  ctaButton: {
    backgroundColor: '#111',
    borderRadius: 30,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footerNote: {
    fontSize: 12,
    color: '#AAA',
    textAlign: 'center',
  },
});