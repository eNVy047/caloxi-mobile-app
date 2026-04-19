import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Animated,
  Keyboard,
  Alert,
  Modal,
  Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useSubscriptionStore } from '../../store/useSubscriptionStore';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../lib/api';
import { CrashService } from '../../lib/crashlytics';

const { width } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  list?: string[];
  sender: 'user' | 'ai';
  timestamp: Date;
}

const ChatMessage = ({ item, colors, isDark }: { item: Message; colors: any; isDark: boolean }) => {
  const isAI = item.sender === 'ai';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      styles.messageRow,
      isAI ? styles.aiRow : styles.userRow,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <View style={[
        styles.bubble,
        isAI ? [styles.aiBubble, { backgroundColor: isDark ? colors.surface : '#F2F2F7' }] : [styles.userBubble, { backgroundColor: colors.primary }]
      ]}>
        <Text style={[
          styles.messageText,
          { color: isAI ? colors.text : '#FFF' }
        ]}>
          {item.text}
        </Text>
        
        {item.list && item.list.length > 0 && (
          <View style={styles.listContainer}>
            {item.list.map((line, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={{ color: isAI ? colors.primary : '#FFF', marginRight: 8, fontSize: 16 }}>•</Text>
                <Text style={[styles.listText, { color: isAI ? colors.textSecondary : '#FFF' }]}>{line}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[
          styles.timestamp, 
          { color: isAI ? colors.textMuted : 'rgba(255,255,255,0.7)' }
        ]}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </Animated.View>
  );
};

export default function ChatScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { isPro, trialUsed, startTrial, loading: subscriptionLoading } = useSubscriptionStore();
  const insets = useSafeAreaInsets();
  
  const hasAccess = isPro;

  const { mode } = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm Caloxi, your personal AI fitness and diet coach. How can I help you reach your goals today?",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (mode) {
      const isMeal = mode === 'meal_plan';
      const initialSugs = isMeal
        ? ['Premium Budget', 'Basic Budget', 'High Protein', 'Vegetarian']
        : ['Muscle Gain', 'Weight Loss', 'High Intensity', 'Home Workout'];
      setSuggestions(initialSugs);
    } else {
      setSuggestions(['Plan my day', 'Macro check', 'Workout tips']);
    }
  }, [mode]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const textToSend = overrideText || inputText;
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!overrideText) setInputText('');
    setIsTyping(true);

    try {
      const history = messages.slice(-5).map(m => ({
        role: m.sender === 'user' ? 'user' : 'ai',
        text: m.text
      }));

      const response = await api.post('/api/v1/chat', { 
        message: textToSend,
        history 
      });

      if (response.data?.success && response.data?.data) {
        const { text, list, suggestions: nextSugs } = response.data.data;
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: text || "I'm having trouble phrasing that.",
          list: list || [],
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        setSuggestions(nextSugs || []);
      }
    } catch (error: any) {
      CrashService.recordError(error, 'ChatResponseError');
      Alert.alert("Error", "I'm having trouble connecting. Please try again.");
    } finally {
      setIsTyping(false);
    }
  }, [inputText, messages]);

  const clearMessages = useCallback(() => {
    Alert.alert(
      "Clear Chat",
      "Are you sure you want to delete all messages?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            setMessages([
              {
                id: '1',
                text: "Hello! I'm Caloxi, your personal AI fitness and diet coach. How can I help you reach your goals today?",
                sender: 'ai',
                timestamp: new Date(),
              },
            ]);
            setSuggestions(['Plan my day', 'Macro check', 'Workout tips']);
          }
        }
      ]
    );
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* HEADER */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Caloxi AI</Text>
          <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
        </View>

        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* CHAT LIST */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <ChatMessage item={item} colors={colors} isDark={isDark} />}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      />

      {isTyping && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.typingText, { color: colors.textMuted }]}>Caloxi is thinking...</Text>
        </View>
      )}

      {/* INPUT AREA */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 0 }}
      >
        <View style={{ backgroundColor: colors.background }}>
          {/* QUICK ACTIONS */}
          {!isTyping && suggestions.length > 0 && (
            <View style={styles.suggestionsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                {suggestions.map((sug, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.suggestionChip, { backgroundColor: isDark ? colors.surface : '#FFF', borderColor: colors.border }]}
                    onPress={() => sendMessage(sug)}
                  >
                    <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={[
            styles.inputContainer, 
            { 
              borderTopColor: colors.border,
              paddingBottom: isKeyboardVisible ? 12 : Math.max(insets.bottom, 12),
            }
          ]}>
            <View style={[styles.inputWrapper, { backgroundColor: isDark ? colors.surface : '#FFF', borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text, maxHeight: 100 }]}
                placeholder="Ask anything..."
                placeholderTextColor={colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.textMuted }]} 
                onPress={() => sendMessage()}
                disabled={!inputText.trim() || isTyping}
              >
                <Ionicons name="arrow-up" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* MENU MODAL */}
      <Modal visible={showMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); clearMessages(); }}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Clear History</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ACCESS OVERLAY */}
      {!hasAccess && (
        <View style={StyleSheet.absoluteFill}>
          <View style={[styles.lockedOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)' }]}>
            <View style={[styles.lockedCard, { backgroundColor: colors.card, borderColor: colors.secondary }]}>
              <View style={[styles.proBadge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.proBadgeText, { color: colors.pillText }]}>PRO FEATURE 👑</Text>
              </View>
              <Text style={[styles.lockedTitle, { color: colors.text }]}>Caloxi AI Chat</Text>
              <Text style={[styles.lockedSubtitle, { color: colors.textSecondary }]}>
                Chat with our advanced AI to get personalized meal plans, workout routines, and fitness advice.
              </Text>
              
              {!trialUsed ? (
                <TouchableOpacity 
                  style={[styles.primaryBtn, { backgroundColor: colors.secondary }]}
                  disabled={subscriptionLoading}
                  onPress={async () => {
                    const result = await startTrial();
                    if (result.success) {
                      Alert.alert("Success", "Your 7-day free trial has started! Enjoy premium features.");
                    } else {
                      Alert.alert("Error", result.message || "Could not start trial.");
                    }
                  }}
                >
                  {subscriptionLoading ? (
                    <ActivityIndicator color={colors.pillText} />
                  ) : (
                    <Text style={[styles.primaryBtnText, { color: colors.pillText }]}>Start 7-Day Free Trial</Text>
                  )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
  },
  listContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  messageRow: {
    marginBottom: 20,
    width: '100%',
  },
  aiRow: {
    alignItems: 'flex-start',
  },
  userRow: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: width * 0.8,
    padding: 16,
    borderRadius: 24,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  listContainer: {
    marginTop: 12,
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  typingText: {
    fontSize: 13,
    marginLeft: 8,
  },
  suggestionsWrapper: {
    paddingBottom: 4,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 20,
  },
  menuContent: {
    width: 180,
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 100,
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
