import { Alert, Platform } from 'react-native';
import { isExpoGo } from './environment';

/**
 * PaymentService provides a safe wrapper for RazorpayCheckout.
 * It ensures the app doesn't crash in environments without the native module (Expo Go).
 */
class PaymentService {
  private razorpayModule: any = null;
  private isAvailable: boolean = false;

  constructor() {
    this.checkAvailability();
  }

  private checkAvailability() {
    // Razorpay is a native module not available in standard Expo Go
    if (isExpoGo) {
      this.isAvailable = false;
      return;
    }

    try {
      // Dynamic require to prevent bundling errors in Expo Go
      const RazorpayCheckout = require('react-native-razorpay');
      this.razorpayModule = RazorpayCheckout.default || RazorpayCheckout;
      this.isAvailable = true;
    } catch (e) {
      this.isAvailable = false;
    }
  }

  /**
   * Opens the Razorpay checkout interface.
   * If in Expo Go, it shows a friendly alert instead of crashing.
   */
  async openCheckout(options: any): Promise<any> {
    if (!this.isAvailable || !this.razorpayModule) {
      console.warn('[PaymentService] Razorpay native module is not available in this environment.');
      
      return new Promise((_, reject) => {
        Alert.alert(
          'Native Module Required',
          'Razorpay payments are not supported in Expo Go. Please use a Development Build or EAS Build to test real payments.',
          [{ text: 'OK', onPress: () => reject(new Error('NATIVE_MODULE_UNAVAILABLE')) }]
        );
      });
    }

    try {
      return await this.razorpayModule.open(options);
    } catch (error) {
      throw error;
    }
  }

  getStatus() {
    return {
      isAvailable: this.isAvailable,
      environment: isExpoGo ? 'Expo Go (Mock)' : 'Native/Dev Build',
    };
  }
}

export const PaymentStore = new PaymentService();
