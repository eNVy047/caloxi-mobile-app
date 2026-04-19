import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { PaymentStore } from '../lib/paymentService';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

const { width } = Dimensions.get('window');

interface PaywallPopupProps {
  visible: boolean;
  onSuccess: () => void;
  onLogout: () => void;
}

export default function PaywallPopup({ visible, onSuccess, onLogout }: PaywallPopupProps) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const orderResponse = await api.post('/api/v1/payment/create-order', { planType: 'monthly' });
      const { orderId, amount, currency, keyId } = orderResponse.data.data;

      const options = {
        description: 'Monthly Subscription',
        image: 'https://i.imgur.com/3g7nmJC.png',
        currency: currency,
        key: keyId,
        amount: amount,
        name: 'FitApp Pro',
        order_id: orderId,
        prefill: {
          email: '',
          contact: '',
          name: ''
        },
        theme: { color: colors.secondary }
      };

      try {
        const data = await PaymentStore.openCheckout(options);
        // Payment success
        const verifyResponse = await api.post('/api/v1/payment/verify', {
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          planType: 'monthly'
        });

        if (verifyResponse.data.success) {
          Alert.alert('Success', 'Subscription activated!');
          await refreshUser();
          onSuccess();
        }
      } catch (error: any) {
        if (error.message !== 'NATIVE_MODULE_UNAVAILABLE') {
          Alert.alert('Payment Error', error.description || 'Payment was cancelled or failed.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={styles.container}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <View style={styles.header}>
            <View style={[styles.lockIcon, { backgroundColor: isDark ? 'rgba(255,140,0,0.1)' : '#FFF4E6' }]}>
              <Ionicons name="lock-closed" size={24} color={colors.secondary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Your free trial has expired 🔒</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Subscribe now to continue using all features</Text>
          </View>

          <View style={[styles.pricingRow, { backgroundColor: isDark ? colors.surface : '#F8F7FF' }]}>
            <View>
              <Text style={[styles.price, { color: colors.text }]}>₹29</Text>
              <Text style={[styles.period, { color: colors.textSecondary }]}>/per month</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.badgeText, { color: colors.pillText }]}>BEST SELLER</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.secondary }]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.pillText} />
            ) : (
              <Text style={[styles.subscribeText, { color: colors.pillText }]}>Subscribe Now</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={[styles.logoutText, { color: colors.textMuted }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  lockIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F8F7FF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  period: {
    fontSize: 14,
    color: '#666',
  },
  badge: {
    backgroundColor: '#FF8C00',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  subscribeButton: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  subscribeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
});
