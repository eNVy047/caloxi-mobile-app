export const palette = {
  white: '#FFFFFF',
  black: '#000000',
  orange: '#FF6B00',
  blue: '#00D1FF',
  green: '#4CD964',
  red: '#FF3B30',
  gray1: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  gray4: '#3A3A3C',
  gray5: '#2C2C2E',
  gray6: '#1C1C1E',
  lightGray: '#F2F2F7',
  yellow: '#FFCC00',
};

export const darkColors = {
  background: '#0a0a0a',
  surface: '#141414',
  surfaceElevated: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  textMuted: '#636366',
  primary: palette.orange,
  secondary: palette.blue,
  accent: palette.orange,
  border: 'rgba(255, 255, 255, 0.08)',
  divider: 'rgba(255, 255, 255, 0.05)',
  success: palette.green,
  warning: palette.yellow,
  error: palette.red,
  card: '#141414',
  input: '#1C1C1E',
  tabBar: '#141414',
  pill: '#FFFFFF',
  pillText: '#000000',
  shadow: '#000000',
};

export const lightColors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#F2F2F7',
  text: '#1C1C1E',
  textSecondary: '#636366',
  textMuted: '#8E8E93',
  primary: palette.orange,
  secondary: palette.blue,
  accent: palette.orange,
  border: 'rgba(0, 0, 0, 0.08)',
  divider: 'rgba(0, 0, 0, 0.05)',
  success: '#28A745',
  warning: '#FFCC00',
  error: palette.red,
  card: '#FFFFFF',
  input: '#FFFFFF',
  tabBar: '#FFFFFF',
  pill: '#1C1C1E',
  pillText: '#FFFFFF',
  shadow: '#D1D1D6',
};

export type ThemeColors = typeof darkColors;

export const theme = {
  light: lightColors,
  dark: darkColors,
};
