import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme as ThemeConfigs, ThemeColors } from '../constants/theme';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  colors: ThemeColors;
  isDark: boolean;
  setTheme: (theme: ThemeType | 'system') => void;
  systemTheme: ThemeType;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@caloxi_app_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreference] = useState<ThemeType | 'system'>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ThemeType>(systemColorScheme || 'light');

  // Load saved preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemePreference(savedTheme as any);
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      }
    };
    loadTheme();
  }, []);

  // Update resolved theme whenever preference or system theme changes
  useEffect(() => {
    if (themePreference === 'system') {
      setResolvedTheme(systemColorScheme || 'light');
    } else {
      setResolvedTheme(themePreference);
    }
  }, [themePreference, systemColorScheme]);

  const setTheme = async (newTheme: ThemeType | 'system') => {
    setThemePreference(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  };

  const value = {
    theme: resolvedTheme,
    colors: ThemeConfigs[resolvedTheme],
    isDark: resolvedTheme === 'dark',
    setTheme,
    systemTheme: systemColorScheme || 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
